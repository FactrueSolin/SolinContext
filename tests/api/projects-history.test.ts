import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../app/lib/api/errors';
import { ProjectData } from '../../app/types';

const mockPrincipal = {
    userId: 'user-1',
    activeWorkspaceId: 'workspace-1',
    activeWorkspaceSlug: 'workspace-1',
    workspaceRole: 'owner',
    permissions: ['project:read'],
};

const mockService = {
    listCompatHistory: vi.fn(),
    getRevisionByCompatFilename: vi.fn(),
};

vi.mock('../../app/lib/auth/principal', () => ({
    resolvePrincipal: vi.fn().mockResolvedValue(mockPrincipal),
    requirePermission: vi.fn(),
}));

vi.mock('../../app/lib/projects/service', () => ({
    getProjectService: () => mockService,
}));

function createRequest() {
    return new Request('http://localhost/api/projects/123/history', {
        headers: { 'x-dev-user-id': 'dev-user' },
    });
}

describe('Project History API', () => {
    const historyProject: ProjectData = {
        meta: {
            id: '123',
            name: 'History Snapshot',
            createdAt: '2023-01-01T00:00:00.000Z',
            updatedAt: '2023-01-01T00:00:00.000Z',
        },
        systemPrompt: 'prompt',
        messages: [],
        apiConfig: {
            baseUrl: 'url',
            apiKey: 'key',
            model: 'model',
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns history entries for a project', async () => {
        const { GET } = await import('../../app/api/projects/[id]/history/route');
        const mockHistory = [
            { filename: 'rev-2.json', timestamp: '2025-01-01T00:00:00.000Z' },
            { filename: 'rev-1.json', timestamp: '2024-12-31T00:00:00.000Z' },
        ];
        mockService.listCompatHistory.mockReturnValue(mockHistory);

        const response = await GET(createRequest(), { params: Promise.resolve({ id: '123' }) });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual(mockHistory);
    });

    it('returns an asset snapshot for a compat history filename', async () => {
        const { GET } = await import('../../app/api/projects/[id]/history/[filename]/route');
        mockService.getRevisionByCompatFilename.mockReturnValue(historyProject);

        const response = await GET(createRequest(), {
            params: Promise.resolve({ id: '123', filename: 'rev-1.json' }),
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual(historyProject);
    });

    it('maps missing history revisions to API errors', async () => {
        const { GET } = await import('../../app/api/projects/[id]/history/[filename]/route');
        mockService.getRevisionByCompatFilename.mockImplementation(() => {
            throw new ApiError(404, 'PROJECT_REVISION_NOT_FOUND', 'History entry not found');
        });

        const response = await GET(createRequest(), {
            params: Promise.resolve({ id: '123', filename: 'missing.json' }),
        });
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error.code).toBe('PROJECT_REVISION_NOT_FOUND');
    });
});
