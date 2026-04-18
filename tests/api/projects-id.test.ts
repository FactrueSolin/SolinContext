import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectStore } from '../../app/lib/project-store';
import { ProjectData } from '../../app/types';

vi.mock('../../app/lib/project-store', () => ({
    ProjectStore: {
        getProject: vi.fn(),
        saveProject: vi.fn(),
        deleteProject: vi.fn(),
    },
}));

function createProjectUpdateRequest(body: unknown) {
    return new Request('http://localhost/api/projects/123', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
            baseUrl: 'url',
            apiKey: 'key',
            model: 'model',
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET /api/projects/[id]', () => {
        it('returns the requested project', async () => {
            const { GET } = await import('../../app/api/projects/[id]/route');

            vi.mocked(ProjectStore.getProject).mockResolvedValue(mockProjectData);

            const response = await GET({} as Request, { params: Promise.resolve({ id: '123' }) });

            expect(response.status).toBe(200);
            await expect(response.json()).resolves.toEqual(mockProjectData);
            expect(ProjectStore.getProject).toHaveBeenCalledWith('123');
        });

        it('returns 404 when project does not exist', async () => {
            const { GET } = await import('../../app/api/projects/[id]/route');

            vi.mocked(ProjectStore.getProject).mockRejectedValue(new Error('Project not found'));

            const response = await GET({} as Request, { params: Promise.resolve({ id: '999' }) });

            expect(response.status).toBe(404);
            await expect(response.json()).resolves.toEqual({ error: 'Project not found' });
        });

        it('returns 404 when a malicious project id is rejected by storage', async () => {
            const { GET } = await import('../../app/api/projects/[id]/route');

            vi.mocked(ProjectStore.getProject).mockRejectedValue(new Error('Invalid project id'));

            const response = await GET({} as Request, {
                params: Promise.resolve({ id: '../../../etc/passwd' }),
            });

            expect(response.status).toBe(404);
            await expect(response.json()).resolves.toEqual({ error: 'Invalid project id' });
            expect(ProjectStore.getProject).toHaveBeenCalledWith('../../../etc/passwd');
        });
    });

    describe('PUT /api/projects/[id]', () => {
        it('updates a project and forces body.meta.id to match the route id', async () => {
            const { PUT } = await import('../../app/api/projects/[id]/route');

            vi.mocked(ProjectStore.saveProject).mockResolvedValue();

            const response = await PUT(
                createProjectUpdateRequest({
                    ...mockProjectData,
                    meta: { ...mockProjectData.meta, id: 'tampered-id' },
                }),
                { params: Promise.resolve({ id: '123' }) },
            );

            expect(response.status).toBe(200);
            await expect(response.json()).resolves.toEqual(mockProjectData.meta);
            expect(ProjectStore.saveProject).toHaveBeenCalledWith(mockProjectData);
        });

        it('returns 500 when request body is invalid JSON', async () => {
            const { PUT } = await import('../../app/api/projects/[id]/route');
            const malformedRequest = new Request('http://localhost/api/projects/123', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: '{"meta":',
            });

            const response = await PUT(malformedRequest, { params: Promise.resolve({ id: '123' }) });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toContain('JSON');
        });

        it('returns 500 when ProjectStore.saveProject fails', async () => {
            const { PUT } = await import('../../app/api/projects/[id]/route');

            vi.mocked(ProjectStore.saveProject).mockRejectedValue(new Error('Save error'));

            const response = await PUT(createProjectUpdateRequest(mockProjectData), {
                params: Promise.resolve({ id: '123' }),
            });

            expect(response.status).toBe(500);
            await expect(response.json()).resolves.toEqual({ error: 'Save error' });
        });
    });

    describe('DELETE /api/projects/[id]', () => {
        it('deletes the target project', async () => {
            const { DELETE } = await import('../../app/api/projects/[id]/route');

            vi.mocked(ProjectStore.deleteProject).mockResolvedValue();

            const response = await DELETE({} as Request, { params: Promise.resolve({ id: '123' }) });

            expect(response.status).toBe(200);
            await expect(response.json()).resolves.toEqual({ success: true });
            expect(ProjectStore.deleteProject).toHaveBeenCalledWith('123');
        });

        it('returns 500 when ProjectStore.deleteProject fails', async () => {
            const { DELETE } = await import('../../app/api/projects/[id]/route');

            vi.mocked(ProjectStore.deleteProject).mockRejectedValue(new Error('Delete error'));

            const response = await DELETE({} as Request, { params: Promise.resolve({ id: '123' }) });

            expect(response.status).toBe(500);
            await expect(response.json()).resolves.toEqual({ error: 'Delete error' });
        });
    });
});
