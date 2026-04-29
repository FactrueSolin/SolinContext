// @vitest-environment node

import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Principal } from '../../../app/lib/auth/principal';
import { createAppDatabaseContext, type AppDatabaseContext } from '../../../app/lib/db/client';
import { users, workspaces, workspaceMemberships } from '../../../app/lib/db/schema';
import type {
    AigcDetectionClientLike,
} from '../../../app/lib/aigc-detection/client';
import { AigcDetectionService } from '../../../app/lib/aigc-detection/service';

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
    activeWorkspaceStatus: 'active',
    workspaceRole: 'owner',
    permissions: [
        'project:read',
        'project:write',
        'project:delete',
        'aigc_detection:read',
        'aigc_detection:write',
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

class MockAigcDetectionClient implements AigcDetectionClientLike {
    readonly createTask = vi.fn<AigcDetectionClientLike['createTask']>();
    readonly getTaskStatus = vi.fn<AigcDetectionClientLike['getTaskStatus']>();
    readonly getTaskResult = vi.fn<AigcDetectionClientLike['getTaskResult']>();
}

describe('AigcDetectionService', () => {
    let dataDir: string;
    let previousDataDir: string | undefined;
    let database: AppDatabaseContext;
    let client: MockAigcDetectionClient;
    let service: AigcDetectionService;

    beforeEach(() => {
        previousDataDir = process.env.DATA_DIR;
        dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aicontext-aigc-detection-'));
        process.env.DATA_DIR = dataDir;
        process.env.AIGC_DETECTION_SYNC_STALE_MS = '1';
        database = createAppDatabaseContext({ fileName: ':memory:' });
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

        client = new MockAigcDetectionClient();
        service = new AigcDetectionService(database, client);
    });

    afterEach(() => {
        database.client.close();
        fs.rmSync(dataDir, { recursive: true, force: true });

        if (previousDataDir === undefined) {
            delete process.env.DATA_DIR;
        } else {
            process.env.DATA_DIR = previousDataDir;
        }

        delete process.env.AIGC_DETECTION_SYNC_STALE_MS;
    });

    it('creates a task and reuses a succeeded result by sha256', async () => {
        client.createTask.mockResolvedValueOnce({
            taskId: 'external-1',
            status: 'queued',
            deduplicated: false,
            statusUrl: '/status/external-1',
            resultUrl: '/result/external-1',
        });

        const file = new File(['hello world'], 'paper.pdf', { type: 'application/pdf' });
        const firstCreated = await service.createTask(principal, { file, forceReprocess: false });

        expect(firstCreated.reusedResult).toBe(false);
        expect(firstCreated.task.status).toBe('submitted');
        expect(client.createTask).toHaveBeenCalledTimes(1);

        client.getTaskStatus.mockResolvedValueOnce({
            taskId: 'external-1',
            status: 'succeeded',
            stage: 'succeeded',
            progress: null,
            sourceFileName: 'paper.pdf',
            createdAt: '2026-04-29T12:00:00Z',
            updatedAt: '2026-04-29T12:00:02Z',
            error: null,
        });
        client.getTaskResult.mockResolvedValueOnce({
            taskId: 'external-1',
            status: 'succeeded',
            documentResult: {
                documentAiProbability: 0.8,
                label: 'Likely AI generated',
                probabilityMethod: 'trained',
                blockCount: 1,
                scoredBlockCount: 1,
                skippedBlockCount: 0,
                totalCharCount: 11,
                totalTokenCount: 2,
            },
            cleanedDocument: {
                cleanedFullText: 'hello world',
                cleanedBlocks: [{ blockId: 'b1', order: 0, text: 'hello world' }],
            },
            aiSentences: [
                {
                    sentenceId: 's1',
                    blockId: 'b1',
                    order: 0,
                    text: 'hello world',
                    aiProbability: 0.8,
                    label: 'ai',
                    probabilityMethod: 'trained',
                },
            ],
            blocks: [
                {
                    blockId: 'b1',
                    order: 0,
                    pageStart: 1,
                    pageEnd: 1,
                    blockType: 'paragraph',
                    sectionPath: ['body'],
                    text: 'hello world',
                    charCount: 11,
                    tokenCount: 2,
                    aiProbability: 0.8,
                    label: 'ai',
                    probabilityMethod: 'trained',
                },
            ],
        });

        const firstDetail = await service.getTaskDetail(principal, firstCreated.task.id);
        expect(firstDetail.status).toBe('succeeded');

        const secondCreated = await service.createTask(principal, {
            file: new File(['hello world'], 'paper.pdf', { type: 'application/pdf' }),
            forceReprocess: false,
        });

        expect(secondCreated.reusedResult).toBe(true);
        expect(secondCreated.task.status).toBe('succeeded');
        expect(secondCreated.task.deduplicated).toBe(true);
        expect(client.createTask).toHaveBeenCalledTimes(1);
    });

    it('retries a failed task using the cached file', async () => {
        client.createTask
            .mockResolvedValueOnce({
                taskId: 'external-1',
                status: 'queued',
                deduplicated: false,
                statusUrl: '/status/external-1',
                resultUrl: '/result/external-1',
            })
            .mockResolvedValueOnce({
                taskId: 'external-2',
                status: 'queued',
                deduplicated: false,
                statusUrl: '/status/external-2',
                resultUrl: '/result/external-2',
            });

        const created = await service.createTask(principal, {
            file: new File(['retry me'], 'retry.docx', {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            }),
            forceReprocess: false,
        });

        client.getTaskStatus.mockResolvedValueOnce({
            taskId: 'external-1',
            status: 'failed',
            stage: 'failed',
            progress: null,
            sourceFileName: 'retry.docx',
            createdAt: '2026-04-29T12:00:00Z',
            updatedAt: '2026-04-29T12:00:02Z',
            error: { code: 'FAILED', message: 'upstream failed' },
        });

        const failedDetail = await service.getTaskDetail(principal, created.task.id);
        expect(failedDetail.status).toBe('failed');

        const retried = await service.retryTask(principal, created.task.id);
        expect(retried.status).toBe('submitted');
        expect(retried.retryCount).toBe(1);
        expect(client.createTask).toHaveBeenCalledTimes(2);
        const retryPayload = client.createTask.mock.calls[1]?.[0];
        expect(retryPayload?.metadata.localTaskId).toBe(created.task.id);
        expect(retryPayload?.forceReprocess).toBe(true);
    });
});
