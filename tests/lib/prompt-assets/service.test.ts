// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPromptAssetDatabaseContext, type PromptAssetDatabaseContext } from '../../../app/lib/db/client';
import type { Principal } from '../../../app/lib/auth/principal';
import { users, workspaces, workspaceMemberships } from '../../../app/lib/db/schema';
import { PromptAssetRepository } from '../../../app/lib/prompt-assets/repository';
import { PromptAssetService } from '../../../app/lib/prompt-assets/service';

const principal: Principal = {
    userId: 'user-1',
    logtoUserId: 'logto-user-1',
    email: 'user@example.com',
    name: 'User',
    avatarUrl: null,
    activeWorkspaceId: 'workspace-1',
    activeWorkspaceSlug: 'workspace-1',
    activeWorkspaceName: 'Workspace 1',
    activeWorkspaceType: 'personal',
    workspaceRole: 'owner',
    permissions: [
        'project:read',
        'project:write',
        'project:delete',
        'prompt_asset:read',
        'prompt_asset:write',
        'prompt_asset:archive',
        'credential:read_meta',
        'credential:use',
        'credential:manage',
        'member:read',
        'member:manage',
        'workspace:manage',
    ],
};

describe('PromptAssetService', () => {
    let database: PromptAssetDatabaseContext;
    let service: PromptAssetService;

    beforeEach(() => {
        database = createPromptAssetDatabaseContext({ fileName: ':memory:' });
        database.db.insert(users).values({
            id: principal.userId,
            logtoUserId: principal.logtoUserId,
            email: principal.email,
            name: principal.name,
            status: 'active',
            lastLoginAt: 1,
            createdAt: 1,
            updatedAt: 1,
        }).run();
        database.db.insert(workspaces).values({
            id: principal.activeWorkspaceId,
            type: 'personal',
            name: principal.activeWorkspaceName,
            slug: principal.activeWorkspaceSlug,
            ownerUserId: principal.userId,
            logtoOrganizationId: null,
            status: 'active',
            createdAt: 1,
            updatedAt: 1,
        }).run();
        database.db.insert(workspaceMemberships).values({
            id: 'membership-1',
            workspaceId: principal.activeWorkspaceId,
            userId: principal.userId,
            role: principal.workspaceRole,
            status: 'active',
            joinedAt: 1,
            invitedBy: principal.userId,
            createdAt: 1,
            updatedAt: 1,
        }).run();
        service = new PromptAssetService({
            database,
            repository: new PromptAssetRepository(database.db),
        });
    });

    afterEach(() => {
        database.client.close();
    });

    it('creates an asset with v1 current version', async () => {
        const asset = await service.createPromptAsset(principal, {
            name: 'Code Review',
            description: 'Review prompt',
            content: 'You are a rigorous reviewer',
            changeNote: 'Initial version',
        });

        expect(asset.name).toBe('Code Review');
        expect(asset.currentVersionNumber).toBe(1);
        expect(asset.status).toBe('active');
        expect(asset.currentVersion.versionNumber).toBe(1);
        expect(asset.currentVersion.operationType).toBe('create');
        expect(asset.currentVersion.content).toBe('You are a rigorous reviewer');
    });

    it('creates a new version and rejects no-op updates', async () => {
        const asset = await service.createPromptAsset(principal, {
            name: 'Code Review',
            description: 'Review prompt',
            content: 'You are a rigorous reviewer',
            changeNote: 'Initial version',
        });

        const updated = await service.createPromptAssetVersion(principal, asset.id, {
            name: 'Code Review',
            description: 'Review prompt',
            content: 'You are a strict and pragmatic reviewer',
            changeNote: 'Refined instructions',
            expectedVersionNumber: 1,
        });

        expect(updated.currentVersionNumber).toBe(2);
        expect(updated.currentVersion.versionNumber).toBe(2);
        expect(updated.currentVersion.operationType).toBe('update');

        await expect(
            service.createPromptAssetVersion(principal, asset.id, {
                name: 'Code Review',
                description: 'Review prompt',
                content: 'You are a strict and pragmatic reviewer',
                changeNote: 'Duplicate content',
                expectedVersionNumber: 2,
            })
        ).rejects.toMatchObject({
            code: 'PROMPT_ASSET_NO_CHANGES',
            status: 409,
        });
    });

    it('restores a historical version as a new restore version', async () => {
        const asset = await service.createPromptAsset(principal, {
            name: 'Reviewer',
            description: 'v1',
            content: 'Version 1',
        });

        const updated = await service.createPromptAssetVersion(principal, asset.id, {
            name: 'Reviewer',
            description: 'v2',
            content: 'Version 2',
            expectedVersionNumber: 1,
        });

        const restored = await service.restorePromptAssetVersion(principal, asset.id, {
            versionId: asset.currentVersion.id,
            changeNote: 'Rollback to v1',
            expectedVersionNumber: updated.currentVersionNumber,
        });

        expect(restored.currentVersionNumber).toBe(3);
        expect(restored.currentVersion.operationType).toBe('restore');
        expect(restored.currentVersion.sourceVersionId).toBe(asset.currentVersion.id);
        expect(restored.currentVersion.content).toBe('Version 1');
        expect(restored.description).toBe('v1');
    });

    it('archives and unarchives assets, blocking version creation while archived', async () => {
        const asset = await service.createPromptAsset(principal, {
            name: 'Ops Prompt',
            description: 'Ops',
            content: 'Initial',
        });

        const archived = await service.archivePromptAsset(principal, asset.id);
        expect(archived.status).toBe('archived');
        expect(archived.archivedAt).not.toBeNull();

        await expect(
            service.createPromptAssetVersion(principal, asset.id, {
                name: 'Ops Prompt',
                description: 'Ops',
                content: 'Changed',
                expectedVersionNumber: 1,
            })
        ).rejects.toMatchObject({
            code: 'PROMPT_ASSET_ARCHIVED',
            status: 409,
        });

        const unarchived = await service.unarchivePromptAsset(principal, asset.id);
        expect(unarchived.status).toBe('active');
        expect(unarchived.archivedAt).toBeNull();
    });

    it('rejects version updates when expectedVersionNumber mismatches', async () => {
        const asset = await service.createPromptAsset(principal, {
            name: 'Conflict Prompt',
            description: 'Conflict',
            content: 'Initial',
        });

        await expect(
            service.createPromptAssetVersion(principal, asset.id, {
                name: 'Conflict Prompt',
                description: 'Conflict',
                content: 'Changed',
                expectedVersionNumber: 9,
            })
        ).rejects.toMatchObject({
            code: 'PROMPT_ASSET_VERSION_CONFLICT',
            status: 409,
            details: {
                expectedVersionNumber: 9,
                actualVersionNumber: 1,
            },
        });
    });
});
