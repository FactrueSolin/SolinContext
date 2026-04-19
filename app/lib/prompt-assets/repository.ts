import { and, desc, eq, like, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { promptAssets, promptAssetVersions } from '../db/schema';
import type { PromptAssetOperationType, PromptAssetStatus } from './dto';

type PromptAssetDatabase = BetterSQLite3Database<{
    promptAssets: typeof promptAssets;
    promptAssetVersions: typeof promptAssetVersions;
}>;

export interface PromptAssetRow {
    id: string;
    workspaceId: string;
    name: string;
    normalizedName: string;
    description: string;
    currentVersionNumber: number;
    status: PromptAssetStatus;
    createdBy: string | null;
    updatedBy: string | null;
    createdAt: number;
    updatedAt: number;
    archivedAt: number | null;
}

export interface PromptAssetVersionRow {
    id: string;
    assetId: string;
    workspaceId: string;
    versionNumber: number;
    nameSnapshot: string;
    descriptionSnapshot: string;
    content: string;
    changeNote: string | null;
    contentHash: string;
    operationType: PromptAssetOperationType;
    sourceVersionId: string | null;
    createdBy: string | null;
    createdAt: number;
}

export interface PaginatedResult<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
}

export interface ListPromptAssetsParams {
    workspaceId: string;
    query?: string;
    status: PromptAssetStatus | 'all';
    page: number;
    pageSize: number;
}

export interface PaginationParams {
    page: number;
    pageSize: number;
}

export interface CreateAssetTxInput {
    asset: PromptAssetRow;
    version: PromptAssetVersionRow;
}

export interface AppendVersionTxInput {
    assetId: string;
    workspaceId: string;
    name: string;
    normalizedName: string;
    description: string;
    currentVersionNumber: number;
    updatedBy: string;
    updatedAt: number;
    version: PromptAssetVersionRow;
}

export interface UpdateArchiveStatusTxInput {
    id: string;
    workspaceId: string;
    status: PromptAssetStatus;
    archivedAt: number | null;
    updatedBy: string;
    updatedAt: number;
}

export class PromptAssetRepository {
    constructor(private readonly db: PromptAssetDatabase) {}

    list(params: ListPromptAssetsParams): PaginatedResult<PromptAssetRow> {
        const conditions = [eq(promptAssets.workspaceId, params.workspaceId)];
        const offset = (params.page - 1) * params.pageSize;

        if (params.status !== 'all') {
            conditions.push(eq(promptAssets.status, params.status));
        }

        if (params.query) {
            conditions.push(like(promptAssets.name, `%${params.query}%`));
        }

        const whereClause = and(...conditions);

        const items = this.db
            .select({
                id: promptAssets.id,
                workspaceId: promptAssets.workspaceId,
                name: promptAssets.name,
                normalizedName: promptAssets.normalizedName,
                description: promptAssets.description,
                currentVersionNumber: promptAssets.currentVersionNumber,
                status: promptAssets.status,
                createdBy: promptAssets.createdBy,
                updatedBy: promptAssets.updatedBy,
                createdAt: promptAssets.createdAt,
                updatedAt: promptAssets.updatedAt,
                archivedAt: promptAssets.archivedAt,
            })
            .from(promptAssets)
            .where(whereClause)
            .orderBy(desc(promptAssets.updatedAt))
            .limit(params.pageSize)
            .offset(offset)
            .all()
            .map((item) => ({ ...item, archivedAt: item.archivedAt ?? null }));

        const totalRow = this.db
            .select({
                total: sql<number>`count(*)`,
            })
            .from(promptAssets)
            .where(whereClause)
            .get();

        return {
            items,
            total: Number(totalRow?.total ?? 0),
            page: params.page,
            pageSize: params.pageSize,
        };
    }

    findAssetById(workspaceId: string, id: string): PromptAssetRow | null {
        const row =
            this.db
                .select({
                    id: promptAssets.id,
                    workspaceId: promptAssets.workspaceId,
                    name: promptAssets.name,
                    normalizedName: promptAssets.normalizedName,
                    description: promptAssets.description,
                    currentVersionNumber: promptAssets.currentVersionNumber,
                    status: promptAssets.status,
                    createdBy: promptAssets.createdBy,
                    updatedBy: promptAssets.updatedBy,
                    createdAt: promptAssets.createdAt,
                    updatedAt: promptAssets.updatedAt,
                    archivedAt: promptAssets.archivedAt,
                })
                .from(promptAssets)
                .where(and(eq(promptAssets.workspaceId, workspaceId), eq(promptAssets.id, id)))
                .get() ?? null;

        return row ? { ...row, archivedAt: row.archivedAt ?? null } : null;
    }

    findCurrentVersionByAssetId(workspaceId: string, assetId: string): PromptAssetVersionRow | null {
        return (
            this.db
                .select({
                    id: promptAssetVersions.id,
                    assetId: promptAssetVersions.assetId,
                    workspaceId: promptAssetVersions.workspaceId,
                    versionNumber: promptAssetVersions.versionNumber,
                    nameSnapshot: promptAssetVersions.nameSnapshot,
                    descriptionSnapshot: promptAssetVersions.descriptionSnapshot,
                    content: promptAssetVersions.content,
                    changeNote: promptAssetVersions.changeNote,
                    contentHash: promptAssetVersions.contentHash,
                    operationType: promptAssetVersions.operationType,
                    sourceVersionId: promptAssetVersions.sourceVersionId,
                    createdBy: promptAssetVersions.createdBy,
                    createdAt: promptAssetVersions.createdAt,
                })
                .from(promptAssetVersions)
                .innerJoin(
                    promptAssets,
                    and(
                        eq(promptAssets.id, promptAssetVersions.assetId),
                        eq(promptAssets.currentVersionNumber, promptAssetVersions.versionNumber)
                    )
                )
                .where(
                    and(
                        eq(promptAssetVersions.workspaceId, workspaceId),
                        eq(promptAssetVersions.assetId, assetId)
                    )
                )
                .get() ?? null
        );
    }

    findVersionById(
        workspaceId: string,
        assetId: string,
        versionId: string
    ): PromptAssetVersionRow | null {
        return (
            this.db
                .select({
                    id: promptAssetVersions.id,
                    assetId: promptAssetVersions.assetId,
                    workspaceId: promptAssetVersions.workspaceId,
                    versionNumber: promptAssetVersions.versionNumber,
                    nameSnapshot: promptAssetVersions.nameSnapshot,
                    descriptionSnapshot: promptAssetVersions.descriptionSnapshot,
                    content: promptAssetVersions.content,
                    changeNote: promptAssetVersions.changeNote,
                    contentHash: promptAssetVersions.contentHash,
                    operationType: promptAssetVersions.operationType,
                    sourceVersionId: promptAssetVersions.sourceVersionId,
                    createdBy: promptAssetVersions.createdBy,
                    createdAt: promptAssetVersions.createdAt,
                })
                .from(promptAssetVersions)
                .where(
                    and(
                        eq(promptAssetVersions.workspaceId, workspaceId),
                        eq(promptAssetVersions.assetId, assetId),
                        eq(promptAssetVersions.id, versionId)
                    )
                )
                .get() ?? null
        );
    }

    listVersions(
        workspaceId: string,
        assetId: string,
        params: PaginationParams
    ): PaginatedResult<PromptAssetVersionRow> {
        const offset = (params.page - 1) * params.pageSize;

        const items = this.db
            .select({
                id: promptAssetVersions.id,
                assetId: promptAssetVersions.assetId,
                workspaceId: promptAssetVersions.workspaceId,
                versionNumber: promptAssetVersions.versionNumber,
                nameSnapshot: promptAssetVersions.nameSnapshot,
                descriptionSnapshot: promptAssetVersions.descriptionSnapshot,
                content: promptAssetVersions.content,
                changeNote: promptAssetVersions.changeNote,
                contentHash: promptAssetVersions.contentHash,
                operationType: promptAssetVersions.operationType,
                sourceVersionId: promptAssetVersions.sourceVersionId,
                createdBy: promptAssetVersions.createdBy,
                createdAt: promptAssetVersions.createdAt,
            })
            .from(promptAssetVersions)
            .where(
                and(eq(promptAssetVersions.workspaceId, workspaceId), eq(promptAssetVersions.assetId, assetId))
            )
            .orderBy(desc(promptAssetVersions.versionNumber))
            .limit(params.pageSize)
            .offset(offset)
            .all();

        const totalRow = this.db
            .select({
                total: sql<number>`count(*)`,
            })
            .from(promptAssetVersions)
            .where(
                and(eq(promptAssetVersions.workspaceId, workspaceId), eq(promptAssetVersions.assetId, assetId))
            )
            .get();

        return {
            items,
            total: Number(totalRow?.total ?? 0),
            page: params.page,
            pageSize: params.pageSize,
        };
    }

    createAssetWithVersion(input: CreateAssetTxInput): void {
        this.db
            .insert(promptAssets)
            .values({
                id: input.asset.id,
                workspaceId: input.asset.workspaceId,
                name: input.asset.name,
                normalizedName: input.asset.normalizedName,
                description: input.asset.description,
                currentVersionNumber: input.asset.currentVersionNumber,
                status: input.asset.status,
                createdBy: input.asset.createdBy,
                updatedBy: input.asset.updatedBy,
                createdAt: input.asset.createdAt,
                updatedAt: input.asset.updatedAt,
                archivedAt: input.asset.archivedAt,
            })
            .run();

        this.db
            .insert(promptAssetVersions)
            .values({
                id: input.version.id,
                assetId: input.version.assetId,
                workspaceId: input.version.workspaceId,
                versionNumber: input.version.versionNumber,
                nameSnapshot: input.version.nameSnapshot,
                descriptionSnapshot: input.version.descriptionSnapshot,
                content: input.version.content,
                changeNote: input.version.changeNote,
                contentHash: input.version.contentHash,
                operationType: input.version.operationType,
                sourceVersionId: input.version.sourceVersionId,
                createdBy: input.version.createdBy,
                createdAt: input.version.createdAt,
            })
            .run();
    }

    appendVersion(input: AppendVersionTxInput): void {
        this.db
            .insert(promptAssetVersions)
            .values({
                id: input.version.id,
                assetId: input.version.assetId,
                workspaceId: input.version.workspaceId,
                versionNumber: input.version.versionNumber,
                nameSnapshot: input.version.nameSnapshot,
                descriptionSnapshot: input.version.descriptionSnapshot,
                content: input.version.content,
                changeNote: input.version.changeNote,
                contentHash: input.version.contentHash,
                operationType: input.version.operationType,
                sourceVersionId: input.version.sourceVersionId,
                createdBy: input.version.createdBy,
                createdAt: input.version.createdAt,
            })
            .run();

        this.db
            .update(promptAssets)
            .set({
                name: input.name,
                normalizedName: input.normalizedName,
                description: input.description,
                currentVersionNumber: input.currentVersionNumber,
                updatedBy: input.updatedBy,
                updatedAt: input.updatedAt,
            })
            .where(and(eq(promptAssets.workspaceId, input.workspaceId), eq(promptAssets.id, input.assetId)))
            .run();
    }

    updateArchiveStatus(input: UpdateArchiveStatusTxInput): void {
        this.db
            .update(promptAssets)
            .set({
                status: input.status,
                archivedAt: input.archivedAt,
                updatedBy: input.updatedBy,
                updatedAt: input.updatedAt,
            })
            .where(and(eq(promptAssets.workspaceId, input.workspaceId), eq(promptAssets.id, input.id)))
            .run();
    }
}
