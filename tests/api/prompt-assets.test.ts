import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { PromptAssetError } from '../../app/lib/prompt-assets/errors';

const mockService = {
    listPromptAssets: vi.fn(),
    createPromptAsset: vi.fn(),
    getPromptAssetDetail: vi.fn(),
    createPromptAssetVersion: vi.fn(),
    listPromptAssetVersions: vi.fn(),
    getPromptAssetVersion: vi.fn(),
    restorePromptAssetVersion: vi.fn(),
    archivePromptAsset: vi.fn(),
    unarchivePromptAsset: vi.fn(),
};

vi.mock('../../app/lib/prompt-assets/service', () => ({
    getPromptAssetService: () => mockService,
}));

describe('Prompt Assets API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns wrapped list data from GET /api/prompt-assets', async () => {
        const { GET } = await import('../../app/api/prompt-assets/route');
        mockService.listPromptAssets.mockResolvedValue({
            items: [
                {
                    id: 'asset-1',
                    name: 'Prompt',
                    description: '',
                    status: 'active',
                    currentVersionNumber: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    archivedAt: null,
                },
            ],
            pagination: {
                page: 1,
                pageSize: 20,
                total: 1,
            },
        });

        const request = new NextRequest('http://localhost/api/prompt-assets?page=1&pageSize=20');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual({
            data: {
                items: [
                    {
                        id: 'asset-1',
                        name: 'Prompt',
                        description: '',
                        status: 'active',
                        currentVersionNumber: 1,
                        createdAt: 1,
                        updatedAt: 1,
                        archivedAt: null,
                    },
                ],
                pagination: {
                    page: 1,
                    pageSize: 20,
                    total: 1,
                },
            },
        });
        expect(mockService.listPromptAssets).toHaveBeenCalledWith({
            page: 1,
            pageSize: 20,
            query: undefined,
            status: 'active',
        });
    });

    it('returns 400 for invalid query params on GET /api/prompt-assets', async () => {
        const { GET } = await import('../../app/api/prompt-assets/route');
        const request = new NextRequest('http://localhost/api/prompt-assets?page=0');

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error.code).toBe('PROMPT_ASSET_BAD_REQUEST');
        expect(mockService.listPromptAssets).not.toHaveBeenCalled();
    });

    it('returns 422 for invalid POST /api/prompt-assets body', async () => {
        const { POST } = await import('../../app/api/prompt-assets/route');
        const request = {
            json: async () => ({
                name: '',
                description: '',
                content: '',
            }),
        } as unknown as Request;

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(422);
        expect(data.error.code).toBe('PROMPT_ASSET_VALIDATION_FAILED');
        expect(mockService.createPromptAsset).not.toHaveBeenCalled();
    });

    it('maps service conflict errors on POST /api/prompt-assets/[id]/versions', async () => {
        const { POST } = await import('../../app/api/prompt-assets/[id]/versions/route');
        mockService.createPromptAssetVersion.mockRejectedValue(
            new PromptAssetError(
                409,
                'PROMPT_ASSET_VERSION_CONFLICT',
                'Prompt asset "asset-1" version conflict',
                {
                    expectedVersionNumber: 3,
                    actualVersionNumber: 2,
                }
            )
        );

        const request = {
            json: async () => ({
                name: 'Prompt',
                description: '',
                content: 'Updated',
                expectedVersionNumber: 3,
            }),
        } as unknown as Request;

        const response = await POST(request, {
            params: Promise.resolve({ id: 'asset-1' }),
        });
        const data = await response.json();

        expect(response.status).toBe(409);
        expect(data.error.code).toBe('PROMPT_ASSET_VERSION_CONFLICT');
        expect(data.error.details).toEqual({
            expectedVersionNumber: 3,
            actualVersionNumber: 2,
        });
    });

    it('returns wrapped version detail from GET /api/prompt-assets/[id]/versions/[versionId]', async () => {
        const { GET } = await import('../../app/api/prompt-assets/[id]/versions/[versionId]/route');
        mockService.getPromptAssetVersion.mockResolvedValue({
            id: 'version-1',
            assetId: 'asset-1',
            versionNumber: 1,
            nameSnapshot: 'Prompt',
            descriptionSnapshot: '',
            content: 'Version 1',
            changeNote: null,
            operationType: 'create',
            sourceVersionId: null,
            createdAt: 1,
        });

        const response = await GET({} as Request, {
            params: Promise.resolve({ id: 'asset-1', versionId: 'version-1' }),
        });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.versionNumber).toBe(1);
        expect(mockService.getPromptAssetVersion).toHaveBeenCalledWith('asset-1', 'version-1');
    });
});
