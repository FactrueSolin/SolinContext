// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPromptAssetDatabaseContext, type PromptAssetDatabaseContext } from '../../../app/lib/db/client';
import { PromptAssetRepository } from '../../../app/lib/prompt-assets/repository';

describe('PromptAssetRepository', () => {
    let database: PromptAssetDatabaseContext;
    let repository: PromptAssetRepository;

    beforeEach(() => {
        database = createPromptAssetDatabaseContext({ fileName: ':memory:' });
        repository = new PromptAssetRepository(database.db);
    });

    afterEach(() => {
        database.client.close();
    });

    it('lists assets with pagination and updatedAt desc ordering', () => {
        repository.createAssetWithVersion({
            asset: {
                id: 'asset-1',
                name: 'First',
                description: 'First asset',
                currentVersionNumber: 1,
                status: 'active',
                createdAt: 100,
                updatedAt: 100,
                archivedAt: null,
            },
            version: {
                id: 'version-1',
                assetId: 'asset-1',
                versionNumber: 1,
                nameSnapshot: 'First',
                descriptionSnapshot: 'First asset',
                content: 'First content',
                changeNote: null,
                contentHash: 'hash-1',
                operationType: 'create',
                sourceVersionId: null,
                createdAt: 100,
            },
        });

        repository.createAssetWithVersion({
            asset: {
                id: 'asset-2',
                name: 'Second',
                description: 'Second asset',
                currentVersionNumber: 1,
                status: 'active',
                createdAt: 200,
                updatedAt: 200,
                archivedAt: null,
            },
            version: {
                id: 'version-2',
                assetId: 'asset-2',
                versionNumber: 1,
                nameSnapshot: 'Second',
                descriptionSnapshot: 'Second asset',
                content: 'Second content',
                changeNote: null,
                contentHash: 'hash-2',
                operationType: 'create',
                sourceVersionId: null,
                createdAt: 200,
            },
        });

        const pageOne = repository.list({
            status: 'all',
            page: 1,
            pageSize: 1,
        });

        expect(pageOne.total).toBe(2);
        expect(pageOne.items).toHaveLength(1);
        expect(pageOne.items[0].id).toBe('asset-2');

        const pageTwo = repository.list({
            status: 'all',
            page: 2,
            pageSize: 1,
        });

        expect(pageTwo.items[0].id).toBe('asset-1');
    });

    it('lists versions in descending versionNumber order', () => {
        repository.createAssetWithVersion({
            asset: {
                id: 'asset-1',
                name: 'Prompt',
                description: '',
                currentVersionNumber: 3,
                status: 'active',
                createdAt: 100,
                updatedAt: 300,
                archivedAt: null,
            },
            version: {
                id: 'version-1',
                assetId: 'asset-1',
                versionNumber: 1,
                nameSnapshot: 'Prompt',
                descriptionSnapshot: '',
                content: 'v1',
                changeNote: null,
                contentHash: 'hash-1',
                operationType: 'create',
                sourceVersionId: null,
                createdAt: 100,
            },
        });

        repository.appendVersion({
            assetId: 'asset-1',
            name: 'Prompt',
            description: '',
            currentVersionNumber: 2,
            updatedAt: 200,
            version: {
                id: 'version-2',
                assetId: 'asset-1',
                versionNumber: 2,
                nameSnapshot: 'Prompt',
                descriptionSnapshot: '',
                content: 'v2',
                changeNote: null,
                contentHash: 'hash-2',
                operationType: 'update',
                sourceVersionId: null,
                createdAt: 200,
            },
        });

        repository.appendVersion({
            assetId: 'asset-1',
            name: 'Prompt',
            description: '',
            currentVersionNumber: 3,
            updatedAt: 300,
            version: {
                id: 'version-3',
                assetId: 'asset-1',
                versionNumber: 3,
                nameSnapshot: 'Prompt',
                descriptionSnapshot: '',
                content: 'v3',
                changeNote: null,
                contentHash: 'hash-3',
                operationType: 'update',
                sourceVersionId: null,
                createdAt: 300,
            },
        });

        const result = repository.listVersions('asset-1', { page: 1, pageSize: 10 });
        expect(result.items.map((item) => item.versionNumber)).toEqual([3, 2, 1]);
    });

    it('does not return a version that belongs to another asset', () => {
        repository.createAssetWithVersion({
            asset: {
                id: 'asset-1',
                name: 'First',
                description: '',
                currentVersionNumber: 1,
                status: 'active',
                createdAt: 100,
                updatedAt: 100,
                archivedAt: null,
            },
            version: {
                id: 'version-1',
                assetId: 'asset-1',
                versionNumber: 1,
                nameSnapshot: 'First',
                descriptionSnapshot: '',
                content: 'v1',
                changeNote: null,
                contentHash: 'hash-1',
                operationType: 'create',
                sourceVersionId: null,
                createdAt: 100,
            },
        });

        repository.createAssetWithVersion({
            asset: {
                id: 'asset-2',
                name: 'Second',
                description: '',
                currentVersionNumber: 1,
                status: 'active',
                createdAt: 200,
                updatedAt: 200,
                archivedAt: null,
            },
            version: {
                id: 'version-2',
                assetId: 'asset-2',
                versionNumber: 1,
                nameSnapshot: 'Second',
                descriptionSnapshot: '',
                content: 'v1',
                changeNote: null,
                contentHash: 'hash-2',
                operationType: 'create',
                sourceVersionId: null,
                createdAt: 200,
            },
        });

        expect(repository.findVersionById('asset-1', 'version-2')).toBeNull();
    });
});
