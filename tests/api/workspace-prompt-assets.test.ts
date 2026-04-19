import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { ApiError } from '../../app/lib/api/errors';

const mockPrincipal = {
    userId: 'user-1',
    activeWorkspaceId: 'workspace-1',
    activeWorkspaceSlug: 'ai-team',
    activeWorkspaceName: 'AI Team',
    activeWorkspaceType: 'organization',
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

const mockResolvePrincipal = vi.fn();
const mockRequirePermission = vi.fn();

vi.mock('../../app/lib/auth/principal', () => ({
    resolvePrincipal: mockResolvePrincipal,
    requirePermission: mockRequirePermission,
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
        headers: {
            'Content-Type': 'application/json',
            'x-dev-user-id': 'dev-user',
        },
        body: method === 'GET' || method === 'HEAD' ? undefined : JSON.stringify(body),
    });
}

function createInvalidJsonRequest(path: string, body: string, method = 'POST') {
    return new Request(`http://localhost${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'x-dev-user-id': 'dev-user',
        },
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

describe('Workspace Prompt Assets API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockResolvePrincipal.mockResolvedValue(mockPrincipal);
        mockRequirePermission.mockImplementation(() => undefined);
    });

    it('GET /api/workspaces/[workspaceSlug]/prompt-assets returns wrapped list data and parsed query params', async () => {
        const { GET } = await import('../../app/api/workspaces/[workspaceSlug]/prompt-assets/route');
        mockService.listPromptAssets.mockResolvedValue({
            items: [buildSummary()],
            pagination: {
                page: 1,
                pageSize: 20,
                total: 1,
            },
        });

        const response = await GET(
            createNextRequest('/api/workspaces/ai-team/prompt-assets?query=%20review%20&status=all&page=1&pageSize=20'),
            { params: Promise.resolve({ workspaceSlug: 'ai-team' }) }
        );

        expect(response.status).toBe(200);
        expect(mockResolvePrincipal).toHaveBeenCalledWith(expect.any(NextRequest), { workspaceSlug: 'ai-team' });
        expect(mockRequirePermission).toHaveBeenCalledWith(mockPrincipal, 'prompt_asset:read');
        expect(mockService.listPromptAssets).toHaveBeenCalledWith(mockPrincipal, {
            query: 'review',
            status: 'all',
            page: 1,
            pageSize: 20,
        });
    });

    it('GET /api/workspaces/[workspaceSlug]/prompt-assets returns 400 for invalid query params', async () => {
        const { GET } = await import('../../app/api/workspaces/[workspaceSlug]/prompt-assets/route');

        const response = await GET(
            createNextRequest('/api/workspaces/ai-team/prompt-assets?page=0&pageSize=200'),
            { params: Promise.resolve({ workspaceSlug: 'ai-team' }) }
        );
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error.code).toBe('BAD_REQUEST');
        expect(mockService.listPromptAssets).not.toHaveBeenCalled();
    });

    it('POST /api/workspaces/[workspaceSlug]/prompt-assets creates an asset', async () => {
        const { POST } = await import('../../app/api/workspaces/[workspaceSlug]/prompt-assets/route');
        mockService.createPromptAsset.mockResolvedValue(buildDetail());

        const response = await POST(
            createJsonRequest('/api/workspaces/ai-team/prompt-assets', {
                name: '  Code Review Prompt  ',
                content: 'You are a rigorous reviewer',
                changeNote: 'Initial version',
            }),
            { params: Promise.resolve({ workspaceSlug: 'ai-team' }) }
        );

        expect(response.status).toBe(201);
        expect(mockRequirePermission).toHaveBeenCalledWith(mockPrincipal, 'prompt_asset:write');
        expect(mockService.createPromptAsset).toHaveBeenCalledWith(mockPrincipal, {
            name: 'Code Review Prompt',
            description: '',
            content: 'You are a rigorous reviewer',
            changeNote: 'Initial version',
        });
    });

    it('POST /api/workspaces/[workspaceSlug]/prompt-assets returns 403 when write permission is denied', async () => {
        const { POST } = await import('../../app/api/workspaces/[workspaceSlug]/prompt-assets/route');
        mockRequirePermission.mockImplementation(() => {
            throw new ApiError(403, 'PERMISSION_DENIED', 'You do not have permission to perform this action');
        });

        const response = await POST(
            createJsonRequest('/api/workspaces/ai-team/prompt-assets', {
                name: 'Code Review Prompt',
                content: 'content',
            }),
            { params: Promise.resolve({ workspaceSlug: 'ai-team' }) }
        );
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.error.code).toBe('PERMISSION_DENIED');
        expect(mockService.createPromptAsset).not.toHaveBeenCalled();
    });

    it('GET /api/workspaces/[workspaceSlug]/prompt-assets/[id] returns the asset detail', async () => {
        const { GET } = await import('../../app/api/workspaces/[workspaceSlug]/prompt-assets/[id]/route');
        mockService.getPromptAssetDetail.mockResolvedValue(buildDetail());

        const response = await GET(createJsonRequest('/api/workspaces/ai-team/prompt-assets/asset-1', {}, 'GET'), {
            params: Promise.resolve({ workspaceSlug: 'ai-team', id: 'asset-1' }),
        });

        expect(response.status).toBe(200);
        expect(mockService.getPromptAssetDetail).toHaveBeenCalledWith(mockPrincipal, 'asset-1');
    });

    it('POST /api/workspaces/[workspaceSlug]/prompt-assets/[id]/versions creates a new version', async () => {
        const { POST } = await import('../../app/api/workspaces/[workspaceSlug]/prompt-assets/[id]/versions/route');
        mockService.createPromptAssetVersion.mockResolvedValue(buildDetail());

        const response = await POST(
            createJsonRequest('/api/workspaces/ai-team/prompt-assets/asset-1/versions', {
                name: 'Updated Prompt',
                description: 'Review prompt',
                content: 'Updated content',
                changeNote: 'Tighten rules',
                expectedVersionNumber: 2,
            }),
            { params: Promise.resolve({ workspaceSlug: 'ai-team', id: 'asset-1' }) }
        );

        expect(response.status).toBe(201);
        expect(mockService.createPromptAssetVersion).toHaveBeenCalledWith(mockPrincipal, 'asset-1', {
            name: 'Updated Prompt',
            description: 'Review prompt',
            content: 'Updated content',
            changeNote: 'Tighten rules',
            expectedVersionNumber: 2,
        });
    });

    it('POST /api/workspaces/[workspaceSlug]/prompt-assets/[id]/versions returns 400 for malformed JSON', async () => {
        const { POST } = await import('../../app/api/workspaces/[workspaceSlug]/prompt-assets/[id]/versions/route');

        const response = await POST(
            createInvalidJsonRequest('/api/workspaces/ai-team/prompt-assets/asset-1/versions', '{"name":"Prompt"'),
            { params: Promise.resolve({ workspaceSlug: 'ai-team', id: 'asset-1' }) }
        );
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error.code).toBe('BAD_REQUEST');
        expect(mockService.createPromptAssetVersion).not.toHaveBeenCalled();
    });

    it('GET /api/workspaces/[workspaceSlug]/prompt-assets/[id]/versions returns paginated versions', async () => {
        const { GET } = await import('../../app/api/workspaces/[workspaceSlug]/prompt-assets/[id]/versions/route');
        mockService.listPromptAssetVersions.mockResolvedValue({
            items: [buildVersion()],
            pagination: {
                page: 1,
                pageSize: 20,
                total: 1,
            },
        });

        const response = await GET(
            createNextRequest('/api/workspaces/ai-team/prompt-assets/asset-1/versions?page=1&pageSize=20'),
            { params: Promise.resolve({ workspaceSlug: 'ai-team', id: 'asset-1' }) }
        );

        expect(response.status).toBe(200);
        expect(mockService.listPromptAssetVersions).toHaveBeenCalledWith(mockPrincipal, 'asset-1', {
            page: 1,
            pageSize: 20,
        });
    });

    it('GET /api/workspaces/[workspaceSlug]/prompt-assets/[id]/versions/[versionId] returns a version detail', async () => {
        const { GET } = await import('../../app/api/workspaces/[workspaceSlug]/prompt-assets/[id]/versions/[versionId]/route');
        mockService.getPromptAssetVersion.mockResolvedValue(buildVersion());

        const response = await GET(
            createJsonRequest('/api/workspaces/ai-team/prompt-assets/asset-1/versions/version-1', {}, 'GET'),
            { params: Promise.resolve({ workspaceSlug: 'ai-team', id: 'asset-1', versionId: 'version-1' }) }
        );

        expect(response.status).toBe(200);
        expect(mockService.getPromptAssetVersion).toHaveBeenCalledWith(mockPrincipal, 'asset-1', 'version-1');
    });

    it('POST /api/workspaces/[workspaceSlug]/prompt-assets/[id]/restore returns 422 for overlong injected version ids', async () => {
        const { POST } = await import('../../app/api/workspaces/[workspaceSlug]/prompt-assets/[id]/restore/route');

        const response = await POST(
            createJsonRequest('/api/workspaces/ai-team/prompt-assets/asset-1/restore', {
                versionId: 'x'.repeat(65),
                expectedVersionNumber: 2,
            }),
            { params: Promise.resolve({ workspaceSlug: 'ai-team', id: 'asset-1' }) }
        );
        const data = await response.json();

        expect(response.status).toBe(422);
        expect(data.error.code).toBe('VALIDATION_FAILED');
        expect(data.error.details.versionId).toBeDefined();
        expect(mockService.restorePromptAssetVersion).not.toHaveBeenCalled();
    });

    it('POST /api/workspaces/[workspaceSlug]/prompt-assets/[id]/archive and unarchive require archive permission', async () => {
        const { POST: archive } = await import('../../app/api/workspaces/[workspaceSlug]/prompt-assets/[id]/archive/route');
        const { POST: unarchive } = await import('../../app/api/workspaces/[workspaceSlug]/prompt-assets/[id]/unarchive/route');
        mockService.archivePromptAsset.mockResolvedValue(buildSummary({ status: 'archived', archivedAt: 300 }));
        mockService.unarchivePromptAsset.mockResolvedValue(buildSummary());

        const archiveResponse = await archive(
            createJsonRequest('/api/workspaces/ai-team/prompt-assets/asset-1/archive', {}),
            { params: Promise.resolve({ workspaceSlug: 'ai-team', id: 'asset-1' }) }
        );
        const unarchiveResponse = await unarchive(
            createJsonRequest('/api/workspaces/ai-team/prompt-assets/asset-1/unarchive', {}),
            { params: Promise.resolve({ workspaceSlug: 'ai-team', id: 'asset-1' }) }
        );

        expect(archiveResponse.status).toBe(200);
        expect(unarchiveResponse.status).toBe(200);
        expect(mockRequirePermission).toHaveBeenCalledWith(mockPrincipal, 'prompt_asset:archive');
        expect(mockService.archivePromptAsset).toHaveBeenCalledWith(mockPrincipal, 'asset-1');
        expect(mockService.unarchivePromptAsset).toHaveBeenCalledWith(mockPrincipal, 'asset-1');
    });

    it('GET /api/workspaces/[workspaceSlug]/prompt-assets/[id] maps cross-workspace access failures', async () => {
        const { GET } = await import('../../app/api/workspaces/[workspaceSlug]/prompt-assets/[id]/route');
        mockResolvePrincipal.mockRejectedValue(
            new ApiError(403, 'WORKSPACE_FORBIDDEN', 'You do not have access to this workspace')
        );

        const response = await GET(createJsonRequest('/api/workspaces/secret/prompt-assets/asset-1', {}, 'GET'), {
            params: Promise.resolve({ workspaceSlug: 'secret', id: 'asset-1' }),
        });
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.error.code).toBe('WORKSPACE_FORBIDDEN');
        expect(mockService.getPromptAssetDetail).not.toHaveBeenCalled();
    });
});
