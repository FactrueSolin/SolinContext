import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    archivePromptAsset,
    createPromptAsset,
    createPromptAssetVersion,
    listPromptAssets,
    listPromptAssetVersions,
    restorePromptAssetVersion,
} from '../../../app/lib/prompt-assets/client';

describe('prompt-assets client', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.stubGlobal('fetch', vi.fn());
    });

    it('builds query parameters for asset listing requests', async () => {
        const fetchMock = vi.mocked(fetch);
        fetchMock.mockResolvedValue(
            new Response(
                JSON.stringify({
                    data: {
                        items: [],
                        pagination: { page: 2, pageSize: 10, total: 0 },
                    },
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
        );

        await listPromptAssets({
            query: 'review',
            tag: '代码评审',
            status: 'archived',
            page: 2,
            pageSize: 10,
        });

        expect(fetchMock).toHaveBeenCalledWith(
            '/api/prompt-assets?query=review&tag=%E4%BB%A3%E7%A0%81%E8%AF%84%E5%AE%A1&status=archived&page=2&pageSize=10',
            undefined
        );
    });

    it('sends JSON payloads when creating an asset', async () => {
        const fetchMock = vi.mocked(fetch);
        fetchMock.mockResolvedValue(
            new Response(
                JSON.stringify({
                    data: {
                        id: 'asset-1',
                        name: '代码评审提示词',
                    },
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
        );

        await createPromptAsset({
            name: '代码评审提示词',
            description: '用于代码审查',
            tags: ['代码评审', '高优先级'],
            content: 'Review this code.',
            changeNote: '初始版本',
        });

        expect(fetchMock).toHaveBeenCalledWith('/api/prompt-assets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: '代码评审提示词',
                description: '用于代码审查',
                tags: ['代码评审', '高优先级'],
                content: 'Review this code.',
                changeNote: '初始版本',
            }),
        });
    });

    it('throws a typed API error when the server returns structured validation errors', async () => {
        const fetchMock = vi.mocked(fetch);
        fetchMock.mockResolvedValue(
            new Response(
                JSON.stringify({
                    error: {
                        code: 'PROMPT_ASSET_VALIDATION_FAILED',
                        message: 'Validation failed',
                        details: { field: 'name' },
                    },
                }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            )
        );

        await expect(
            createPromptAssetVersion('asset-1', {
                name: '',
                description: '',
                content: 'updated',
                expectedVersionNumber: 1,
            })
        ).rejects.toMatchObject({
            name: 'PromptAssetApiError',
            status: 400,
            code: 'PROMPT_ASSET_VALIDATION_FAILED',
            message: 'Validation failed',
            details: { field: 'name' },
        });
    });

    it('falls back to a generic error when the response body is not JSON', async () => {
        const fetchMock = vi.mocked(fetch);
        fetchMock.mockResolvedValue(new Response('internal error', { status: 500 }));

        await expect(archivePromptAsset('asset-1')).rejects.toMatchObject({
            name: 'PromptAssetApiError',
            status: 500,
            code: 'PROMPT_ASSET_INTERNAL_ERROR',
            message: 'Prompt asset request failed',
            details: null,
        });
    });

    it('omits empty query strings for version listing requests', async () => {
        const fetchMock = vi.mocked(fetch);
        fetchMock.mockResolvedValue(
            new Response(
                JSON.stringify({
                    data: {
                        items: [],
                        pagination: { page: 1, pageSize: 20, total: 0 },
                    },
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
        );

        await listPromptAssetVersions('asset-1');

        expect(fetchMock).toHaveBeenCalledWith('/api/prompt-assets/asset-1/versions', undefined);
    });

    it('sends restore payloads to the correct endpoint', async () => {
        const fetchMock = vi.mocked(fetch);
        fetchMock.mockResolvedValue(
            new Response(
                JSON.stringify({
                    data: {
                        id: 'asset-1',
                        currentVersionNumber: 3,
                    },
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
        );

        await restorePromptAssetVersion('asset-1', {
            versionId: 'version-2',
            changeNote: '回滚',
            expectedVersionNumber: 2,
        });

        expect(fetchMock).toHaveBeenCalledWith('/api/prompt-assets/asset-1/restore', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                versionId: 'version-2',
                changeNote: '回滚',
                expectedVersionNumber: 2,
            }),
        });
    });
});
