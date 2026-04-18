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

function createNextRequest(path: string) {
    return new NextRequest(`http://localhost${path}`);
}

function createJsonRequest(path: string, body: unknown, method = 'POST') {
    return new Request(`http://localhost${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

function createInvalidJsonRequest(path: string, body: string, method = 'POST') {
    return new Request(`http://localhost${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body,
    });
}

function buildSummary(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        id: 'asset-1',
        name: 'Code Review Prompt',
        description: 'Review prompt',
        status: 'active',
        currentVersionNumber: 2,
        createdAt: 100,
        updatedAt: 200,
        archivedAt: null,
        ...overrides,
    };
}

function buildDetail(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        ...buildSummary(),
        currentVersion: {
            id: 'version-2',
            versionNumber: 2,
            content: 'You are a rigorous reviewer',
            changeNote: 'Refine instructions',
            operationType: 'update',
            sourceVersionId: null,
            createdAt: 200,
        },
        ...overrides,
    };
}

function buildVersion(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        id: 'version-1',
        assetId: 'asset-1',
        versionNumber: 1,
        nameSnapshot: 'Code Review Prompt',
        descriptionSnapshot: 'Review prompt',
        content: 'You are a reviewer',
        changeNote: 'Initial version',
        operationType: 'create',
        sourceVersionId: null,
        createdAt: 100,
        ...overrides,
    };
}

describe('Prompt Assets API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET /api/prompt-assets', () => {
        it('returns wrapped list data and parsed query params', async () => {
            const { GET } = await import('../../app/api/prompt-assets/route');
            mockService.listPromptAssets.mockResolvedValue({
                items: [buildSummary()],
                pagination: {
                    page: 2,
                    pageSize: 10,
                    total: 1,
                },
            });

            const response = await GET(
                createNextRequest('/api/prompt-assets?query=%20code%20&status=all&page=2&pageSize=10'),
            );

            expect(response.status).toBe(200);
            await expect(response.json()).resolves.toEqual({
                data: {
                    items: [buildSummary()],
                    pagination: {
                        page: 2,
                        pageSize: 10,
                        total: 1,
                    },
                },
            });
            expect(mockService.listPromptAssets).toHaveBeenCalledWith({
                query: 'code',
                status: 'all',
                page: 2,
                pageSize: 10,
            });
        });

        it('returns 400 for invalid query params', async () => {
            const { GET } = await import('../../app/api/prompt-assets/route');

            const response = await GET(createNextRequest('/api/prompt-assets?page=0&pageSize=200'));
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error.code).toBe('PROMPT_ASSET_BAD_REQUEST');
            expect(data.error.details.page).toBeDefined();
            expect(data.error.details.pageSize).toBeDefined();
            expect(mockService.listPromptAssets).not.toHaveBeenCalled();
        });
    });

    describe('POST /api/prompt-assets', () => {
        it('creates an asset and returns 201 with wrapped detail data', async () => {
            const { POST } = await import('../../app/api/prompt-assets/route');
            mockService.createPromptAsset.mockResolvedValue(buildDetail());

            const response = await POST(
                createJsonRequest('/api/prompt-assets', {
                    name: '  Code Review Prompt  ',
                    content: 'You are a rigorous reviewer',
                    changeNote: 'Initial version',
                }),
            );

            expect(response.status).toBe(201);
            await expect(response.json()).resolves.toEqual({
                data: buildDetail(),
            });
            expect(mockService.createPromptAsset).toHaveBeenCalledWith({
                name: 'Code Review Prompt',
                description: '',
                content: 'You are a rigorous reviewer',
                changeNote: 'Initial version',
            });
        });

        it('returns 422 for invalid body values', async () => {
            const { POST } = await import('../../app/api/prompt-assets/route');

            const response = await POST(
                createJsonRequest('/api/prompt-assets', {
                    name: '',
                    description: 'x',
                    content: '   ',
                }),
            );
            const data = await response.json();

            expect(response.status).toBe(422);
            expect(data.error.code).toBe('PROMPT_ASSET_VALIDATION_FAILED');
            expect(data.error.details.name).toBeDefined();
            expect(data.error.details.content).toBeDefined();
            expect(mockService.createPromptAsset).not.toHaveBeenCalled();
        });

        it('returns 400 for malformed JSON bodies', async () => {
            const { POST } = await import('../../app/api/prompt-assets/route');

            const response = await POST(
                createInvalidJsonRequest('/api/prompt-assets', '{"name":"Prompt",'),
            );

            expect(response.status).toBe(400);
            await expect(response.json()).resolves.toEqual({
                error: {
                    code: 'PROMPT_ASSET_BAD_REQUEST',
                    message: 'Invalid JSON request body',
                    details: null,
                },
            });
            expect(mockService.createPromptAsset).not.toHaveBeenCalled();
        });
    });

    describe('GET /api/prompt-assets/[id]', () => {
        it('returns the current asset detail', async () => {
            const { GET } = await import('../../app/api/prompt-assets/[id]/route');
            mockService.getPromptAssetDetail.mockResolvedValue(buildDetail());

            const response = await GET({} as Request, {
                params: Promise.resolve({ id: 'asset-1' }),
            });

            expect(response.status).toBe(200);
            await expect(response.json()).resolves.toEqual({ data: buildDetail() });
            expect(mockService.getPromptAssetDetail).toHaveBeenCalledWith('asset-1');
        });

        it('maps not found errors from the service layer', async () => {
            const { GET } = await import('../../app/api/prompt-assets/[id]/route');
            mockService.getPromptAssetDetail.mockRejectedValue(
                new PromptAssetError(404, 'PROMPT_ASSET_NOT_FOUND', 'Prompt asset "missing" not found'),
            );

            const response = await GET({} as Request, {
                params: Promise.resolve({ id: 'missing' }),
            });

            expect(response.status).toBe(404);
            await expect(response.json()).resolves.toEqual({
                error: {
                    code: 'PROMPT_ASSET_NOT_FOUND',
                    message: 'Prompt asset "missing" not found',
                    details: null,
                },
            });
        });
    });

    describe('POST /api/prompt-assets/[id]/versions', () => {
        it('creates a new version and returns 201', async () => {
            const { POST } = await import('../../app/api/prompt-assets/[id]/versions/route');
            mockService.createPromptAssetVersion.mockResolvedValue(buildDetail());

            const response = await POST(
                createJsonRequest('/api/prompt-assets/asset-1/versions', {
                    name: 'Updated Prompt',
                    description: 'Review prompt',
                    content: 'Updated content',
                    changeNote: 'Tighten rules',
                    expectedVersionNumber: 2,
                }),
                {
                    params: Promise.resolve({ id: 'asset-1' }),
                },
            );

            expect(response.status).toBe(201);
            await expect(response.json()).resolves.toEqual({ data: buildDetail() });
            expect(mockService.createPromptAssetVersion).toHaveBeenCalledWith('asset-1', {
                name: 'Updated Prompt',
                description: 'Review prompt',
                content: 'Updated content',
                changeNote: 'Tighten rules',
                expectedVersionNumber: 2,
            });
        });

        it('maps service conflict errors', async () => {
            const { POST } = await import('../../app/api/prompt-assets/[id]/versions/route');
            mockService.createPromptAssetVersion.mockRejectedValue(
                new PromptAssetError(
                    409,
                    'PROMPT_ASSET_VERSION_CONFLICT',
                    'Prompt asset "asset-1" version conflict',
                    {
                        expectedVersionNumber: 3,
                        actualVersionNumber: 2,
                    },
                ),
            );

            const response = await POST(
                createJsonRequest('/api/prompt-assets/asset-1/versions', {
                    name: 'Prompt',
                    description: '',
                    content: 'Updated',
                    expectedVersionNumber: 3,
                }),
                {
                    params: Promise.resolve({ id: 'asset-1' }),
                },
            );

            expect(response.status).toBe(409);
            await expect(response.json()).resolves.toEqual({
                error: {
                    code: 'PROMPT_ASSET_VERSION_CONFLICT',
                    message: 'Prompt asset "asset-1" version conflict',
                    details: {
                        expectedVersionNumber: 3,
                        actualVersionNumber: 2,
                    },
                },
            });
        });

        it('returns 422 for malformed version payloads', async () => {
            const { POST } = await import('../../app/api/prompt-assets/[id]/versions/route');

            const response = await POST(
                createJsonRequest('/api/prompt-assets/asset-1/versions', {
                    name: 'Prompt',
                    description: '',
                    content: 'content',
                    expectedVersionNumber: 0,
                }),
                {
                    params: Promise.resolve({ id: 'asset-1' }),
                },
            );
            const data = await response.json();

            expect(response.status).toBe(422);
            expect(data.error.code).toBe('PROMPT_ASSET_VALIDATION_FAILED');
            expect(data.error.details.expectedVersionNumber).toBeDefined();
            expect(mockService.createPromptAssetVersion).not.toHaveBeenCalled();
        });
    });

    describe('GET /api/prompt-assets/[id]/versions', () => {
        it('returns paginated version history', async () => {
            const { GET } = await import('../../app/api/prompt-assets/[id]/versions/route');
            mockService.listPromptAssetVersions.mockResolvedValue({
                items: [
                    buildVersion({ id: 'version-2', versionNumber: 2, operationType: 'update' }),
                    buildVersion(),
                ],
                pagination: {
                    page: 1,
                    pageSize: 20,
                    total: 2,
                },
            });

            const response = await GET(
                createNextRequest('/api/prompt-assets/asset-1/versions?page=1&pageSize=20'),
                {
                    params: Promise.resolve({ id: 'asset-1' }),
                },
            );

            expect(response.status).toBe(200);
            await expect(response.json()).resolves.toEqual({
                data: {
                    items: [
                        buildVersion({ id: 'version-2', versionNumber: 2, operationType: 'update' }),
                        buildVersion(),
                    ],
                    pagination: {
                        page: 1,
                        pageSize: 20,
                        total: 2,
                    },
                },
            });
            expect(mockService.listPromptAssetVersions).toHaveBeenCalledWith('asset-1', {
                page: 1,
                pageSize: 20,
            });
        });

        it('returns 400 for invalid version pagination query', async () => {
            const { GET } = await import('../../app/api/prompt-assets/[id]/versions/route');

            const response = await GET(
                createNextRequest('/api/prompt-assets/asset-1/versions?page=-1'),
                {
                    params: Promise.resolve({ id: 'asset-1' }),
                },
            );

            expect(response.status).toBe(400);
            await expect(response.json()).resolves.toMatchObject({
                error: {
                    code: 'PROMPT_ASSET_BAD_REQUEST',
                },
            });
            expect(mockService.listPromptAssetVersions).not.toHaveBeenCalled();
        });
    });

    describe('GET /api/prompt-assets/[id]/versions/[versionId]', () => {
        it('returns a specific version detail', async () => {
            const { GET } = await import('../../app/api/prompt-assets/[id]/versions/[versionId]/route');
            mockService.getPromptAssetVersion.mockResolvedValue(buildVersion());

            const response = await GET({} as Request, {
                params: Promise.resolve({ id: 'asset-1', versionId: 'version-1' }),
            });

            expect(response.status).toBe(200);
            await expect(response.json()).resolves.toEqual({ data: buildVersion() });
            expect(mockService.getPromptAssetVersion).toHaveBeenCalledWith('asset-1', 'version-1');
        });

        it('returns 404 when the requested version does not belong to the asset', async () => {
            const { GET } = await import('../../app/api/prompt-assets/[id]/versions/[versionId]/route');
            mockService.getPromptAssetVersion.mockRejectedValue(
                new PromptAssetError(404, 'PROMPT_ASSET_VERSION_NOT_FOUND', 'Prompt asset version "other-version" not found'),
            );

            const response = await GET({} as Request, {
                params: Promise.resolve({ id: 'asset-1', versionId: 'other-version' }),
            });

            expect(response.status).toBe(404);
            await expect(response.json()).resolves.toEqual({
                error: {
                    code: 'PROMPT_ASSET_VERSION_NOT_FOUND',
                    message: 'Prompt asset version "other-version" not found',
                    details: null,
                },
            });
        });
    });

    describe('POST /api/prompt-assets/[id]/restore', () => {
        it('restores a historical version as a new current version', async () => {
            const { POST } = await import('../../app/api/prompt-assets/[id]/restore/route');
            mockService.restorePromptAssetVersion.mockResolvedValue(
                buildDetail({
                    currentVersionNumber: 3,
                    currentVersion: {
                        id: 'version-3',
                        versionNumber: 3,
                        content: 'Restored content',
                        changeNote: 'Rollback to v1',
                        operationType: 'restore',
                        sourceVersionId: 'version-1',
                        createdAt: 300,
                    },
                }),
            );

            const response = await POST(
                createJsonRequest('/api/prompt-assets/asset-1/restore', {
                    versionId: 'version-1',
                    changeNote: 'Rollback to v1',
                    expectedVersionNumber: 2,
                }),
                {
                    params: Promise.resolve({ id: 'asset-1' }),
                },
            );

            expect(response.status).toBe(201);
            expect(mockService.restorePromptAssetVersion).toHaveBeenCalledWith('asset-1', {
                versionId: 'version-1',
                changeNote: 'Rollback to v1',
                expectedVersionNumber: 2,
            });
        });

        it('returns 400 for malformed restore JSON', async () => {
            const { POST } = await import('../../app/api/prompt-assets/[id]/restore/route');

            const response = await POST(
                createInvalidJsonRequest('/api/prompt-assets/asset-1/restore', '{"versionId":"v1"'),
                {
                    params: Promise.resolve({ id: 'asset-1' }),
                },
            );

            expect(response.status).toBe(400);
            await expect(response.json()).resolves.toEqual({
                error: {
                    code: 'PROMPT_ASSET_BAD_REQUEST',
                    message: 'Invalid JSON request body',
                    details: null,
                },
            });
            expect(mockService.restorePromptAssetVersion).not.toHaveBeenCalled();
        });
    });

    describe('POST /api/prompt-assets/[id]/archive', () => {
        it('returns wrapped archived summary', async () => {
            const { POST } = await import('../../app/api/prompt-assets/[id]/archive/route');
            mockService.archivePromptAsset.mockResolvedValue(
                buildSummary({
                    status: 'archived',
                    archivedAt: 300,
                    updatedAt: 300,
                }),
            );

            const response = await POST({} as Request, {
                params: Promise.resolve({ id: 'asset-1' }),
            });

            expect(response.status).toBe(200);
            await expect(response.json()).resolves.toEqual({
                data: buildSummary({
                    status: 'archived',
                    archivedAt: 300,
                    updatedAt: 300,
                }),
            });
            expect(mockService.archivePromptAsset).toHaveBeenCalledWith('asset-1');
        });

        it('normalizes unexpected archive failures as internal errors', async () => {
            const { POST } = await import('../../app/api/prompt-assets/[id]/archive/route');
            mockService.archivePromptAsset.mockRejectedValue(new Error('Database locked'));

            const response = await POST({} as Request, {
                params: Promise.resolve({ id: 'asset-1' }),
            });

            expect(response.status).toBe(500);
            await expect(response.json()).resolves.toEqual({
                error: {
                    code: 'PROMPT_ASSET_INTERNAL_ERROR',
                    message: 'Database locked',
                    details: null,
                },
            });
        });
    });

    describe('POST /api/prompt-assets/[id]/unarchive', () => {
        it('returns wrapped active summary for idempotent unarchive', async () => {
            const { POST } = await import('../../app/api/prompt-assets/[id]/unarchive/route');
            mockService.unarchivePromptAsset.mockResolvedValue(buildSummary());

            const response = await POST({} as Request, {
                params: Promise.resolve({ id: 'asset-1' }),
            });

            expect(response.status).toBe(200);
            await expect(response.json()).resolves.toEqual({ data: buildSummary() });
            expect(mockService.unarchivePromptAsset).toHaveBeenCalledWith('asset-1');
        });
    });
});
