import { and, desc, eq, like, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { promptAssets, promptAssetVersions } from '../db/schema/prompt-assets';
import type { PromptAssetOperationType, PromptAssetStatus } from './dto';

type PromptAssetDatabase = BetterSQLite3Database<{
    promptAssets: typeof promptAssets;
    promptAssetVersions: typeof promptAssetVersions;
}>;

export interface PromptAssetRow {
    id: string;
    name: string;
    description: string;
    currentVersionNumber: number;
    status: PromptAssetStatus;
    createdAt: number;
    updatedAt: number;
    archivedAt: number | null;
}

export interface PromptAssetVersionRow {
    id: string;
    assetId: string;
    versionNumber: number;
    nameSnapshot: string;
    descriptionSnapshot: string;
    content: string;
    changeNote: string | null;
    contentHash: string;
    operationType: PromptAssetOperationType;
    sourceVersionId: string | null;
    createdAt: number;
}

export interface PaginatedResult<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
}

export interface ListPromptAssetsParams {
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
    name: string;
    description: string;
    currentVersionNumber: number;
    updatedAt: number;
    version: PromptAssetVersionRow;
}

export interface UpdateArchiveStatusTxInput {
    id: string;
    status: PromptAssetStatus;
    archivedAt: number | null;
    updatedAt: number;
}

export class PromptAssetRepository {
    constructor(private readonly db: PromptAssetDatabase) {}

    list(params: ListPromptAssetsParams): PaginatedResult<PromptAssetRow> {
        const conditions = [];
        const offset = (params.page - 1) * params.pageSize;

        if (params.status !== 'all') {
            conditions.push(eq(promptAssets.status, params.status));
        }

        if (params.query) {
            conditions.push(like(promptAssets.name, `%${params.query}%`));
        }

        const whereClause =
            conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions);

        const selectQuery = this.db
            .select({
                id: promptAssets.id,
                name: promptAssets.name,
                description: promptAssets.description,
                currentVersionNumber: promptAssets.currentVersionNumber,
                status: promptAssets.status,
                createdAt: promptAssets.createdAt,
                updatedAt: promptAssets.updatedAt,
                archivedAt: promptAssets.archivedAt,
            })
            .from(promptAssets);

        const countQuery = this.db
            .select({
                total: sql<number>`count(*)`,
            })
            .from(promptAssets);

        const items = (whereClause ? selectQuery.where(whereClause) : selectQuery)
            .orderBy(desc(promptAssets.updatedAt))
            .limit(params.pageSize)
            .offset(offset)
            .all();

        const totalRow = (whereClause ? countQuery.where(whereClause) : countQuery).get();

        return {
            items: items.map((item) => ({
                ...item,
                archivedAt: item.archivedAt ?? null,
            })),
            total: Number(totalRow?.total ?? 0),
            page: params.page,
            pageSize: params.pageSize,
        };
    }

    findAssetById(id: string): PromptAssetRow | null {
        const row = this.db
            .select({
                id: promptAssets.id,
                name: promptAssets.name,
                description: promptAssets.description,
                currentVersionNumber: promptAssets.currentVersionNumber,
                status: promptAssets.status,
                createdAt: promptAssets.createdAt,
                updatedAt: promptAssets.updatedAt,
                archivedAt: promptAssets.archivedAt,
            })
            .from(promptAssets)
            .where(eq(promptAssets.id, id))
            .get();

        if (!row) {
            return null;
        }

        return {
            ...row,
            archivedAt: row.archivedAt ?? null,
        };
    }

    findCurrentVersionByAssetId(assetId: string): PromptAssetVersionRow | null {
        const row = this.db
            .select({
                id: promptAssetVersions.id,
                assetId: promptAssetVersions.assetId,
                versionNumber: promptAssetVersions.versionNumber,
                nameSnapshot: promptAssetVersions.nameSnapshot,
                descriptionSnapshot: promptAssetVersions.descriptionSnapshot,
                content: promptAssetVersions.content,
                changeNote: promptAssetVersions.changeNote,
                contentHash: promptAssetVersions.contentHash,
                operationType: promptAssetVersions.operationType,
                sourceVersionId: promptAssetVersions.sourceVersionId,
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
            .where(eq(promptAssetVersions.assetId, assetId))
            .get();

        return row ?? null;
    }

    findVersionById(assetId: string, versionId: string): PromptAssetVersionRow | null {
        const row = this.db
            .select({
                id: promptAssetVersions.id,
                assetId: promptAssetVersions.assetId,
                versionNumber: promptAssetVersions.versionNumber,
                nameSnapshot: promptAssetVersions.nameSnapshot,
                descriptionSnapshot: promptAssetVersions.descriptionSnapshot,
                content: promptAssetVersions.content,
                changeNote: promptAssetVersions.changeNote,
                contentHash: promptAssetVersions.contentHash,
                operationType: promptAssetVersions.operationType,
                sourceVersionId: promptAssetVersions.sourceVersionId,
                createdAt: promptAssetVersions.createdAt,
            })
            .from(promptAssetVersions)
            .where(
                and(
                    eq(promptAssetVersions.assetId, assetId),
                    eq(promptAssetVersions.id, versionId)
                )
            )
            .get();

        return row ?? null;
    }

    listVersions(assetId: string, params: PaginationParams): PaginatedResult<PromptAssetVersionRow> {
        const offset = (params.page - 1) * params.pageSize;

        const items = this.db
            .select({
                id: promptAssetVersions.id,
                assetId: promptAssetVersions.assetId,
                versionNumber: promptAssetVersions.versionNumber,
                nameSnapshot: promptAssetVersions.nameSnapshot,
                descriptionSnapshot: promptAssetVersions.descriptionSnapshot,
                content: promptAssetVersions.content,
                changeNote: promptAssetVersions.changeNote,
                contentHash: promptAssetVersions.contentHash,
                operationType: promptAssetVersions.operationType,
                sourceVersionId: promptAssetVersions.sourceVersionId,
                createdAt: promptAssetVersions.createdAt,
            })
            .from(promptAssetVersions)
            .where(eq(promptAssetVersions.assetId, assetId))
            .orderBy(desc(promptAssetVersions.versionNumber))
            .limit(params.pageSize)
            .offset(offset)
            .all();

        const totalRow = this.db
            .select({
                total: sql<number>`count(*)`,
            })
            .from(promptAssetVersions)
            .where(eq(promptAssetVersions.assetId, assetId))
            .get();

        return {
            items,
            total: Number(totalRow?.total ?? 0),
            page: params.page,
            pageSize: params.pageSize,
        };
    }

    createAssetWithVersion(input: CreateAssetTxInput): void {
        this.db.insert(promptAssets).values({
            id: input.asset.id,
            name: input.asset.name,
            description: input.asset.description,
            currentVersionNumber: input.asset.currentVersionNumber,
            status: input.asset.status,
            createdAt: input.asset.createdAt,
            updatedAt: input.asset.updatedAt,
            archivedAt: input.asset.archivedAt,
        }).run();

        this.db.insert(promptAssetVersions).values({
            id: input.version.id,
            assetId: input.version.assetId,
            versionNumber: input.version.versionNumber,
            nameSnapshot: input.version.nameSnapshot,
            descriptionSnapshot: input.version.descriptionSnapshot,
            content: input.version.content,
            changeNote: input.version.changeNote,
            contentHash: input.version.contentHash,
            operationType: input.version.operationType,
            sourceVersionId: input.version.sourceVersionId,
            createdAt: input.version.createdAt,
        }).run();
    }

    appendVersion(input: AppendVersionTxInput): void {
        this.db.insert(promptAssetVersions).values({
            id: input.version.id,
            assetId: input.version.assetId,
            versionNumber: input.version.versionNumber,
            nameSnapshot: input.version.nameSnapshot,
            descriptionSnapshot: input.version.descriptionSnapshot,
            content: input.version.content,
            changeNote: input.version.changeNote,
            contentHash: input.version.contentHash,
            operationType: input.version.operationType,
            sourceVersionId: input.version.sourceVersionId,
            createdAt: input.version.createdAt,
        }).run();

        this.db
            .update(promptAssets)
            .set({
                name: input.name,
                description: input.description,
                currentVersionNumber: input.currentVersionNumber,
                updatedAt: input.updatedAt,
            })
            .where(eq(promptAssets.id, input.assetId))
            .run();
    }

    updateArchiveStatus(input: UpdateArchiveStatusTxInput): void {
        this.db
            .update(promptAssets)
            .set({
                status: input.status,
                archivedAt: input.archivedAt,
                updatedAt: input.updatedAt,
            })
            .where(eq(promptAssets.id, input.id))
            .run();
    }
}
