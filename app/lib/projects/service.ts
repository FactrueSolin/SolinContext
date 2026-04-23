import { ulid } from 'ulid';
import { createDefaultApiConfig } from '../utils';
import type { ApiConfig, EditorMessage, ProjectData } from '../../types';
import {
    mergeApiConfigForPersistence,
    normalizePersistedApiConfig,
    sanitizeApiConfig,
    withRuntimeApiConfigMetadata,
} from '../ai/api-config';
import { getRuntimeApiConfigMetadata } from '../ai/runtime';
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
import { importLegacyProjectsIntoWorkspace } from './legacy-import';
import {
    buildCompatHistoryKey,
    computeProjectContentHash,
    parseApiConfigJson,
    parseMessagesJson,
    serializeApiConfig,
    serializeMessages,
    type ProjectRevisionOperation,
} from './revisions';

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
    name: string;
    systemPrompt: string;
    messages: EditorMessage[];
    apiConfig: ApiConfig;
    defaultCredentialId: string | null;
}

export class ProjectService {
    private readonly database: AppDatabaseContext;
    private readonly repository: ProjectRepository;
    private readonly importedLegacyWorkspaces = new Set<string>();

    constructor(options: { database?: AppDatabaseContext; repository?: ProjectRepository } = {}) {
        this.database = options.database ?? getAppDatabaseContext();
        this.repository = options.repository ?? new ProjectRepository(this.database.db as never);
    }

    listProjects(principal: Principal, input: ListProjectsQuery) {
        this.ensureLegacyProjectsImported(principal);
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
        this.ensureLegacyProjectsImported(principal);
        return this.createProjectFromSnapshot(principal, {
            name: input.name,
            snapshot: {
                name: input.name,
                systemPrompt: input.systemPrompt,
                messages: input.messages,
                apiConfig: normalizePersistedApiConfig(input.apiConfig ?? createDefaultApiConfig()),
                defaultCredentialId: input.defaultCredentialId ?? null,
            },
        });
    }

    createLegacyProject(
        principal: Principal,
        input: { name: string; systemPrompt: string; messages: EditorMessage[]; apiConfig: ApiConfig }
    ): ProjectData {
        this.ensureLegacyProjectsImported(principal);
        const detail = this.createProjectFromSnapshot(principal, {
            name: input.name,
            snapshot: {
                name: input.name,
                systemPrompt: input.systemPrompt,
                messages: input.messages,
                apiConfig: normalizePersistedApiConfig(input.apiConfig),
                defaultCredentialId: null,
            },
        });

        return this.mapLegacyProject(detail);
    }

    getProjectDetail(principal: Principal, projectId: string): ProjectDetail {
        this.ensureLegacyProjectsImported(principal);
        const project = this.requireProject(principal.activeWorkspaceId, projectId);
        const revision = this.requireCurrentRevision(principal.activeWorkspaceId, projectId);
        const snapshot = this.parseSnapshot(revision);

        return this.mapDetail(project, revision, snapshot);
    }

    getLegacyProject(principal: Principal, projectId: string): ProjectData {
        return this.mapLegacyProject(this.getProjectDetail(principal, projectId));
    }

    updateProject(principal: Principal, projectId: string, input: UpdateProjectInput): ProjectDetail {
        this.ensureLegacyProjectsImported(principal);
        const project = this.requireProject(principal.activeWorkspaceId, projectId);
        const currentRevision = this.requireCurrentRevision(principal.activeWorkspaceId, projectId);
        const currentSnapshot = this.parseSnapshot(currentRevision);

        if (
            input.expectedRevisionId !== undefined &&
            input.expectedRevisionId !== currentRevision.id
        ) {
            throw projectVersionConflict(input.expectedRevisionId ?? null, currentRevision.id);
        }

        const nextSnapshot: ProjectSnapshot = {
            name: input.name ?? project.name,
            systemPrompt: input.systemPrompt ?? currentSnapshot.systemPrompt,
            messages: input.messages ?? currentSnapshot.messages,
            apiConfig:
                input.apiConfig === undefined
                    ? currentSnapshot.apiConfig
                    : mergeApiConfigForPersistence(currentSnapshot.apiConfig, input.apiConfig),
            defaultCredentialId:
                input.defaultCredentialId === undefined
                    ? project.defaultCredentialId
                    : input.defaultCredentialId,
        };

        return this.appendRevision(principal, projectId, {
            name: input.name ?? project.name,
            snapshot: nextSnapshot,
        });
    }

    updateLegacyProject(principal: Principal, projectId: string, project: ProjectData): ProjectData {
        this.ensureLegacyProjectsImported(principal);
        const currentRevision = this.requireCurrentRevision(principal.activeWorkspaceId, projectId);
        const currentSnapshot = this.parseSnapshot(currentRevision);
        const detail = this.appendRevision(principal, projectId, {
            name: project.meta.name,
            snapshot: {
                name: project.meta.name,
                systemPrompt: project.systemPrompt,
                messages: project.messages,
                apiConfig: mergeApiConfigForPersistence(currentSnapshot.apiConfig, project.apiConfig),
                defaultCredentialId: null,
            },
        });

        return this.mapLegacyProject(detail);
    }

    deleteProject(principal: Principal, projectId: string): void {
        this.ensureLegacyProjectsImported(principal);
        this.requireProject(principal.activeWorkspaceId, projectId);
        this.repository.softDeleteProject(
            principal.activeWorkspaceId,
            projectId,
            principal.userId,
            Date.now()
        );
    }

    listRevisions(principal: Principal, projectId: string): ProjectRevisionSummary[] {
        this.ensureLegacyProjectsImported(principal);
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
        this.ensureLegacyProjectsImported(principal);
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

        const snapshot = this.parseSnapshot(sourceRevision);

        return this.appendRevision(principal, projectId, {
            name: sourceRevision.nameSnapshot,
            snapshot,
            operationType: 'restore',
            sourceRevisionId: sourceRevision.id,
        });
    }

    duplicateProject(principal: Principal, projectId: string): ProjectData {
        this.ensureLegacyProjectsImported(principal);
        const originalProject = this.requireProject(principal.activeWorkspaceId, projectId);
        const originalRevision = this.requireCurrentRevision(principal.activeWorkspaceId, projectId);
        const originalSnapshot = this.parseSnapshot(originalRevision);
        const duplicatedName = `${originalProject.name} (Copy)`;

        const detail = this.createProjectFromSnapshot(principal, {
            name: duplicatedName,
            snapshot: {
                name: duplicatedName,
                systemPrompt: originalSnapshot.systemPrompt,
                messages: originalSnapshot.messages,
                apiConfig: originalSnapshot.apiConfig,
                defaultCredentialId: originalProject.defaultCredentialId,
            },
            operationType: 'duplicate',
            sourceRevisionId: originalRevision.id,
        });

        return this.mapLegacyProject(detail);
    }

    getRevisionByCompatFilename(principal: Principal, projectId: string, filename: string): ProjectData {
        this.ensureLegacyProjectsImported(principal);
        const revision =
            this.repository.findRevisionByHistoryKey(principal.activeWorkspaceId, projectId, filename) ??
            this.repository.findRevisionById(
                principal.activeWorkspaceId,
                projectId,
                filename.replace(/\.json$/i, '')
            );

        if (!revision) {
            throw projectRevisionNotFound(filename.replace(/\.json$/i, ''));
        }

        const project = this.requireProject(principal.activeWorkspaceId, projectId);
        const snapshot = this.parseSnapshot(revision);

        return {
            meta: {
                id: project.id,
                name: revision.nameSnapshot,
                createdAt: new Date(project.createdAt).toISOString(),
                updatedAt: new Date(revision.createdAt).toISOString(),
            },
            systemPrompt: snapshot.systemPrompt,
            messages: snapshot.messages,
            apiConfig: withRuntimeApiConfigMetadata(
                sanitizeApiConfig(snapshot.apiConfig),
                getRuntimeApiConfigMetadata()
            ),
        };
    }

    listCompatHistory(principal: Principal, projectId: string) {
        this.ensureLegacyProjectsImported(principal);
        this.requireProject(principal.activeWorkspaceId, projectId);

        return this.repository.listHistoricalRevisions(principal.activeWorkspaceId, projectId).map((revision) => ({
            filename: revision.historyKey,
            timestamp: new Date(revision.createdAt).toISOString(),
        }));
    }

    private createProjectFromSnapshot(
        principal: Principal,
        input: {
            name: string;
            snapshot: ProjectSnapshot;
            operationType?: ProjectRevisionOperation;
            sourceRevisionId?: string | null;
        }
    ): ProjectDetail {
        const sanitizedSnapshot: ProjectSnapshot = {
            ...input.snapshot,
            apiConfig: normalizePersistedApiConfig(input.snapshot.apiConfig),
        };
        const now = Date.now();
        const projectId = ulid();
        const revisionId = ulid();
        const project: ProjectRow = {
            id: projectId,
            workspaceId: principal.activeWorkspaceId,
            name: input.name,
            systemPrompt: sanitizedSnapshot.systemPrompt,
            defaultCredentialId: sanitizedSnapshot.defaultCredentialId,
            currentRevisionId: revisionId,
            createdBy: principal.userId,
            updatedBy: principal.userId,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
            rowVersion: 1,
        };
        const revision: ProjectRevisionRow = {
            id: revisionId,
            projectId,
            workspaceId: principal.activeWorkspaceId,
            revisionNumber: 1,
            historyKey: buildCompatHistoryKey(revisionId),
            nameSnapshot: input.name,
            systemPrompt: sanitizedSnapshot.systemPrompt,
            messagesJson: serializeMessages(sanitizedSnapshot.messages),
            apiConfigJson: serializeApiConfig(sanitizedSnapshot.apiConfig),
            contentHash: computeProjectContentHash({
                name: input.name,
                systemPrompt: sanitizedSnapshot.systemPrompt,
                messages: sanitizedSnapshot.messages,
                apiConfig: sanitizedSnapshot.apiConfig,
            }),
            operationType: input.operationType ?? 'create',
            sourceRevisionId: input.sourceRevisionId ?? null,
            createdBy: principal.userId,
            createdAt: now,
            legacySourcePath: null,
        };

        this.database.client.transaction(() => {
            this.repository.createProjectWithRevision({ project, revision });
        })();

        return this.mapDetail(project, revision, sanitizedSnapshot);
    }

    private appendRevision(
        principal: Principal,
        projectId: string,
        input: {
            name: string;
            snapshot: ProjectSnapshot;
            operationType?: ProjectRevisionOperation;
            sourceRevisionId?: string | null;
        }
    ): ProjectDetail {
        const sanitizedSnapshot: ProjectSnapshot = {
            ...input.snapshot,
            apiConfig: normalizePersistedApiConfig(input.snapshot.apiConfig),
        };
        const project = this.requireProject(principal.activeWorkspaceId, projectId);
        const currentRevision = this.requireCurrentRevision(principal.activeWorkspaceId, projectId);
        const now = Date.now();
        const revisionId = ulid();
        const revision: ProjectRevisionRow = {
            id: revisionId,
            projectId,
            workspaceId: principal.activeWorkspaceId,
            revisionNumber: currentRevision.revisionNumber + 1,
            historyKey: buildCompatHistoryKey(revisionId),
            nameSnapshot: input.name,
            systemPrompt: sanitizedSnapshot.systemPrompt,
            messagesJson: serializeMessages(sanitizedSnapshot.messages),
            apiConfigJson: serializeApiConfig(sanitizedSnapshot.apiConfig),
            contentHash: computeProjectContentHash({
                name: input.name,
                systemPrompt: sanitizedSnapshot.systemPrompt,
                messages: sanitizedSnapshot.messages,
                apiConfig: sanitizedSnapshot.apiConfig,
            }),
            operationType: input.operationType ?? 'update',
            sourceRevisionId: input.sourceRevisionId ?? currentRevision.id,
            createdBy: principal.userId,
            createdAt: now,
            legacySourcePath: null,
        };

        this.database.client.transaction(() => {
            this.repository.appendRevision({
                projectId,
                workspaceId: principal.activeWorkspaceId,
                name: input.name,
                systemPrompt: sanitizedSnapshot.systemPrompt,
                defaultCredentialId: sanitizedSnapshot.defaultCredentialId,
                updatedBy: principal.userId,
                updatedAt: now,
                revision,
            });
        })();

        const updatedProject: ProjectRow = {
            ...project,
            name: input.name,
            systemPrompt: sanitizedSnapshot.systemPrompt,
            defaultCredentialId: sanitizedSnapshot.defaultCredentialId,
            currentRevisionId: revision.id,
            updatedBy: principal.userId,
            updatedAt: now,
            rowVersion: project.rowVersion + 1,
        };

        return this.mapDetail(updatedProject, revision, sanitizedSnapshot);
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

    private parseSnapshot(revision: ProjectRevisionRow): ProjectSnapshot {
        let messages: EditorMessage[];
        let apiConfig: ApiConfig;

        try {
            messages = parseMessagesJson(revision.messagesJson);
        } catch {
            messages = [];
        }

        try {
            apiConfig = parseApiConfigJson(revision.apiConfigJson);
        } catch {
            apiConfig = createDefaultApiConfig();
        }

        return {
            name: revision.nameSnapshot,
            systemPrompt: revision.systemPrompt || 'You are a helpful assistant.',
            messages,
            apiConfig,
            defaultCredentialId: null,
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
        const apiConfig = withRuntimeApiConfigMetadata(
            sanitizeApiConfig(snapshot.apiConfig),
            getRuntimeApiConfigMetadata()
        );

        return {
            ...this.mapSummary(project),
            systemPrompt: snapshot.systemPrompt,
            defaultCredentialId: snapshot.defaultCredentialId,
            currentRevisionId: revision.id,
            messages: snapshot.messages,
            apiConfig,
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

    private ensureLegacyProjectsImported(principal: Principal): void {
        if (this.importedLegacyWorkspaces.has(principal.activeWorkspaceId)) {
            return;
        }

        importLegacyProjectsIntoWorkspace({
            principal,
            database: this.database,
            repository: this.repository,
        });
        this.importedLegacyWorkspaces.add(principal.activeWorkspaceId);
    }
}

let projectService: ProjectService | null = null;

export function getProjectService(): ProjectService {
    if (!projectService) {
        projectService = new ProjectService();
    }

    return projectService;
}
