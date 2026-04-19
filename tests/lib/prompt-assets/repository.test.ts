// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPromptAssetDatabaseContext, type PromptAssetDatabaseContext } from '../../../app/lib/db/client';
import { users, workspaces, workspaceMemberships } from '../../../app/lib/db/schema';
import { PromptAssetRepository } from '../../../app/lib/prompt-assets/repository';

const WORKSPACE_ID = 'workspace-1';
const USER_ID = 'user-1';

describe('PromptAssetRepository', () => {
    let database: PromptAssetDatabaseContext;
    let repository: PromptAssetRepository;

    beforeEach(() => {
        database = createPromptAssetDatabaseContext({ fileName: ':memory:' });
        repository = new PromptAssetRepository(database.db);

        database.db.insert(users).values({
            id: USER_ID,
            logtoUserId: 'logto-user-1',
            email: 'user@example.com',
            name: 'User',
            status: 'active',
            lastLoginAt: 1,
            createdAt: 1,
            updatedAt: 1,
        }).run();

        database.db.insert(workspaces).values({
            id: WORKSPACE_ID,
            type: 'personal',
            name: 'Workspace 1',
            slug: 'workspace-1',
            ownerUserId: USER_ID,
            logtoOrganizationId: null,
            status: 'active',
            createdAt: 1,
            updatedAt: 1,
        }).run();

        database.db.insert(workspaceMemberships).values({
            id: 'membership-1',
            workspaceId: WORKSPACE_ID,
            userId: USER_ID,
            role: 'owner',
            status: 'active',
            joinedAt: 1,
            invitedBy: USER_ID,
            createdAt: 1,
            updatedAt: 1,
        }).run();
    });

    afterEach(() => {
        database.client.close();
    });

    it('lists assets with pagination and updatedAt desc ordering', () => {
        repository.createAssetWithVersion({
            asset: {
                id: 'asset-1',
                workspaceId: WORKSPACE_ID,
                name: 'First',
                normalizedName: 'first',
                description: 'First asset',
                currentVersionNumber: 1,
                status: 'active',
                createdBy: USER_ID,
                updatedBy: USER_ID,
                createdAt: 100,
                updatedAt: 100,
                archivedAt: null,
            },
            version: {
                id: 'version-1',
                assetId: 'asset-1',
                workspaceId: WORKSPACE_ID,
                versionNumber: 1,
                nameSnapshot: 'First',
                descriptionSnapshot: 'First asset',
                content: 'First content',
                changeNote: null,
                contentHash: 'hash-1',
                operationType: 'create',
                sourceVersionId: null,
                createdBy: USER_ID,
                createdAt: 100,
            },
        });

        repository.createAssetWithVersion({
            asset: {
                id: 'asset-2',
                workspaceId: WORKSPACE_ID,
                name: 'Second',
                normalizedName: 'second',
                description: 'Second asset',
                currentVersionNumber: 1,
                status: 'active',
                createdBy: USER_ID,
                updatedBy: USER_ID,
                createdAt: 200,
                updatedAt: 200,
                archivedAt: null,
            },
            version: {
                id: 'version-2',
                assetId: 'asset-2',
                workspaceId: WORKSPACE_ID,
                versionNumber: 1,
                nameSnapshot: 'Second',
                descriptionSnapshot: 'Second asset',
                content: 'Second content',
                changeNote: null,
                contentHash: 'hash-2',
                operationType: 'create',
                sourceVersionId: null,
                createdBy: USER_ID,
                createdAt: 200,
            },
        });

        const pageOne = repository.list({
            workspaceId: WORKSPACE_ID,
            status: 'all',
            page: 1,
            pageSize: 1,
        });

        expect(pageOne.total).toBe(2);
        expect(pageOne.items).toHaveLength(1);
        expect(pageOne.items[0].id).toBe('asset-2');

        const pageTwo = repository.list({
            workspaceId: WORKSPACE_ID,
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
                workspaceId: WORKSPACE_ID,
                name: 'Prompt',
                normalizedName: 'prompt',
                description: '',
                currentVersionNumber: 3,
                status: 'active',
                createdBy: USER_ID,
                updatedBy: USER_ID,
                createdAt: 100,
                updatedAt: 300,
                archivedAt: null,
            },
            version: {
                id: 'version-1',
                assetId: 'asset-1',
                workspaceId: WORKSPACE_ID,
                versionNumber: 1,
                nameSnapshot: 'Prompt',
                descriptionSnapshot: '',
                content: 'v1',
                changeNote: null,
                contentHash: 'hash-1',
                operationType: 'create',
                sourceVersionId: null,
                createdBy: USER_ID,
                createdAt: 100,
            },
        });

        repository.appendVersion({
            assetId: 'asset-1',
            workspaceId: WORKSPACE_ID,
            name: 'Prompt',
            normalizedName: 'prompt',
            description: '',
            currentVersionNumber: 2,
            updatedBy: USER_ID,
            updatedAt: 200,
            version: {
                id: 'version-2',
                assetId: 'asset-1',
                workspaceId: WORKSPACE_ID,
                versionNumber: 2,
                nameSnapshot: 'Prompt',
                descriptionSnapshot: '',
                content: 'v2',
                changeNote: null,
                contentHash: 'hash-2',
                operationType: 'update',
                sourceVersionId: null,
                createdBy: USER_ID,
                createdAt: 200,
            },
        });

        repository.appendVersion({
            assetId: 'asset-1',
            workspaceId: WORKSPACE_ID,
            name: 'Prompt',
            normalizedName: 'prompt',
            description: '',
            currentVersionNumber: 3,
            updatedBy: USER_ID,
            updatedAt: 300,
            version: {
                id: 'version-3',
                assetId: 'asset-1',
                workspaceId: WORKSPACE_ID,
                versionNumber: 3,
                nameSnapshot: 'Prompt',
                descriptionSnapshot: '',
                content: 'v3',
                changeNote: null,
                contentHash: 'hash-3',
                operationType: 'update',
                sourceVersionId: null,
                createdBy: USER_ID,
                createdAt: 300,
            },
        });

        const result = repository.listVersions(WORKSPACE_ID, 'asset-1', { page: 1, pageSize: 10 });
        expect(result.items.map((item) => item.versionNumber)).toEqual([3, 2, 1]);
    });

    it('does not return a version that belongs to another asset', () => {
        repository.createAssetWithVersion({
            asset: {
                id: 'asset-1',
                workspaceId: WORKSPACE_ID,
                name: 'First',
                normalizedName: 'first',
                description: '',
                currentVersionNumber: 1,
                status: 'active',
                createdBy: USER_ID,
                updatedBy: USER_ID,
                createdAt: 100,
                updatedAt: 100,
                archivedAt: null,
            },
            version: {
                id: 'version-1',
                assetId: 'asset-1',
                workspaceId: WORKSPACE_ID,
                versionNumber: 1,
                nameSnapshot: 'First',
                descriptionSnapshot: '',
                content: 'v1',
                changeNote: null,
                contentHash: 'hash-1',
                operationType: 'create',
                sourceVersionId: null,
                createdBy: USER_ID,
                createdAt: 100,
            },
        });

        repository.createAssetWithVersion({
            asset: {
                id: 'asset-2',
                workspaceId: WORKSPACE_ID,
                name: 'Second',
                normalizedName: 'second',
                description: '',
                currentVersionNumber: 1,
                status: 'active',
                createdBy: USER_ID,
                updatedBy: USER_ID,
                createdAt: 200,
                updatedAt: 200,
                archivedAt: null,
            },
            version: {
                id: 'version-2',
                assetId: 'asset-2',
                workspaceId: WORKSPACE_ID,
                versionNumber: 1,
                nameSnapshot: 'Second',
                descriptionSnapshot: '',
                content: 'v1',
                changeNote: null,
                contentHash: 'hash-2',
                operationType: 'create',
                sourceVersionId: null,
                createdBy: USER_ID,
                createdAt: 200,
            },
        });

        expect(repository.findVersionById(WORKSPACE_ID, 'asset-1', 'version-2')).toBeNull();
    });
});
