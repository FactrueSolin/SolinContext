import { ulid } from 'ulid';
import { createDefaultApiConfig } from '../utils';
import type { ApiConfig, EditorMessage, ProjectData } from '../../types';
import { getAppDatabaseContext, type AppDatabaseContext } from '../db/client';
import { ProjectRepository, type ProjectRevisionRow, type ProjectRow } from './repository';
import type {
    CreateProjectInput,
    ListProjectsQuery,
    RestoreProjectInput,
    UpdateProjectInput,
} from './validators';
import { projectNotFound, projectRevisionNotFound, projectVersionConflict } from './errors';
import type { Principal } from '../auth/principal';

export interface ProjectRevisionSummary {
    id: string;
    revisionNumber: number;
    createdAt: string;
    createdBy: string | null;
}

export interface ProjectSummary {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    createdBy: string | null;
    updatedBy: string | null;
    latestRevisionId: string | null;
}

export interface ProjectDetail extends ProjectSummary {
    systemPrompt: string;
    defaultCredentialId: string | null;
    currentRevisionId: string | null;
    messages: EditorMessage[];
    apiConfig: ApiConfig;
}

interface ProjectSnapshot {
    systemPrompt: string;
    messages: EditorMessage[];
    apiConfig: ApiConfig;
    defaultCredentialId: string | null;
}

export class ProjectService {
    private readonly database: AppDatabaseContext;
    private readonly repository: ProjectRepository;

    constructor(options: { database?: AppDatabaseContext; repository?: ProjectRepository } = {}) {
        this.database = options.database ?? getAppDatabaseContext();
        this.repository = options.repository ?? new ProjectRepository(this.database.db as never);
    }

    listProjects(principal: Principal, input: ListProjectsQuery) {
        const result = this.repository.list({
            workspaceId: principal.activeWorkspaceId,
            ...input,
        });

        return {
            items: result.items.map((item) => this.mapSummary(item)),
            pagination: {
                page: result.page,
                pageSize: result.pageSize,
                total: result.total,
            },
        };
    }

    createProject(principal: Principal, input: CreateProjectInput): ProjectDetail {
        return this.createProjectFromSnapshot(principal, {
            name: input.name,
            snapshot: {
                systemPrompt: input.systemPrompt,
                messages: [],
                apiConfig: createDefaultApiConfig(),
                defaultCredentialId: input.defaultCredentialId ?? null,
            },
        });
    }

    createLegacyProject(
        principal: Principal,
        input: { name: string; systemPrompt: string; messages: EditorMessage[]; apiConfig: ApiConfig }
    ): ProjectData {
        const detail = this.createProjectFromSnapshot(principal, {
            name: input.name,
            snapshot: {
                systemPrompt: input.systemPrompt,
                messages: input.messages,
                apiConfig: input.apiConfig,
                defaultCredentialId: null,
            },
        });

        return this.mapLegacyProject(detail);
    }

    getProjectDetail(principal: Principal, projectId: string): ProjectDetail {
        const project = this.requireProject(principal.activeWorkspaceId, projectId);
        const revision = this.requireCurrentRevision(principal.activeWorkspaceId, projectId);
        const snapshot = this.parseSnapshot(revision.snapshotJson);

        return this.mapDetail(project, revision, snapshot);
    }

    getLegacyProject(principal: Principal, projectId: string): ProjectData {
        return this.mapLegacyProject(this.getProjectDetail(principal, projectId));
    }

    updateProject(principal: Principal, projectId: string, input: UpdateProjectInput): ProjectDetail {
        const currentDetail = this.getProjectDetail(principal, projectId);

        if (
            input.expectedRevisionId !== undefined &&
            input.expectedRevisionId !== currentDetail.currentRevisionId
        ) {
            throw projectVersionConflict(input.expectedRevisionId ?? null, currentDetail.currentRevisionId);
        }

        const nextSnapshot: ProjectSnapshot = {
            systemPrompt: input.systemPrompt ?? currentDetail.systemPrompt,
            messages: currentDetail.messages,
            apiConfig: currentDetail.apiConfig,
            defaultCredentialId:
                input.defaultCredentialId === undefined
                    ? currentDetail.defaultCredentialId
                    : input.defaultCredentialId,
        };

        return this.appendRevision(principal, projectId, {
            name: input.name ?? currentDetail.name,
            snapshot: nextSnapshot,
        });
    }

    updateLegacyProject(principal: Principal, projectId: string, project: ProjectData): ProjectData {
        const detail = this.appendRevision(principal, projectId, {
            name: project.meta.name,
            snapshot: {
                systemPrompt: project.systemPrompt,
                messages: project.messages,
                apiConfig: project.apiConfig,
                defaultCredentialId: null,
            },
        });

        return this.mapLegacyProject(detail);
    }

    deleteProject(principal: Principal, projectId: string): void {
        this.requireProject(principal.activeWorkspaceId, projectId);
        this.repository.softDeleteProject(
            principal.activeWorkspaceId,
            projectId,
            principal.userId,
            Date.now()
        );
    }

    listRevisions(principal: Principal, projectId: string): ProjectRevisionSummary[] {
        this.requireProject(principal.activeWorkspaceId, projectId);

        return this.repository.listRevisions(principal.activeWorkspaceId, projectId).map((revision) => ({
            id: revision.id,
            revisionNumber: revision.revisionNumber,
            createdAt: new Date(revision.createdAt).toISOString(),
            createdBy: revision.createdBy,
        }));
    }

    restoreRevision(
        principal: Principal,
        projectId: string,
        input: RestoreProjectInput
    ): ProjectDetail {
        const currentProject = this.requireProject(principal.activeWorkspaceId, projectId);

        if (
            input.expectedRevisionId !== undefined &&
            input.expectedRevisionId !== currentProject.currentRevisionId
        ) {
            throw projectVersionConflict(input.expectedRevisionId ?? null, currentProject.currentRevisionId);
        }

        const sourceRevision = this.repository.findRevisionById(
            principal.activeWorkspaceId,
            projectId,
            input.revisionId
        );

        if (!sourceRevision) {
            throw projectRevisionNotFound(input.revisionId);
        }

        const snapshot = this.parseSnapshot(sourceRevision.snapshotJson);

        return this.appendRevision(principal, projectId, {
            name: currentProject.name,
            snapshot,
        });
    }

    duplicateProject(principal: Principal, projectId: string): ProjectData {
        const original = this.getProjectDetail(principal, projectId);

        return this.createLegacyProject(principal, {
            name: `${original.name} (Copy)`,
            systemPrompt: original.systemPrompt,
            messages: original.messages,
            apiConfig: original.apiConfig,
        });
    }

    getRevisionByCompatFilename(principal: Principal, projectId: string, filename: string): ProjectData {
        const revisionId = filename.replace(/\.json$/i, '');
        const revision = this.repository.findRevisionById(principal.activeWorkspaceId, projectId, revisionId);

        if (!revision) {
            throw projectRevisionNotFound(revisionId);
        }

        const project = this.requireProject(principal.activeWorkspaceId, projectId);
        const snapshot = this.parseSnapshot(revision.snapshotJson);

        return {
            meta: {
                id: project.id,
                name: project.name,
                createdAt: new Date(project.createdAt).toISOString(),
                updatedAt: new Date(revision.createdAt).toISOString(),
            },
            systemPrompt: snapshot.systemPrompt,
            messages: snapshot.messages,
            apiConfig: snapshot.apiConfig,
        };
    }

    listCompatHistory(principal: Principal, projectId: string) {
        return this.listRevisions(principal, projectId).map((revision) => ({
            filename: `${revision.id}.json`,
            timestamp: revision.createdAt,
        }));
    }

    private createProjectFromSnapshot(
        principal: Principal,
        input: { name: string; snapshot: ProjectSnapshot }
    ): ProjectDetail {
        const now = Date.now();
        const projectId = ulid();
        const revisionId = ulid();
        const project: ProjectRow = {
            id: projectId,
            workspaceId: principal.activeWorkspaceId,
            name: input.name,
            systemPrompt: input.snapshot.systemPrompt,
            defaultCredentialId: input.snapshot.defaultCredentialId,
            currentRevisionId: revisionId,
            createdBy: principal.userId,
            updatedBy: principal.userId,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
        };
        const revision: ProjectRevisionRow = {
            id: revisionId,
            projectId,
            workspaceId: principal.activeWorkspaceId,
            revisionNumber: 1,
            snapshotJson: JSON.stringify(input.snapshot),
            createdBy: principal.userId,
            createdAt: now,
        };

        this.database.client.transaction(() => {
            this.repository.createProjectWithRevision({ project, revision });
        })();

        return this.mapDetail(project, revision, input.snapshot);
    }

    private appendRevision(
        principal: Principal,
        projectId: string,
        input: { name: string; snapshot: ProjectSnapshot }
    ): ProjectDetail {
        const project = this.requireProject(principal.activeWorkspaceId, projectId);
        const currentRevision = this.requireCurrentRevision(principal.activeWorkspaceId, projectId);
        const now = Date.now();
        const revision: ProjectRevisionRow = {
            id: ulid(),
            projectId,
            workspaceId: principal.activeWorkspaceId,
            revisionNumber: currentRevision.revisionNumber + 1,
            snapshotJson: JSON.stringify(input.snapshot),
            createdBy: principal.userId,
            createdAt: now,
        };

        this.database.client.transaction(() => {
            this.repository.appendRevision({
                projectId,
                workspaceId: principal.activeWorkspaceId,
                name: input.name,
                systemPrompt: input.snapshot.systemPrompt,
                defaultCredentialId: input.snapshot.defaultCredentialId,
                updatedBy: principal.userId,
                updatedAt: now,
                revision,
            });
        })();

        const updatedProject: ProjectRow = {
            ...project,
            name: input.name,
            systemPrompt: input.snapshot.systemPrompt,
            defaultCredentialId: input.snapshot.defaultCredentialId,
            currentRevisionId: revision.id,
            updatedBy: principal.userId,
            updatedAt: now,
        };

        return this.mapDetail(updatedProject, revision, input.snapshot);
    }

    private requireProject(workspaceId: string, projectId: string): ProjectRow {
        const project = this.repository.findProjectById(workspaceId, projectId);
        if (!project) {
            throw projectNotFound(projectId);
        }

        return project;
    }

    private requireCurrentRevision(workspaceId: string, projectId: string): ProjectRevisionRow {
        const revision = this.repository.findCurrentRevision(workspaceId, projectId);
        if (!revision) {
            throw projectRevisionNotFound(projectId);
        }

        return revision;
    }

    private parseSnapshot(snapshotJson: string): ProjectSnapshot {
        const parsed = JSON.parse(snapshotJson) as Partial<ProjectSnapshot>;

        return {
            systemPrompt: parsed.systemPrompt ?? 'You are a helpful assistant.',
            messages: parsed.messages ?? [],
            apiConfig: parsed.apiConfig ?? createDefaultApiConfig(),
            defaultCredentialId: parsed.defaultCredentialId ?? null,
        };
    }

    private mapSummary(project: ProjectRow): ProjectSummary {
        return {
            id: project.id,
            name: project.name,
            createdAt: new Date(project.createdAt).toISOString(),
            updatedAt: new Date(project.updatedAt).toISOString(),
            createdBy: project.createdBy,
            updatedBy: project.updatedBy,
            latestRevisionId: project.currentRevisionId,
        };
    }

    private mapDetail(
        project: ProjectRow,
        revision: ProjectRevisionRow,
        snapshot: ProjectSnapshot
    ): ProjectDetail {
        return {
            ...this.mapSummary(project),
            systemPrompt: snapshot.systemPrompt,
            defaultCredentialId: snapshot.defaultCredentialId,
            currentRevisionId: revision.id,
            messages: snapshot.messages,
            apiConfig: snapshot.apiConfig,
        };
    }

    private mapLegacyProject(project: ProjectDetail): ProjectData {
        return {
            meta: {
                id: project.id,
                name: project.name,
                createdAt: project.createdAt,
                updatedAt: project.updatedAt,
            },
            systemPrompt: project.systemPrompt,
            messages: project.messages,
            apiConfig: project.apiConfig,
        };
    }
}

let projectService: ProjectService | null = null;

export function getProjectService(): ProjectService {
    if (!projectService) {
        projectService = new ProjectService();
    }

    return projectService;
}
