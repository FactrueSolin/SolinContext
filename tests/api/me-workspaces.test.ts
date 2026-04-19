import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../app/lib/api/errors';

const mockCurrentUserSummary = vi.fn();
const mockListAccessibleWorkspaces = vi.fn();

vi.mock('../../app/lib/auth/principal', () => ({
    getCurrentUserSummary: mockCurrentUserSummary,
    listAccessibleWorkspaces: mockListAccessibleWorkspaces,
}));

describe('Session Discovery API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('GET /api/me returns the current user and default workspace in a wrapped payload', async () => {
        const { GET } = await import('../../app/api/me/route');
        mockCurrentUserSummary.mockResolvedValue({
            user: {
                id: 'user-1',
                email: 'alice@example.com',
                name: 'Alice',
                avatarUrl: null,
            },
            defaultWorkspace: {
                id: 'workspace-1',
                slug: 'alice',
                type: 'personal',
                role: 'owner',
            },
        });

        const response = await GET(
            new Request('http://localhost/api/me', {
                headers: { 'x-request-id': 'req-me-1' },
            })
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            data: {
                user: {
                    id: 'user-1',
                    email: 'alice@example.com',
                    name: 'Alice',
                    avatarUrl: null,
                },
                defaultWorkspace: {
                    id: 'workspace-1',
                    slug: 'alice',
                    type: 'personal',
                    role: 'owner',
                },
            },
        });
        expect(mockCurrentUserSummary).toHaveBeenCalledTimes(1);
    });

    it('GET /api/me maps unauthenticated failures into the shared error envelope', async () => {
        const { GET } = await import('../../app/api/me/route');
        mockCurrentUserSummary.mockRejectedValue(
            new ApiError(401, 'UNAUTHENTICATED', 'Authentication required')
        );

        const response = await GET(
            new Request('http://localhost/api/me', {
                headers: { 'x-request-id': 'req-me-auth' },
            })
        );
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data).toEqual({
            error: {
                code: 'UNAUTHENTICATED',
                message: 'Authentication required',
                details: null,
                requestId: 'req-me-auth',
            },
        });
    });

    it('GET /api/workspaces returns accessible workspaces in a wrapped list', async () => {
        const { GET } = await import('../../app/api/workspaces/route');
        mockListAccessibleWorkspaces.mockResolvedValue([
            {
                id: 'workspace-1',
                slug: 'alice',
                name: "Alice's Workspace",
                type: 'personal',
                role: 'owner',
                isDefault: true,
            },
            {
                id: 'workspace-2',
                slug: 'ai-team',
                name: 'AI Team',
                type: 'organization',
                role: 'editor',
                isDefault: false,
            },
        ]);

        const response = await GET(new Request('http://localhost/api/workspaces'));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            data: [
                {
                    id: 'workspace-1',
                    slug: 'alice',
                    name: "Alice's Workspace",
                    type: 'personal',
                    role: 'owner',
                    isDefault: true,
                },
                {
                    id: 'workspace-2',
                    slug: 'ai-team',
                    name: 'AI Team',
                    type: 'organization',
                    role: 'editor',
                    isDefault: false,
                },
            ],
        });
        expect(mockListAccessibleWorkspaces).toHaveBeenCalledTimes(1);
    });

    it('GET /api/workspaces preserves request ids when the session is invalid', async () => {
        const { GET } = await import('../../app/api/workspaces/route');
        mockListAccessibleWorkspaces.mockRejectedValue(
            new ApiError(401, 'UNAUTHENTICATED', 'Authentication required')
        );

        const response = await GET(
            new Request('http://localhost/api/workspaces', {
                headers: { 'x-request-id': 'req-workspaces-auth' },
            })
        );
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error.code).toBe('UNAUTHENTICATED');
        expect(data.error.requestId).toBe('req-workspaces-auth');
        expect(response.headers.get('x-request-id')).toBe('req-workspaces-auth');
    });
});
