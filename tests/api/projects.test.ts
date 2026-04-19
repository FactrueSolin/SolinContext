import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../app/lib/api/errors';

const mockPrincipal = {
    userId: 'user-1',
    activeWorkspaceId: 'workspace-1',
    activeWorkspaceSlug: 'workspace-1',
    workspaceRole: 'owner',
    permissions: ['project:read', 'project:write', 'project:delete'],
};

const mockService = {
    listProjects: vi.fn(),
    createLegacyProject: vi.fn(),
};

vi.mock('../../app/lib/auth/principal', () => ({
    resolvePrincipal: vi.fn().mockResolvedValue(mockPrincipal),
    requirePermission: vi.fn(),
}));

vi.mock('../../app/lib/projects/service', () => ({
    getProjectService: () => mockService,
}));

function createRequest(method = 'GET', body?: unknown) {
    return new Request('http://localhost/api/projects', {
        method,
        headers: {
            'Content-Type': 'application/json',
            'x-dev-user-id': 'dev-user',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
}

describe('Projects API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns project summaries', async () => {
        const { GET } = await import('../../app/api/projects/route');
        mockService.listProjects.mockReturnValue({
            items: [
                { id: '1', name: 'Proj1', createdAt: '2023', updatedAt: '2023' },
                { id: '2', name: 'Proj2', createdAt: '2024', updatedAt: '2024' },
            ],
        });

        const response = await GET(createRequest());

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual([
            { id: '1', name: 'Proj1', createdAt: '2023', updatedAt: '2023' },
            { id: '2', name: 'Proj2', createdAt: '2024', updatedAt: '2024' },
        ]);
        expect(mockService.listProjects).toHaveBeenCalledWith(mockPrincipal, {
            query: undefined,
            page: 1,
            pageSize: 100,
            sortBy: 'updatedAt',
            sortOrder: 'desc',
        });
    });

    it('returns wrapped errors when listing fails', async () => {
        const { GET } = await import('../../app/api/projects/route');
        mockService.listProjects.mockImplementation(() => {
            throw new Error('List error');
        });

        const response = await GET(createRequest());
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error.code).toBe('INTERNAL_ERROR');
        expect(data.error.message).toBe('List error');
    });

    it('creates a legacy project payload', async () => {
        const { POST } = await import('../../app/api/projects/route');
        mockService.createLegacyProject.mockReturnValue({
            meta: {
                id: 'project-1',
                name: 'Test Project',
                createdAt: '2026-04-19T00:00:00.000Z',
                updatedAt: '2026-04-19T00:00:00.000Z',
            },
            systemPrompt: 'You are a helpful assistant.',
            messages: [],
            apiConfig: {
                baseUrl: 'https://proxy.example.com',
                apiKey: 'key',
                model: 'model',
            },
        });

        const response = await POST(
            createRequest('POST', {
                name: 'Test Project',
                apiConfig: {
                    baseUrl: 'https://proxy.example.com',
                    apiKey: 'key',
                    model: 'model',
                },
            })
        );
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.meta.name).toBe('Test Project');
        expect(mockService.createLegacyProject).toHaveBeenCalledTimes(1);
    });

    it('returns validation errors for missing names', async () => {
        const { POST } = await import('../../app/api/projects/route');
        const response = await POST(createRequest('POST', { apiConfig: {} }));
        const data = await response.json();

        expect(response.status).toBe(422);
        expect(data.error.code).toBe('VALIDATION_FAILED');
        expect(mockService.createLegacyProject).not.toHaveBeenCalled();
    });

    it('returns validation errors when the project name only contains whitespace', async () => {
        const { POST } = await import('../../app/api/projects/route');

        const response = await POST(createRequest('POST', { name: '   ' }));
        const data = await response.json();

        expect(response.status).toBe(422);
        expect(data.error.code).toBe('VALIDATION_FAILED');
        expect(data.error.details.name).toBeDefined();
        expect(mockService.createLegacyProject).not.toHaveBeenCalled();
    });

    it('returns validation errors when the project name is a non-string injection payload', async () => {
        const { POST } = await import('../../app/api/projects/route');

        const response = await POST(
            createRequest('POST', {
                name: {
                    $gt: '',
                },
            })
        );
        const data = await response.json();

        expect(response.status).toBe(422);
        expect(data.error.code).toBe('VALIDATION_FAILED');
        expect(data.error.details.name).toBeDefined();
        expect(mockService.createLegacyProject).not.toHaveBeenCalled();
    });

    it('returns validation errors when apiConfig is malformed', async () => {
        const { POST } = await import('../../app/api/projects/route');

        const response = await POST(
            createRequest('POST', {
                name: 'Test Project',
                apiConfig: {
                    baseUrl: 'https://proxy.example.com',
                    apiKey: ['sk-test'],
                    model: 'claude',
                },
            })
        );
        const data = await response.json();

        expect(response.status).toBe(422);
        expect(data.error.code).toBe('VALIDATION_FAILED');
        expect(data.error.details.apiConfig).toBeDefined();
        expect(mockService.createLegacyProject).not.toHaveBeenCalled();
    });

    it('returns bad request errors for invalid JSON', async () => {
        const { POST } = await import('../../app/api/projects/route');
        const malformedRequest = new Request('http://localhost/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-dev-user-id': 'dev-user' },
            body: '{"name":',
        });

        const response = await POST(malformedRequest);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error.code).toBe('BAD_REQUEST');
        expect(data.error.message).toBe('Invalid JSON request body');
        expect(mockService.createLegacyProject).not.toHaveBeenCalled();
    });

    it('surfaces internal errors from project creation', async () => {
        const { POST } = await import('../../app/api/projects/route');
        mockService.createLegacyProject.mockImplementation(() => {
            throw new ApiError(500, 'INTERNAL_ERROR', 'Unsafe project name');
        });

        const response = await POST(createRequest('POST', { name: 'Test Project' }));
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error.message).toBe('Unsafe project name');
    });
});
