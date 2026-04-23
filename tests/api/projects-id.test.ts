import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../app/lib/api/errors';
import { ProjectData } from '../../app/types';

const mockPrincipal = {
    userId: 'user-1',
    activeWorkspaceId: 'workspace-1',
    activeWorkspaceSlug: 'workspace-1',
    workspaceRole: 'owner',
    permissions: ['project:read', 'project:write', 'project:delete'],
};

const mockService = {
    getLegacyProject: vi.fn(),
    updateLegacyProject: vi.fn(),
    deleteProject: vi.fn(),
};

vi.mock('../../app/lib/auth/principal', () => ({
    resolvePrincipal: vi.fn().mockResolvedValue(mockPrincipal),
    requirePermission: vi.fn(),
}));

vi.mock('../../app/lib/projects/service', () => ({
    getProjectService: () => mockService,
}));

function createRequest(method = 'GET', body?: unknown) {
    return new Request('http://localhost/api/projects/123', {
        method,
        headers: {
            'Content-Type': 'application/json',
            'x-dev-user-id': 'dev-user',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
}

describe('Project By ID API', () => {
    const mockProjectData: ProjectData = {
        meta: {
            id: '123',
            name: 'Test Project',
            createdAt: '2023-01-01T00:00:00.000Z',
            updatedAt: '2023-01-01T00:00:00.000Z',
        },
        systemPrompt: 'prompt',
        messages: [],
        apiConfig: {
            temperature: 0.2,
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns the requested project', async () => {
        const { GET } = await import('../../app/api/projects/[id]/route');
        mockService.getLegacyProject.mockReturnValue(mockProjectData);

        const response = await GET(createRequest(), { params: Promise.resolve({ id: '123' }) });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual(mockProjectData);
    });

    it('maps missing projects to API errors', async () => {
        const { GET } = await import('../../app/api/projects/[id]/route');
        mockService.getLegacyProject.mockImplementation(() => {
            throw new ApiError(404, 'PROJECT_NOT_FOUND', 'Project not found');
        });

        const response = await GET(createRequest(), { params: Promise.resolve({ id: '999' }) });
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error.code).toBe('PROJECT_NOT_FOUND');
    });

    it('updates a project and forces the route id', async () => {
        const { PUT } = await import('../../app/api/projects/[id]/route');
        mockService.updateLegacyProject.mockReturnValue(mockProjectData);

        const response = await PUT(
            createRequest('PUT', {
                ...mockProjectData,
                meta: { ...mockProjectData.meta, id: 'tampered-id' },
            }),
            { params: Promise.resolve({ id: '123' }) }
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual(mockProjectData.meta);
    });

    it('returns bad request errors for malformed JSON', async () => {
        const { PUT } = await import('../../app/api/projects/[id]/route');
        const malformedRequest = new Request('http://localhost/api/projects/123', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-dev-user-id': 'dev-user' },
            body: '{"meta":',
        });

        const response = await PUT(malformedRequest, { params: Promise.resolve({ id: '123' }) });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error.code).toBe('BAD_REQUEST');
        expect(mockService.updateLegacyProject).not.toHaveBeenCalled();
    });

    it('returns validation errors when the update payload is missing project metadata', async () => {
        const { PUT } = await import('../../app/api/projects/[id]/route');

        const response = await PUT(
            createRequest('PUT', {
                systemPrompt: 'prompt',
                messages: [],
                apiConfig: {
                    temperature: 0.2,
                },
            }),
            { params: Promise.resolve({ id: '123' }) }
        );
        const data = await response.json();

        expect(response.status).toBe(422);
        expect(data.error.code).toBe('VALIDATION_FAILED');
        expect(data.error.details.meta).toBeDefined();
        expect(mockService.updateLegacyProject).not.toHaveBeenCalled();
    });

    it('returns validation errors when apiConfig contains a non-string malicious value', async () => {
        const { PUT } = await import('../../app/api/projects/[id]/route');

        const response = await PUT(
            createRequest('PUT', {
                ...mockProjectData,
                apiConfig: 'invalid',
            }),
            { params: Promise.resolve({ id: '123' }) }
        );
        const data = await response.json();

        expect(response.status).toBe(422);
        expect(data.error.code).toBe('VALIDATION_FAILED');
        expect(data.error.details.apiConfig).toBeDefined();
        expect(mockService.updateLegacyProject).not.toHaveBeenCalled();
    });

    it('deletes the target project', async () => {
        const { DELETE } = await import('../../app/api/projects/[id]/route');

        const response = await DELETE(createRequest('DELETE'), { params: Promise.resolve({ id: '123' }) });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ success: true });
        expect(mockService.deleteProject).toHaveBeenCalledWith(mockPrincipal, '123');
    });
});
