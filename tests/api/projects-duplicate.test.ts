import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../app/lib/api/errors';
import { ProjectData } from '../../app/types';

const mockPrincipal = {
    userId: 'user-1',
    activeWorkspaceId: 'workspace-1',
    activeWorkspaceSlug: 'workspace-1',
    workspaceRole: 'owner',
    permissions: ['project:write'],
};

const mockService = {
    duplicateProject: vi.fn(),
};

vi.mock('../../app/lib/auth/principal', () => ({
    resolvePrincipal: vi.fn().mockResolvedValue(mockPrincipal),
    requirePermission: vi.fn(),
}));

vi.mock('../../app/lib/projects/service', () => ({
    getProjectService: () => mockService,
}));

describe('Project Duplicate API', () => {
    const duplicatedProject: ProjectData = {
        meta: {
            id: 'duplicated-project-id',
            name: 'Original Project (Copy)',
            createdAt: '2026-04-19T10:00:00.000Z',
            updatedAt: '2026-04-19T10:00:00.000Z',
        },
        systemPrompt: 'prompt',
        messages: [],
        apiConfig: {
            baseUrl: 'https://api.anthropic.com',
            apiKey: 'key',
            model: 'claude-sonnet-4-20250514',
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-19T10:00:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('duplicates the project and returns its meta', async () => {
        const { POST } = await import('../../app/api/projects/[id]/duplicate/route');
        mockService.duplicateProject.mockReturnValue(duplicatedProject);

        const response = await POST(
            new Request('http://localhost/api/projects/source-project/duplicate', {
                method: 'POST',
                headers: { 'x-dev-user-id': 'dev-user' },
            }),
            { params: Promise.resolve({ id: 'source-project' }) }
        );
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual(duplicatedProject.meta);
        expect(mockService.duplicateProject).toHaveBeenCalledWith(mockPrincipal, 'source-project');
    });

    it('maps duplication failures to API errors', async () => {
        const { POST } = await import('../../app/api/projects/[id]/duplicate/route');
        mockService.duplicateProject.mockImplementation(() => {
            throw new ApiError(500, 'INTERNAL_ERROR', 'Unsafe duplicate payload');
        });

        const response = await POST(
            new Request('http://localhost/api/projects/source-project/duplicate', {
                method: 'POST',
                headers: { 'x-dev-user-id': 'dev-user' },
            }),
            { params: Promise.resolve({ id: 'source-project' }) }
        );
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error.message).toBe('Unsafe duplicate payload');
    });
});
