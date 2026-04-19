import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { ApiError } from '../../app/lib/api/errors';

const mockPrincipal = {
    userId: 'user-1',
    activeWorkspaceId: 'workspace-1',
    activeWorkspaceSlug: 'workspace-1',
    workspaceRole: 'owner',
    permissions: ['prompt_asset:read', 'prompt_asset:write', 'prompt_asset:archive'],
};

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

vi.mock('../../app/lib/auth/principal', () => ({
    resolvePrincipal: vi.fn().mockResolvedValue(mockPrincipal),
    requirePermission: vi.fn(),
}));

vi.mock('../../app/lib/prompt-assets/service', () => ({
    getPromptAssetService: () => mockService,
}));

function createNextRequest(path: string) {
    return new NextRequest(`http://localhost${path}`, {
        headers: { 'x-dev-user-id': 'dev-user' },
    });
}

function createJsonRequest(path: string, body: unknown, method = 'POST') {
    return new Request(`http://localhost${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-dev-user-id': 'dev-user' },
        body: method === 'GET' || method === 'HEAD' ? undefined : JSON.stringify(body),
    });
}

function createInvalidJsonRequest(path: string, body: string, method = 'POST') {
    return new Request(`http://localhost${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-dev-user-id': 'dev-user' },
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

    it('returns wrapped list data and parsed query params', async () => {
        const { GET } = await import('../../app/api/prompt-assets/route');
        mockService.listPromptAssets.mockResolvedValue({
            items: [buildSummary()],
            pagination: { page: 2, pageSize: 10, total: 1 },
        });

        const response = await GET(
            createNextRequest('/api/prompt-assets?query=%20code%20&status=all&page=2&pageSize=10')
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            data: {
                items: [buildSummary()],
                pagination: { page: 2, pageSize: 10, total: 1 },
            },
        });
        expect(mockService.listPromptAssets).toHaveBeenCalledWith(mockPrincipal, {
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
        expect(data.error.code).toBe('BAD_REQUEST');
    });

    it('creates an asset and returns 201', async () => {
        const { POST } = await import('../../app/api/prompt-assets/route');
        mockService.createPromptAsset.mockResolvedValue(buildDetail());

        const response = await POST(
            createJsonRequest('/api/prompt-assets', {
                name: '  Code Review Prompt  ',
                content: 'You are a rigorous reviewer',
                changeNote: 'Initial version',
            })
        );

        expect(response.status).toBe(201);
        await expect(response.json()).resolves.toEqual({ data: buildDetail() });
        expect(mockService.createPromptAsset).toHaveBeenCalledWith(mockPrincipal, {
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
            })
        );
        const data = await response.json();

        expect(response.status).toBe(422);
        expect(data.error.code).toBe('VALIDATION_FAILED');
    });

    it('returns 400 for malformed JSON bodies', async () => {
        const { POST } = await import('../../app/api/prompt-assets/route');

        const response = await POST(createInvalidJsonRequest('/api/prompt-assets', '{"name":"Prompt",'));
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error.code).toBe('BAD_REQUEST');
    });

    it('returns the current asset detail', async () => {
        const { GET } = await import('../../app/api/prompt-assets/[id]/route');
        mockService.getPromptAssetDetail.mockResolvedValue(buildDetail());

        const response = await GET(createJsonRequest('/api/prompt-assets/asset-1', {}, 'GET'), {
            params: Promise.resolve({ id: 'asset-1' }),
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ data: buildDetail() });
        expect(mockService.getPromptAssetDetail).toHaveBeenCalledWith(mockPrincipal, 'asset-1');
    });

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
            { params: Promise.resolve({ id: 'asset-1' }) }
        );

        expect(response.status).toBe(201);
        await expect(response.json()).resolves.toEqual({ data: buildDetail() });
        expect(mockService.createPromptAssetVersion).toHaveBeenCalledWith(mockPrincipal, 'asset-1', {
            name: 'Updated Prompt',
            description: 'Review prompt',
            content: 'Updated content',
            changeNote: 'Tighten rules',
            expectedVersionNumber: 2,
        });
    });

    it('lists version history', async () => {
        const { GET } = await import('../../app/api/prompt-assets/[id]/versions/route');
        mockService.listPromptAssetVersions.mockResolvedValue({
            items: [buildVersion()],
            pagination: { page: 1, pageSize: 20, total: 1 },
        });

        const response = await GET(
            createNextRequest('/api/prompt-assets/asset-1/versions?page=1&pageSize=20'),
            { params: Promise.resolve({ id: 'asset-1' }) }
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            data: {
                items: [buildVersion()],
                pagination: { page: 1, pageSize: 20, total: 1 },
            },
        });
    });

    it('returns a specific version detail', async () => {
        const { GET } = await import('../../app/api/prompt-assets/[id]/versions/[versionId]/route');
        mockService.getPromptAssetVersion.mockResolvedValue(buildVersion());

        const response = await GET(createJsonRequest('/api/prompt-assets/asset-1/versions/version-1', {}, 'GET'), {
            params: Promise.resolve({ id: 'asset-1', versionId: 'version-1' }),
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ data: buildVersion() });
    });

    it('restores, archives and unarchives an asset', async () => {
        const { POST: restore } = await import('../../app/api/prompt-assets/[id]/restore/route');
        const { POST: archive } = await import('../../app/api/prompt-assets/[id]/archive/route');
        const { POST: unarchive } = await import('../../app/api/prompt-assets/[id]/unarchive/route');

        mockService.restorePromptAssetVersion.mockResolvedValue(buildDetail());
        mockService.archivePromptAsset.mockResolvedValue(buildSummary({ status: 'archived', archivedAt: 999 }));
        mockService.unarchivePromptAsset.mockResolvedValue(buildSummary());

        const restoreResponse = await restore(
            createJsonRequest('/api/prompt-assets/asset-1/restore', {
                versionId: 'version-1',
                expectedVersionNumber: 2,
            }),
            { params: Promise.resolve({ id: 'asset-1' }) }
        );
        const archiveResponse = await archive(createJsonRequest('/api/prompt-assets/asset-1/archive', {}), {
            params: Promise.resolve({ id: 'asset-1' }),
        });
        const unarchiveResponse = await unarchive(
            createJsonRequest('/api/prompt-assets/asset-1/unarchive', {}),
            { params: Promise.resolve({ id: 'asset-1' }) }
        );

        expect(restoreResponse.status).toBe(200);
        expect(archiveResponse.status).toBe(200);
        expect(unarchiveResponse.status).toBe(200);
    });

    it('maps service errors through the shared API envelope', async () => {
        const { POST } = await import('../../app/api/prompt-assets/[id]/archive/route');
        mockService.archivePromptAsset.mockRejectedValue(
            new ApiError(409, 'PROMPT_ASSET_ARCHIVED', 'Prompt asset "asset-1" is archived')
        );

        const response = await POST(createJsonRequest('/api/prompt-assets/asset-1/archive', {}), {
            params: Promise.resolve({ id: 'asset-1' }),
        });
        const data = await response.json();

        expect(response.status).toBe(409);
        expect(data.error.code).toBe('PROMPT_ASSET_ARCHIVED');
    });
});
