import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectStore } from '../../app/lib/project-store';

vi.mock('../../app/lib/project-store', () => ({
    ProjectStore: {
        listProjects: vi.fn(),
        saveProject: vi.fn(),
    },
}));

function createJsonRequest(body: unknown) {
    return new Request('http://localhost/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

describe('Projects API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET /api/projects', () => {
        it('returns project summaries from ProjectStore', async () => {
            const { GET } = await import('../../app/api/projects/route');
            const mockProjects = [
                { id: '1', name: 'Proj1', createdAt: '2023', updatedAt: '2023' },
                { id: '2', name: 'Proj2', createdAt: '2023', updatedAt: '2023' },
            ];

            vi.mocked(ProjectStore.listProjects).mockResolvedValue(mockProjects);

            const response = await GET();

            expect(response.status).toBe(200);
            await expect(response.json()).resolves.toEqual(mockProjects);
            expect(ProjectStore.listProjects).toHaveBeenCalledTimes(1);
        });

        it('returns 500 when ProjectStore.listProjects throws', async () => {
            const { GET } = await import('../../app/api/projects/route');

            vi.mocked(ProjectStore.listProjects).mockRejectedValue(new Error('List error'));

            const response = await GET();

            expect(response.status).toBe(500);
            await expect(response.json()).resolves.toEqual({ error: 'List error' });
        });
    });

    describe('POST /api/projects', () => {
        it('creates a new project and persists it', async () => {
            const { POST } = await import('../../app/api/projects/route');

            vi.mocked(ProjectStore.saveProject).mockResolvedValue();

            const response = await POST(createJsonRequest({ name: 'Test Project' }));
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.meta.name).toBe('Test Project');
            expect(data.apiConfig).toEqual({
                baseUrl: 'https://api.anthropic.com',
                apiKey: '',
                model: 'claude-sonnet-4-20250514',
            });
            expect(ProjectStore.saveProject).toHaveBeenCalledTimes(1);
            expect(vi.mocked(ProjectStore.saveProject).mock.calls[0][0].meta.name).toBe('Test Project');
        });

        it('uses the provided apiConfig when present', async () => {
            const { POST } = await import('../../app/api/projects/route');
            const customApiConfig = {
                baseUrl: 'https://proxy.example.com',
                apiKey: 'key',
                model: 'model',
            };

            vi.mocked(ProjectStore.saveProject).mockResolvedValue();

            const response = await POST(
                createJsonRequest({
                    name: 'Test Project',
                    apiConfig: customApiConfig,
                }),
            );
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.apiConfig).toEqual(customApiConfig);
        });

        it('returns 400 when name is missing', async () => {
            const { POST } = await import('../../app/api/projects/route');

            const response = await POST(createJsonRequest({ apiConfig: {} }));

            expect(response.status).toBe(400);
            await expect(response.json()).resolves.toEqual({ error: 'Project name is required' });
            expect(ProjectStore.saveProject).not.toHaveBeenCalled();
        });

        it('returns 500 when request body is invalid JSON', async () => {
            const { POST } = await import('../../app/api/projects/route');
            const malformedRequest = new Request('http://localhost/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{"name":',
            });

            const response = await POST(malformedRequest);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toContain('JSON');
            expect(ProjectStore.saveProject).not.toHaveBeenCalled();
        });

        it('returns 500 when ProjectStore.saveProject rejects suspicious payloads', async () => {
            const { POST } = await import('../../app/api/projects/route');

            vi.mocked(ProjectStore.saveProject).mockRejectedValue(new Error('Unsafe project name'));

            const response = await POST(createJsonRequest({ name: '" OR 1=1 --' }));

            expect(response.status).toBe(500);
            await expect(response.json()).resolves.toEqual({ error: 'Unsafe project name' });
        });
    });
});
