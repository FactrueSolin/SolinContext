import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../app/lib/api/errors';

const mockPrincipal = {
    userId: 'user-1',
    activeWorkspaceId: 'workspace-1',
    activeWorkspaceSlug: 'ai-team',
    activeWorkspaceName: 'AI Team',
    activeWorkspaceType: 'organization',
    workspaceRole: 'owner',
    permissions: ['project:read', 'project:write', 'project:delete'],
};

const mockService = {
    listProjects: vi.fn(),
    createProject: vi.fn(),
    getProjectDetail: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
    listRevisions: vi.fn(),
    restoreRevision: vi.fn(),
};

const mockResolvePrincipal = vi.fn();
const mockRequirePermission = vi.fn();

vi.mock('../../app/lib/auth/principal', () => ({
    resolvePrincipal: mockResolvePrincipal,
    requirePermission: mockRequirePermission,
}));

vi.mock('../../app/lib/projects/service', () => ({
    getProjectService: () => mockService,
}));

function createRequest(path: string, method = 'GET', body?: unknown) {
    return new Request(`http://localhost${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'x-dev-user-id': 'dev-user',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
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

describe('Workspace Projects API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockResolvePrincipal.mockResolvedValue(mockPrincipal);
        mockRequirePermission.mockImplementation(() => undefined);
    });

    it('GET /api/workspaces/[workspaceSlug]/projects returns wrapped list data and parsed query params', async () => {
        const { GET } = await import('../../app/api/workspaces/[workspaceSlug]/projects/route');
        mockService.listProjects.mockReturnValue({
            items: [
                {
                    id: 'project-1',
                    name: 'Customer Support Bot',
                    createdAt: '2026-04-19T00:00:00.000Z',
                    updatedAt: '2026-04-19T01:00:00.000Z',
                    createdBy: 'user-1',
                    updatedBy: 'user-2',
                    latestRevisionId: 'rev-1',
                },
            ],
            pagination: {
                page: 2,
                pageSize: 10,
                total: 1,
            },
        });

        const response = await GET(
            createRequest('/api/workspaces/ai-team/projects?query=%20support%20&page=2&pageSize=10&sortBy=name&sortOrder=asc'),
            { params: Promise.resolve({ workspaceSlug: 'ai-team' }) }
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            data: {
                items: [
                    {
                        id: 'project-1',
                        name: 'Customer Support Bot',
                        createdAt: '2026-04-19T00:00:00.000Z',
                        updatedAt: '2026-04-19T01:00:00.000Z',
                        createdBy: 'user-1',
                        updatedBy: 'user-2',
                        latestRevisionId: 'rev-1',
                    },
                ],
                pagination: {
                    page: 2,
                    pageSize: 10,
                    total: 1,
                },
            },
        });
        expect(mockResolvePrincipal).toHaveBeenCalledWith(expect.any(Request), { workspaceSlug: 'ai-team' });
        expect(mockRequirePermission).toHaveBeenCalledWith(mockPrincipal, 'project:read');
        expect(mockService.listProjects).toHaveBeenCalledWith(mockPrincipal, {
            query: 'support',
            page: 2,
            pageSize: 10,
            sortBy: 'name',
            sortOrder: 'asc',
        });
    });

    it('GET /api/workspaces/[workspaceSlug]/projects returns 400 for invalid query params', async () => {
        const { GET } = await import('../../app/api/workspaces/[workspaceSlug]/projects/route');

        const response = await GET(
            createRequest('/api/workspaces/ai-team/projects?page=0&pageSize=200&sortBy=drop-table'),
            { params: Promise.resolve({ workspaceSlug: 'ai-team' }) }
        );
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error.code).toBe('BAD_REQUEST');
        expect(data.error.details.page).toBeDefined();
        expect(data.error.details.pageSize).toBeDefined();
        expect(data.error.details.sortBy).toBeDefined();
        expect(mockService.listProjects).not.toHaveBeenCalled();
    });

    it('POST /api/workspaces/[workspaceSlug]/projects creates a project with defaulted fields', async () => {
        const { POST } = await import('../../app/api/workspaces/[workspaceSlug]/projects/route');
        mockService.createProject.mockReturnValue({
            id: 'project-1',
            name: 'Customer Support Bot',
            createdAt: '2026-04-19T00:00:00.000Z',
            updatedAt: '2026-04-19T00:00:00.000Z',
            createdBy: 'user-1',
            updatedBy: 'user-1',
            latestRevisionId: 'rev-1',
            systemPrompt: 'You are a helpful assistant.',
            defaultCredentialId: null,
            currentRevisionId: 'rev-1',
            messages: [],
            apiConfig: {
                baseUrl: 'https://api.anthropic.com',
                apiKey: '',
                model: 'claude-sonnet-4-20250514',
            },
        });

        const response = await POST(
            createRequest('/api/workspaces/ai-team/projects', 'POST', {
                name: '  Customer Support Bot  ',
            }),
            { params: Promise.resolve({ workspaceSlug: 'ai-team' }) }
        );

        expect(response.status).toBe(201);
        expect(mockRequirePermission).toHaveBeenCalledWith(mockPrincipal, 'project:write');
        expect(mockService.createProject).toHaveBeenCalledWith(mockPrincipal, {
            name: 'Customer Support Bot',
            systemPrompt: 'You are a helpful assistant.',
            messages: [],
        });
    });

    it('POST /api/workspaces/[workspaceSlug]/projects returns 422 for malformed body values', async () => {
        const { POST } = await import('../../app/api/workspaces/[workspaceSlug]/projects/route');

        const response = await POST(
            createRequest('/api/workspaces/ai-team/projects', 'POST', {
                name: '   ',
                defaultCredentialId: {
                    $ne: '',
                },
            }),
            { params: Promise.resolve({ workspaceSlug: 'ai-team' }) }
        );
        const data = await response.json();

        expect(response.status).toBe(422);
        expect(data.error.code).toBe('VALIDATION_FAILED');
        expect(data.error.details.name).toBeDefined();
        expect(data.error.details.defaultCredentialId).toBeDefined();
        expect(mockService.createProject).not.toHaveBeenCalled();
    });

    it('GET /api/workspaces/[workspaceSlug]/projects/[projectId] returns the project detail', async () => {
        const { GET } = await import('../../app/api/workspaces/[workspaceSlug]/projects/[projectId]/route');
        mockService.getProjectDetail.mockReturnValue({
            id: 'project-1',
            name: 'Customer Support Bot',
            createdAt: '2026-04-19T00:00:00.000Z',
            updatedAt: '2026-04-19T00:00:00.000Z',
            createdBy: 'user-1',
            updatedBy: 'user-1',
            latestRevisionId: 'rev-2',
            currentRevisionId: 'rev-2',
            defaultCredentialId: null,
            systemPrompt: 'prompt',
            messages: [],
            apiConfig: { baseUrl: 'url', apiKey: '', model: 'model' },
        });

        const response = await GET(createRequest('/api/workspaces/ai-team/projects/project-1'), {
            params: Promise.resolve({ workspaceSlug: 'ai-team', projectId: 'project-1' }),
        });

        expect(response.status).toBe(200);
        expect(mockService.getProjectDetail).toHaveBeenCalledWith(mockPrincipal, 'project-1');
    });

    it('PATCH /api/workspaces/[workspaceSlug]/projects/[projectId] updates a project', async () => {
        const { PATCH } = await import('../../app/api/workspaces/[workspaceSlug]/projects/[projectId]/route');
        mockService.updateProject.mockReturnValue({
            id: 'project-1',
            name: 'Customer Support Bot v2',
        });

        const response = await PATCH(
            createRequest('/api/workspaces/ai-team/projects/project-1', 'PATCH', {
                name: '  Customer Support Bot v2  ',
                expectedRevisionId: 'rev-1',
            }),
            { params: Promise.resolve({ workspaceSlug: 'ai-team', projectId: 'project-1' }) }
        );

        expect(response.status).toBe(200);
        expect(mockService.updateProject).toHaveBeenCalledWith(mockPrincipal, 'project-1', {
            name: 'Customer Support Bot v2',
            expectedRevisionId: 'rev-1',
        });
    });

    it('PATCH /api/workspaces/[workspaceSlug]/projects/[projectId] returns 400 for malformed JSON', async () => {
        const { PATCH } = await import('../../app/api/workspaces/[workspaceSlug]/projects/[projectId]/route');

        const response = await PATCH(
            createInvalidJsonRequest('/api/workspaces/ai-team/projects/project-1', '{"name":"Project"', 'PATCH'),
            { params: Promise.resolve({ workspaceSlug: 'ai-team', projectId: 'project-1' }) }
        );
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error.code).toBe('BAD_REQUEST');
        expect(mockService.updateProject).not.toHaveBeenCalled();
    });

    it('PATCH /api/workspaces/[workspaceSlug]/projects/[projectId] maps version conflicts', async () => {
        const { PATCH } = await import('../../app/api/workspaces/[workspaceSlug]/projects/[projectId]/route');
        mockService.updateProject.mockImplementation(() => {
            throw new ApiError(409, 'PROJECT_VERSION_CONFLICT', 'Project version conflict', {
                expectedRevisionId: 'rev-3',
                actualRevisionId: 'rev-2',
            });
        });

        const response = await PATCH(
            createRequest('/api/workspaces/ai-team/projects/project-1', 'PATCH', {
                expectedRevisionId: 'rev-3',
            }),
            { params: Promise.resolve({ workspaceSlug: 'ai-team', projectId: 'project-1' }) }
        );
        const data = await response.json();

        expect(response.status).toBe(409);
        expect(data.error.code).toBe('PROJECT_VERSION_CONFLICT');
        expect(data.error.details).toEqual({
            expectedRevisionId: 'rev-3',
            actualRevisionId: 'rev-2',
        });
    });

    it('DELETE /api/workspaces/[workspaceSlug]/projects/[projectId] returns 204 without a body', async () => {
        const { DELETE } = await import('../../app/api/workspaces/[workspaceSlug]/projects/[projectId]/route');

        const response = await DELETE(createRequest('/api/workspaces/ai-team/projects/project-1', 'DELETE'), {
            params: Promise.resolve({ workspaceSlug: 'ai-team', projectId: 'project-1' }),
        });

        expect(response.status).toBe(204);
        await expect(response.text()).resolves.toBe('');
        expect(mockRequirePermission).toHaveBeenCalledWith(mockPrincipal, 'project:delete');
        expect(mockService.deleteProject).toHaveBeenCalledWith(mockPrincipal, 'project-1');
    });

    it('GET /api/workspaces/[workspaceSlug]/projects/[projectId]/revisions returns revision history', async () => {
        const { GET } = await import('../../app/api/workspaces/[workspaceSlug]/projects/[projectId]/revisions/route');
        mockService.listRevisions.mockReturnValue([
            {
                id: 'rev-2',
                revisionNumber: 2,
                createdAt: '2026-04-19T01:00:00.000Z',
                createdBy: 'user-1',
            },
        ]);

        const response = await GET(createRequest('/api/workspaces/ai-team/projects/project-1/revisions'), {
            params: Promise.resolve({ workspaceSlug: 'ai-team', projectId: 'project-1' }),
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            data: [
                {
                    id: 'rev-2',
                    revisionNumber: 2,
                    createdAt: '2026-04-19T01:00:00.000Z',
                    createdBy: 'user-1',
                },
            ],
        });
        expect(mockService.listRevisions).toHaveBeenCalledWith(mockPrincipal, 'project-1');
    });

    it('POST /api/workspaces/[workspaceSlug]/projects/[projectId]/restore restores a revision', async () => {
        const { POST } = await import('../../app/api/workspaces/[workspaceSlug]/projects/[projectId]/restore/route');
        mockService.restoreRevision.mockReturnValue({
            id: 'project-1',
            currentRevisionId: 'rev-3',
        });

        const response = await POST(
            createRequest('/api/workspaces/ai-team/projects/project-1/restore', 'POST', {
                revisionId: 'rev-1',
                expectedRevisionId: 'rev-2',
            }),
            { params: Promise.resolve({ workspaceSlug: 'ai-team', projectId: 'project-1' }) }
        );

        expect(response.status).toBe(200);
        expect(mockService.restoreRevision).toHaveBeenCalledWith(mockPrincipal, 'project-1', {
            revisionId: 'rev-1',
            expectedRevisionId: 'rev-2',
        });
    });

    it('POST /api/workspaces/[workspaceSlug]/projects/[projectId]/restore returns 422 for injected revision payloads', async () => {
        const { POST } = await import('../../app/api/workspaces/[workspaceSlug]/projects/[projectId]/restore/route');

        const response = await POST(
            createRequest('/api/workspaces/ai-team/projects/project-1/restore', 'POST', {
                revisionId: '',
                expectedRevisionId: {
                    $gt: '',
                },
            }),
            { params: Promise.resolve({ workspaceSlug: 'ai-team', projectId: 'project-1' }) }
        );
        const data = await response.json();

        expect(response.status).toBe(422);
        expect(data.error.code).toBe('VALIDATION_FAILED');
        expect(data.error.details.revisionId).toBeDefined();
        expect(data.error.details.expectedRevisionId).toBeDefined();
        expect(mockService.restoreRevision).not.toHaveBeenCalled();
    });

    it('GET /api/workspaces/[workspaceSlug]/projects returns 403 when workspace access is denied', async () => {
        const { GET } = await import('../../app/api/workspaces/[workspaceSlug]/projects/route');
        mockResolvePrincipal.mockRejectedValue(
            new ApiError(403, 'WORKSPACE_FORBIDDEN', 'You do not have access to this workspace')
        );

        const response = await GET(createRequest('/api/workspaces/secret/projects'), {
            params: Promise.resolve({ workspaceSlug: 'secret' }),
        });
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.error.code).toBe('WORKSPACE_FORBIDDEN');
        expect(mockRequirePermission).not.toHaveBeenCalled();
    });
});
