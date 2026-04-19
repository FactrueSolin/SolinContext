import { createHash } from 'crypto';
import { ulid } from 'ulid';
import {
    createPromptAssetDatabaseContext,
    getPromptAssetDatabaseContext,
    type PromptAssetDatabaseContext,
} from '../db/client';
import type {
    PaginatedData,
    PromptAssetDetail,
    PromptAssetSummary,
    PromptAssetVersionItem,
} from './dto';
import {
    promptAssetArchived,
    promptAssetInternalError,
    promptAssetNoChanges,
    promptAssetNotFound,
    promptAssetValidationFailed,
    promptAssetVersionConflict,
    promptAssetVersionNotFound,
} from './errors';
import {
    PromptAssetRepository,
    type PromptAssetRow,
    type PromptAssetVersionRow,
} from './repository';
import {
    createPromptAssetSchema,
    createPromptAssetVersionSchema,
    listPromptAssetsQuerySchema,
    promptAssetVersionsQuerySchema,
    restorePromptAssetVersionSchema,
    type CreatePromptAssetInput,
    type CreatePromptAssetVersionInput,
    type ListPromptAssetsQuery,
    type PromptAssetVersionsQuery,
    type RestorePromptAssetVersionInput,
} from './validators';
import type { Principal } from '../auth/principal';
import { arePromptAssetTagSetsEqual } from './tags';

function hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex');
}

function normalizeName(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export interface PromptAssetServiceOptions {
    database?: PromptAssetDatabaseContext;
    repository?: PromptAssetRepository;
}

export class PromptAssetService {
    private readonly database: PromptAssetDatabaseContext;
    private readonly repository: PromptAssetRepository;

    constructor(options: PromptAssetServiceOptions = {}) {
        this.database = options.database ?? getPromptAssetDatabaseContext();
        this.repository = options.repository ?? new PromptAssetRepository(this.database.db as never);
    }

    async listPromptAssets(
        principal: Principal,
        input: ListPromptAssetsQuery
    ): Promise<PaginatedData<PromptAssetSummary>> {
        const params = this.parseWithSchema(listPromptAssetsQuerySchema, input);
        const result = this.repository.list({
            workspaceId: principal.activeWorkspaceId,
            ...params,
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

    async createPromptAsset(
        principal: Principal,
        input: CreatePromptAssetInput
    ): Promise<PromptAssetDetail> {
        const params = this.parseWithSchema(createPromptAssetSchema, input);
        const now = Date.now();
        const assetId = ulid();
        const versionId = ulid();

        const asset: PromptAssetRow = {
            id: assetId,
            workspaceId: principal.activeWorkspaceId,
            name: params.name,
            normalizedName: normalizeName(params.name),
            description: params.description,
            tags: params.tags,
            currentVersionNumber: 1,
            status: 'active',
            createdBy: principal.userId,
            updatedBy: principal.userId,
            createdAt: now,
            updatedAt: now,
            archivedAt: null,
        };

        const version: PromptAssetVersionRow = {
            id: versionId,
            assetId,
            workspaceId: principal.activeWorkspaceId,
            versionNumber: 1,
            nameSnapshot: params.name,
            descriptionSnapshot: params.description,
            tagsSnapshot: params.tags,
            content: params.content,
            changeNote: params.changeNote ?? null,
            contentHash: hashContent(params.content),
            operationType: 'create',
            sourceVersionId: null,
            createdBy: principal.userId,
            createdAt: now,
        };

        this.database.client.transaction(() => {
            this.repository.createAssetWithVersion({ asset, version });
        })();

        return this.getPromptAssetDetail(principal, assetId);
    }

    async getPromptAssetDetail(principal: Principal, assetId: string): Promise<PromptAssetDetail> {
        const asset = this.requireAsset(principal.activeWorkspaceId, assetId);
        const currentVersion = this.requireCurrentVersion(principal.activeWorkspaceId, asset.id);

        return this.mapDetail(asset, currentVersion);
    }

    async createPromptAssetVersion(
        principal: Principal,
        assetId: string,
        input: CreatePromptAssetVersionInput
    ): Promise<PromptAssetDetail> {
        const params = this.parseWithSchema(createPromptAssetVersionSchema, input);
        const asset = this.requireAsset(principal.activeWorkspaceId, assetId);
        const currentVersion = this.requireCurrentVersion(principal.activeWorkspaceId, assetId);

        if (asset.status === 'archived') {
            throw promptAssetArchived(assetId);
        }

        if (asset.currentVersionNumber !== params.expectedVersionNumber) {
            throw promptAssetVersionConflict(
                assetId,
                params.expectedVersionNumber,
                asset.currentVersionNumber
            );
        }

        const nextContentHash = hashContent(params.content);
        const hasNoChanges =
            currentVersion.nameSnapshot === params.name &&
            currentVersion.descriptionSnapshot === params.description &&
            arePromptAssetTagSetsEqual(currentVersion.tagsSnapshot, params.tags) &&
            currentVersion.contentHash === nextContentHash;

        if (hasNoChanges) {
            throw promptAssetNoChanges(assetId);
        }

        const nextVersionNumber = asset.currentVersionNumber + 1;
        const now = Date.now();

        this.database.client.transaction(() => {
            this.repository.appendVersion({
                assetId,
                workspaceId: principal.activeWorkspaceId,
                name: params.name,
                normalizedName: normalizeName(params.name),
                description: params.description,
                tags: params.tags,
                currentVersionNumber: nextVersionNumber,
                updatedBy: principal.userId,
                updatedAt: now,
                version: {
                    id: ulid(),
                    assetId,
                    workspaceId: principal.activeWorkspaceId,
                    versionNumber: nextVersionNumber,
                    nameSnapshot: params.name,
                    descriptionSnapshot: params.description,
                    tagsSnapshot: params.tags,
                    content: params.content,
                    changeNote: params.changeNote ?? null,
                    contentHash: nextContentHash,
                    operationType: 'update',
                    sourceVersionId: null,
                    createdBy: principal.userId,
                    createdAt: now,
                },
            });
        })();

        return this.getPromptAssetDetail(principal, assetId);
    }

    async listPromptAssetVersions(
        principal: Principal,
        assetId: string,
        input: PromptAssetVersionsQuery
    ): Promise<PaginatedData<PromptAssetVersionItem>> {
        this.requireAsset(principal.activeWorkspaceId, assetId);
        const params = this.parseWithSchema(promptAssetVersionsQuerySchema, input);
        const result = this.repository.listVersions(principal.activeWorkspaceId, assetId, params);

        return {
            items: result.items.map((item) => this.mapVersion(item)),
            pagination: {
                page: result.page,
                pageSize: result.pageSize,
                total: result.total,
            },
        };
    }

    async getPromptAssetVersion(
        principal: Principal,
        assetId: string,
        versionId: string
    ): Promise<PromptAssetVersionItem> {
        this.requireAsset(principal.activeWorkspaceId, assetId);
        const version = this.repository.findVersionById(principal.activeWorkspaceId, assetId, versionId);

        if (!version) {
            throw promptAssetVersionNotFound(versionId);
        }

        return this.mapVersion(version);
    }

    async restorePromptAssetVersion(
        principal: Principal,
        assetId: string,
        input: RestorePromptAssetVersionInput
    ): Promise<PromptAssetDetail> {
        const params = this.parseWithSchema(restorePromptAssetVersionSchema, input);
        const asset = this.requireAsset(principal.activeWorkspaceId, assetId);

        if (asset.status === 'archived') {
            throw promptAssetArchived(assetId);
        }

        if (asset.currentVersionNumber !== params.expectedVersionNumber) {
            throw promptAssetVersionConflict(
                assetId,
                params.expectedVersionNumber,
                asset.currentVersionNumber
            );
        }

        const sourceVersion = this.repository.findVersionById(
            principal.activeWorkspaceId,
            assetId,
            params.versionId
        );
        if (!sourceVersion) {
            throw promptAssetVersionNotFound(params.versionId);
        }

        const nextVersionNumber = asset.currentVersionNumber + 1;
        const now = Date.now();

        this.database.client.transaction(() => {
            this.repository.appendVersion({
                assetId,
                workspaceId: principal.activeWorkspaceId,
                name: sourceVersion.nameSnapshot,
                normalizedName: normalizeName(sourceVersion.nameSnapshot),
                description: sourceVersion.descriptionSnapshot,
                tags: sourceVersion.tagsSnapshot,
                currentVersionNumber: nextVersionNumber,
                updatedBy: principal.userId,
                updatedAt: now,
                version: {
                    id: ulid(),
                    assetId,
                    workspaceId: principal.activeWorkspaceId,
                    versionNumber: nextVersionNumber,
                    nameSnapshot: sourceVersion.nameSnapshot,
                    descriptionSnapshot: sourceVersion.descriptionSnapshot,
                    tagsSnapshot: sourceVersion.tagsSnapshot,
                    content: sourceVersion.content,
                    changeNote: params.changeNote ?? null,
                    contentHash: sourceVersion.contentHash,
                    operationType: 'restore',
                    sourceVersionId: sourceVersion.id,
                    createdBy: principal.userId,
                    createdAt: now,
                },
            });
        })();

        return this.getPromptAssetDetail(principal, assetId);
    }

    async archivePromptAsset(principal: Principal, assetId: string): Promise<PromptAssetSummary> {
        const asset = this.requireAsset(principal.activeWorkspaceId, assetId);

        if (asset.status === 'archived') {
            return this.mapSummary(asset);
        }

        const now = Date.now();
        this.repository.updateArchiveStatus({
            id: assetId,
            workspaceId: principal.activeWorkspaceId,
            status: 'archived',
            archivedAt: now,
            updatedBy: principal.userId,
            updatedAt: now,
        });

        return this.mapSummary(this.requireAsset(principal.activeWorkspaceId, assetId));
    }

    async unarchivePromptAsset(principal: Principal, assetId: string): Promise<PromptAssetSummary> {
        const asset = this.requireAsset(principal.activeWorkspaceId, assetId);

        if (asset.status === 'active') {
            return this.mapSummary(asset);
        }

        const now = Date.now();
        this.repository.updateArchiveStatus({
            id: assetId,
            workspaceId: principal.activeWorkspaceId,
            status: 'active',
            archivedAt: null,
            updatedBy: principal.userId,
            updatedAt: now,
        });

        return this.mapSummary(this.requireAsset(principal.activeWorkspaceId, assetId));
    }

    private parseWithSchema<TInput, TOutput>(
        schema: {
            safeParse: (
                value: TInput
            ) => { success: true; data: TOutput } | { success: false; error: { flatten: () => unknown } };
        },
        value: TInput
    ): TOutput {
        const result = schema.safeParse(value);
        if (!result.success) {
            throw promptAssetValidationFailed(result.error.flatten());
        }

        return result.data;
    }

    private requireAsset(workspaceId: string, assetId: string): PromptAssetRow {
        const asset = this.repository.findAssetById(workspaceId, assetId);

        if (!asset) {
            throw promptAssetNotFound(assetId);
        }

        return asset;
    }

    private requireCurrentVersion(workspaceId: string, assetId: string): PromptAssetVersionRow {
        const version = this.repository.findCurrentVersionByAssetId(workspaceId, assetId);

        if (!version) {
            throw promptAssetInternalError(`Prompt asset "${assetId}" current version is missing`);
        }

        return version;
    }

    private mapSummary(asset: PromptAssetRow): PromptAssetSummary {
        return {
            id: asset.id,
            name: asset.name,
            description: asset.description,
            tags: asset.tags,
            status: asset.status,
            currentVersionNumber: asset.currentVersionNumber,
            createdAt: asset.createdAt,
            updatedAt: asset.updatedAt,
            archivedAt: asset.archivedAt,
        };
    }

    private mapDetail(asset: PromptAssetRow, version: PromptAssetVersionRow): PromptAssetDetail {
        return {
            ...this.mapSummary(asset),
            currentVersion: {
                id: version.id,
            versionNumber: version.versionNumber,
            content: version.content,
            changeNote: version.changeNote,
                operationType: version.operationType,
                sourceVersionId: version.sourceVersionId,
                createdAt: version.createdAt,
            },
        };
    }

    private mapVersion(version: PromptAssetVersionRow): PromptAssetVersionItem {
        return {
            id: version.id,
            assetId: version.assetId,
            versionNumber: version.versionNumber,
            nameSnapshot: version.nameSnapshot,
            descriptionSnapshot: version.descriptionSnapshot,
            tagsSnapshot: version.tagsSnapshot,
            content: version.content,
            changeNote: version.changeNote,
            operationType: version.operationType,
            sourceVersionId: version.sourceVersionId,
            createdAt: version.createdAt,
        };
    }
}

let promptAssetService: PromptAssetService | null = null;

export function getPromptAssetService(): PromptAssetService {
    if (!promptAssetService) {
        promptAssetService = new PromptAssetService({
            database: getPromptAssetDatabaseContext(),
        });
    }

    return promptAssetService;
}

export function createIsolatedPromptAssetService(): PromptAssetService {
    return new PromptAssetService({
        database: createPromptAssetDatabaseContext({ fileName: ':memory:' }),
    });
}
