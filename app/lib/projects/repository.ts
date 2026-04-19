import { and, asc, desc, eq, isNull, like, or, sql } from 'drizzle-orm';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { projectRevisions, projects } from '../db/schema';

type ProjectDatabase = BetterSQLite3Database<{
    projectRevisions: typeof projectRevisions;
    projects: typeof projects;
}>;

export interface ProjectRow {
    id: string;
    workspaceId: string;
    name: string;
    systemPrompt: string;
    defaultCredentialId: string | null;
    currentRevisionId: string | null;
    createdBy: string | null;
    updatedBy: string | null;
    createdAt: number;
    updatedAt: number;
    deletedAt: number | null;
}

export interface ProjectRevisionRow {
    id: string;
    projectId: string;
    workspaceId: string;
    revisionNumber: number;
    snapshotJson: string;
    createdBy: string | null;
    createdAt: number;
}

export interface ListProjectsParams {
    workspaceId: string;
    query?: string;
    page: number;
    pageSize: number;
    sortBy: 'updatedAt' | 'createdAt' | 'name';
    sortOrder: 'asc' | 'desc';
}

export class ProjectRepository {
    constructor(private readonly db: ProjectDatabase) {}

    list(params: ListProjectsParams) {
        const conditions = [
            eq(projects.workspaceId, params.workspaceId),
            isNull(projects.deletedAt),
        ];

        if (params.query) {
            conditions.push(or(like(projects.name, `%${params.query}%`), like(projects.systemPrompt, `%${params.query}%`))!);
        }

        const whereClause = and(...conditions);
        const offset = (params.page - 1) * params.pageSize;

        const orderBy =
            params.sortBy === 'name'
                ? params.sortOrder === 'asc'
                    ? asc(projects.name)
                    : desc(projects.name)
                : params.sortBy === 'createdAt'
                  ? params.sortOrder === 'asc'
                      ? asc(projects.createdAt)
                      : desc(projects.createdAt)
                  : params.sortOrder === 'asc'
                    ? asc(projects.updatedAt)
                    : desc(projects.updatedAt);

        const items = this.db
            .select({
                id: projects.id,
                workspaceId: projects.workspaceId,
                name: projects.name,
                systemPrompt: projects.systemPrompt,
                defaultCredentialId: projects.defaultCredentialId,
                currentRevisionId: projects.currentRevisionId,
                createdBy: projects.createdBy,
                updatedBy: projects.updatedBy,
                createdAt: projects.createdAt,
                updatedAt: projects.updatedAt,
                deletedAt: projects.deletedAt,
            })
            .from(projects)
            .where(whereClause)
            .orderBy(orderBy)
            .limit(params.pageSize)
            .offset(offset)
            .all()
            .map((item) => ({ ...item, deletedAt: item.deletedAt ?? null }));

        const totalRow = this.db
            .select({ total: sql<number>`count(*)` })
            .from(projects)
            .where(whereClause)
            .get();

        return {
            items,
            total: Number(totalRow?.total ?? 0),
            page: params.page,
            pageSize: params.pageSize,
        };
    }

    findProjectById(workspaceId: string, id: string): ProjectRow | null {
        const row =
            this.db
                .select({
                    id: projects.id,
                    workspaceId: projects.workspaceId,
                    name: projects.name,
                    systemPrompt: projects.systemPrompt,
                    defaultCredentialId: projects.defaultCredentialId,
                    currentRevisionId: projects.currentRevisionId,
                    createdBy: projects.createdBy,
                    updatedBy: projects.updatedBy,
                    createdAt: projects.createdAt,
                    updatedAt: projects.updatedAt,
                    deletedAt: projects.deletedAt,
                })
                .from(projects)
                .where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, id), isNull(projects.deletedAt)))
                .get() ?? null;

        return row ? { ...row, deletedAt: row.deletedAt ?? null } : null;
    }

    findRevisionById(workspaceId: string, projectId: string, revisionId: string): ProjectRevisionRow | null {
        return (
            this.db
                .select({
                    id: projectRevisions.id,
                    projectId: projectRevisions.projectId,
                    workspaceId: projectRevisions.workspaceId,
                    revisionNumber: projectRevisions.revisionNumber,
                    snapshotJson: projectRevisions.snapshotJson,
                    createdBy: projectRevisions.createdBy,
                    createdAt: projectRevisions.createdAt,
                })
                .from(projectRevisions)
                .where(
                    and(
                        eq(projectRevisions.workspaceId, workspaceId),
                        eq(projectRevisions.projectId, projectId),
                        eq(projectRevisions.id, revisionId)
                    )
                )
                .get() ?? null
        );
    }

    findCurrentRevision(workspaceId: string, projectId: string): ProjectRevisionRow | null {
        return (
            this.db
                .select({
                    id: projectRevisions.id,
                    projectId: projectRevisions.projectId,
                    workspaceId: projectRevisions.workspaceId,
                    revisionNumber: projectRevisions.revisionNumber,
                    snapshotJson: projectRevisions.snapshotJson,
                    createdBy: projectRevisions.createdBy,
                    createdAt: projectRevisions.createdAt,
                })
                .from(projectRevisions)
                .innerJoin(
                    projects,
                    and(
                        eq(projects.id, projectRevisions.projectId),
                        eq(projects.currentRevisionId, projectRevisions.id)
                    )
                )
                .where(and(eq(projectRevisions.workspaceId, workspaceId), eq(projectRevisions.projectId, projectId)))
                .get() ?? null
        );
    }

    listRevisions(workspaceId: string, projectId: string): ProjectRevisionRow[] {
        return this.db
            .select({
                id: projectRevisions.id,
                projectId: projectRevisions.projectId,
                workspaceId: projectRevisions.workspaceId,
                revisionNumber: projectRevisions.revisionNumber,
                snapshotJson: projectRevisions.snapshotJson,
                createdBy: projectRevisions.createdBy,
                createdAt: projectRevisions.createdAt,
            })
            .from(projectRevisions)
            .where(and(eq(projectRevisions.workspaceId, workspaceId), eq(projectRevisions.projectId, projectId)))
            .orderBy(desc(projectRevisions.revisionNumber))
            .all();
    }

    createProjectWithRevision(input: { project: ProjectRow; revision: ProjectRevisionRow }) {
        this.db.insert(projects).values(input.project).run();
        this.db.insert(projectRevisions).values(input.revision).run();
        this.db
            .update(projects)
            .set({ currentRevisionId: input.revision.id })
            .where(eq(projects.id, input.project.id))
            .run();
    }

    appendRevision(input: {
        projectId: string;
        workspaceId: string;
        name: string;
        systemPrompt: string;
        defaultCredentialId: string | null;
        updatedBy: string;
        updatedAt: number;
        revision: ProjectRevisionRow;
    }) {
        this.db
            .insert(projectRevisions)
            .values(input.revision)
            .run();

        this.db
            .update(projects)
            .set({
                name: input.name,
                systemPrompt: input.systemPrompt,
                defaultCredentialId: input.defaultCredentialId,
                currentRevisionId: input.revision.id,
                updatedBy: input.updatedBy,
                updatedAt: input.updatedAt,
            })
            .where(and(eq(projects.workspaceId, input.workspaceId), eq(projects.id, input.projectId)))
            .run();
    }

    softDeleteProject(workspaceId: string, projectId: string, updatedBy: string, deletedAt: number) {
        this.db
            .update(projects)
            .set({
                deletedAt,
                updatedAt: deletedAt,
                updatedBy,
            })
            .where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, projectId), isNull(projects.deletedAt)))
            .run();
    }
}
