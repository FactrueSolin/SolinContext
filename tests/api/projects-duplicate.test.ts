import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectStore } from '../../app/lib/project-store';
import { ProjectData } from '../../app/types';

vi.mock('../../app/lib/project-store', () => ({
    ProjectStore: {
        getProject: vi.fn(),
        saveProject: vi.fn(),
    },
}));

vi.mock('../../app/lib/utils', async () => {
    const actual = await vi.importActual<typeof import('../../app/lib/utils')>('../../app/lib/utils');
    return {
        ...actual,
        generateId: vi.fn(() => 'duplicated-project-id'),
    };
});

describe('Project Duplicate API', () => {
    const originalProject: ProjectData = {
        meta: {
            id: 'source-project',
            name: 'Original Project',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-02T00:00:00.000Z',
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

    describe('POST /api/projects/[id]/duplicate', () => {
        it('duplicates the project, rewrites meta, and persists the copy', async () => {
            const { POST } = await import('../../app/api/projects/[id]/duplicate/route');

            vi.mocked(ProjectStore.getProject).mockResolvedValue(originalProject);
            vi.mocked(ProjectStore.saveProject).mockResolvedValue();

            const response = await POST({} as Request, {
                params: Promise.resolve({ id: 'source-project' }),
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toEqual({
                id: 'duplicated-project-id',
                name: 'Original Project (副本)',
                createdAt: '2026-04-19T10:00:00.000Z',
                updatedAt: '2026-04-19T10:00:00.000Z',
            });
            expect(ProjectStore.getProject).toHaveBeenCalledWith('source-project');
            expect(ProjectStore.saveProject).toHaveBeenCalledWith({
                ...originalProject,
                meta: {
                    id: 'duplicated-project-id',
                    name: 'Original Project (副本)',
                    createdAt: '2026-04-19T10:00:00.000Z',
                    updatedAt: '2026-04-19T10:00:00.000Z',
                },
            });
        });

        it('returns 500 when the source project cannot be loaded', async () => {
            const { POST } = await import('../../app/api/projects/[id]/duplicate/route');

            vi.mocked(ProjectStore.getProject).mockRejectedValue(new Error('Project not found'));

            const response = await POST({} as Request, {
                params: Promise.resolve({ id: 'missing-project' }),
            });

            expect(response.status).toBe(500);
            await expect(response.json()).resolves.toEqual({ error: 'Project not found' });
        });

        it('returns 500 when persistence rejects a duplicated malicious project', async () => {
            const { POST } = await import('../../app/api/projects/[id]/duplicate/route');

            vi.mocked(ProjectStore.getProject).mockResolvedValue(originalProject);
            vi.mocked(ProjectStore.saveProject).mockRejectedValue(new Error('Unsafe duplicate payload'));

            const response = await POST({} as Request, {
                params: Promise.resolve({ id: 'source-project' }),
            });

            expect(response.status).toBe(500);
            await expect(response.json()).resolves.toEqual({ error: 'Unsafe duplicate payload' });
        });
    });
});
