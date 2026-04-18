import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectStore } from '../../app/lib/project-store';
import { ProjectData } from '../../app/types';

vi.mock('../../app/lib/project-store', () => ({
    ProjectStore: {
        listHistory: vi.fn(),
        getHistoryEntry: vi.fn(),
    },
}));

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

    describe('GET /api/projects/[id]/history', () => {
        it('returns history entries for a project', async () => {
            const { GET } = await import('../../app/api/projects/[id]/history/route');
            const mockHistory = [
                { filename: '2025-01-01T00-00-00-000Z.json', timestamp: '2025-01-01T00:00:00.000Z' },
                { filename: '2024-12-31T00-00-00-000Z.json', timestamp: '2024-12-31T00:00:00.000Z' },
            ];

            vi.mocked(ProjectStore.listHistory).mockResolvedValue(mockHistory);

            const response = await GET({} as Request, { params: Promise.resolve({ id: '123' }) });

            expect(response.status).toBe(200);
            await expect(response.json()).resolves.toEqual(mockHistory);
            expect(ProjectStore.listHistory).toHaveBeenCalledWith('123');
        });

        it('returns 500 when ProjectStore.listHistory fails', async () => {
            const { GET } = await import('../../app/api/projects/[id]/history/route');

            vi.mocked(ProjectStore.listHistory).mockRejectedValue(new Error('History read failed'));

            const response = await GET({} as Request, { params: Promise.resolve({ id: '123' }) });

            expect(response.status).toBe(500);
            await expect(response.json()).resolves.toEqual({ error: 'History read failed' });
        });
    });

    describe('GET /api/projects/[id]/history/[filename]', () => {
        it('returns a specific history snapshot', async () => {
            const { GET } = await import('../../app/api/projects/[id]/history/[filename]/route');

            vi.mocked(ProjectStore.getHistoryEntry).mockResolvedValue(historyProject);

            const response = await GET({} as Request, {
                params: Promise.resolve({ id: '123', filename: '2025-01-01T00-00-00-000Z.json' }),
            });

            expect(response.status).toBe(200);
            await expect(response.json()).resolves.toEqual(historyProject);
            expect(ProjectStore.getHistoryEntry).toHaveBeenCalledWith('123', '2025-01-01T00-00-00-000Z.json');
        });

        it('returns 404 when the history snapshot does not exist', async () => {
            const { GET } = await import('../../app/api/projects/[id]/history/[filename]/route');

            vi.mocked(ProjectStore.getHistoryEntry).mockRejectedValue(new Error('History entry not found'));

            const response = await GET({} as Request, {
                params: Promise.resolve({ id: '123', filename: 'missing.json' }),
            });

            expect(response.status).toBe(404);
            await expect(response.json()).resolves.toEqual({ error: 'History entry not found' });
        });

        it('returns 404 when a path traversal filename is rejected', async () => {
            const { GET } = await import('../../app/api/projects/[id]/history/[filename]/route');

            vi.mocked(ProjectStore.getHistoryEntry).mockRejectedValue(new Error('Invalid history filename'));

            const response = await GET({} as Request, {
                params: Promise.resolve({ id: '123', filename: '../../../etc/passwd' }),
            });

            expect(response.status).toBe(404);
            await expect(response.json()).resolves.toEqual({ error: 'Invalid history filename' });
            expect(ProjectStore.getHistoryEntry).toHaveBeenCalledWith('123', '../../../etc/passwd');
        });
    });
});
