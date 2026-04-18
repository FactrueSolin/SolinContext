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

function hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex');
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
        this.repository = options.repository ?? new PromptAssetRepository(this.database.db);
    }

    async listPromptAssets(input: ListPromptAssetsQuery): Promise<PaginatedData<PromptAssetSummary>> {
        const params = this.parseWithSchema(listPromptAssetsQuerySchema, input);
        const result = this.repository.list(params);

        return {
            items: result.items.map((item) => this.mapSummary(item)),
            pagination: {
                page: result.page,
                pageSize: result.pageSize,
                total: result.total,
            },
        };
    }

    async createPromptAsset(input: CreatePromptAssetInput): Promise<PromptAssetDetail> {
        const params = this.parseWithSchema(createPromptAssetSchema, input);
        const now = Date.now();
        const assetId = ulid();
        const versionId = ulid();

        const asset: PromptAssetRow = {
            id: assetId,
            name: params.name,
            description: params.description,
            currentVersionNumber: 1,
            status: 'active',
            createdAt: now,
            updatedAt: now,
            archivedAt: null,
        };

        const version: PromptAssetVersionRow = {
            id: versionId,
            assetId,
            versionNumber: 1,
            nameSnapshot: params.name,
            descriptionSnapshot: params.description,
            content: params.content,
            changeNote: params.changeNote ?? null,
            contentHash: hashContent(params.content),
            operationType: 'create',
            sourceVersionId: null,
            createdAt: now,
        };

        this.database.client.transaction(() => {
            this.repository.createAssetWithVersion({ asset, version });
        })();

        return this.getPromptAssetDetail(assetId);
    }

    async getPromptAssetDetail(assetId: string): Promise<PromptAssetDetail> {
        const asset = this.requireAsset(assetId);
        const currentVersion = this.requireCurrentVersion(asset.id);

        return this.mapDetail(asset, currentVersion);
    }

    async createPromptAssetVersion(
        assetId: string,
        input: CreatePromptAssetVersionInput
    ): Promise<PromptAssetDetail> {
        const params = this.parseWithSchema(createPromptAssetVersionSchema, input);
        const asset = this.requireAsset(assetId);
        const currentVersion = this.requireCurrentVersion(assetId);

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
            currentVersion.contentHash === nextContentHash;

        if (hasNoChanges) {
            throw promptAssetNoChanges(assetId);
        }

        const nextVersionNumber = asset.currentVersionNumber + 1;
        const now = Date.now();

        this.database.client.transaction(() => {
            this.repository.appendVersion({
                assetId,
                name: params.name,
                description: params.description,
                currentVersionNumber: nextVersionNumber,
                updatedAt: now,
                version: {
                    id: ulid(),
                    assetId,
                    versionNumber: nextVersionNumber,
                    nameSnapshot: params.name,
                    descriptionSnapshot: params.description,
                    content: params.content,
                    changeNote: params.changeNote ?? null,
                    contentHash: nextContentHash,
                    operationType: 'update',
                    sourceVersionId: null,
                    createdAt: now,
                },
            });
        })();

        return this.getPromptAssetDetail(assetId);
    }

    async listPromptAssetVersions(
        assetId: string,
        input: PromptAssetVersionsQuery
    ): Promise<PaginatedData<PromptAssetVersionItem>> {
        this.requireAsset(assetId);
        const params = this.parseWithSchema(promptAssetVersionsQuerySchema, input);
        const result = this.repository.listVersions(assetId, params);

        return {
            items: result.items.map((item) => this.mapVersion(item)),
            pagination: {
                page: result.page,
                pageSize: result.pageSize,
                total: result.total,
            },
        };
    }

    async getPromptAssetVersion(assetId: string, versionId: string): Promise<PromptAssetVersionItem> {
        this.requireAsset(assetId);
        const version = this.repository.findVersionById(assetId, versionId);

        if (!version) {
            throw promptAssetVersionNotFound(versionId);
        }

        return this.mapVersion(version);
    }

    async restorePromptAssetVersion(
        assetId: string,
        input: RestorePromptAssetVersionInput
    ): Promise<PromptAssetDetail> {
        const params = this.parseWithSchema(restorePromptAssetVersionSchema, input);
        const asset = this.requireAsset(assetId);

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

        const sourceVersion = this.repository.findVersionById(assetId, params.versionId);
        if (!sourceVersion) {
            throw promptAssetVersionNotFound(params.versionId);
        }

        const nextVersionNumber = asset.currentVersionNumber + 1;
        const now = Date.now();

        this.database.client.transaction(() => {
            this.repository.appendVersion({
                assetId,
                name: sourceVersion.nameSnapshot,
                description: sourceVersion.descriptionSnapshot,
                currentVersionNumber: nextVersionNumber,
                updatedAt: now,
                version: {
                    id: ulid(),
                    assetId,
                    versionNumber: nextVersionNumber,
                    nameSnapshot: sourceVersion.nameSnapshot,
                    descriptionSnapshot: sourceVersion.descriptionSnapshot,
                    content: sourceVersion.content,
                    changeNote: params.changeNote ?? null,
                    contentHash: sourceVersion.contentHash,
                    operationType: 'restore',
                    sourceVersionId: sourceVersion.id,
                    createdAt: now,
                },
            });
        })();

        return this.getPromptAssetDetail(assetId);
    }

    async archivePromptAsset(assetId: string): Promise<PromptAssetSummary> {
        const asset = this.requireAsset(assetId);

        if (asset.status === 'archived') {
            return this.mapSummary(asset);
        }

        const now = Date.now();
        this.repository.updateArchiveStatus({
            id: assetId,
            status: 'archived',
            archivedAt: now,
            updatedAt: now,
        });

        return this.mapSummary(this.requireAsset(assetId));
    }

    async unarchivePromptAsset(assetId: string): Promise<PromptAssetSummary> {
        const asset = this.requireAsset(assetId);

        if (asset.status === 'active') {
            return this.mapSummary(asset);
        }

        const now = Date.now();
        this.repository.updateArchiveStatus({
            id: assetId,
            status: 'active',
            archivedAt: null,
            updatedAt: now,
        });

        return this.mapSummary(this.requireAsset(assetId));
    }

    private parseWithSchema<TInput, TOutput>(schema: { safeParse: (value: TInput) => { success: true; data: TOutput } | { success: false; error: { flatten: () => unknown } } }, value: TInput): TOutput {
        const result = schema.safeParse(value);
        if (!result.success) {
            throw promptAssetValidationFailed(result.error.flatten());
        }

        return result.data;
    }

    private requireAsset(assetId: string): PromptAssetRow {
        const asset = this.repository.findAssetById(assetId);

        if (!asset) {
            throw promptAssetNotFound(assetId);
        }

        return asset;
    }

    private requireCurrentVersion(assetId: string): PromptAssetVersionRow {
        const version = this.repository.findCurrentVersionByAssetId(assetId);

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

export function createTestPromptAssetService(): PromptAssetService {
    const database = createPromptAssetDatabaseContext({ fileName: ':memory:' });
    return new PromptAssetService({
        database,
        repository: new PromptAssetRepository(database.db),
    });
}
