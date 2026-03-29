import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { ProjectStore } from '../../app/lib/project-store';
import { ProjectData } from '../../app/types';

vi.mock('../../app/lib/project-store', () => {
    return {
        ProjectStore: {
            getProject: vi.fn(),
            saveProject: vi.fn(),
            deleteProject: vi.fn(),
        }
    };
});

describe('Projects ID API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const mockProjectData: ProjectData = {
        meta: {
            id: '123',
            name: 'Test Project',
            createdAt: '2023-01-01T00:00:00.000Z',
            updatedAt: '2023-01-01T00:00:00.000Z'
        },
        systemPrompt: 'prompt',
        messages: [],
        apiConfig: {
            baseUrl: 'url',
            apiKey: 'key',
            model: 'model',
            maxTokens: 100
        }
    };

    describe('GET /api/projects/[id]', () => {
        it('should get a specific project by id', async () => {
            const { GET } = await import('../../app/api/projects/[id]/route');
            vi.mocked(ProjectStore.getProject).mockResolvedValue(mockProjectData);

            const params = Promise.resolve({ id: '123' });
            const response = await GET({} as Request, { params });

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toEqual(mockProjectData);
            expect(ProjectStore.getProject).toHaveBeenCalledWith('123');
        });

        it('should return 404 when project not found', async () => {
            const { GET } = await import('../../app/api/projects/[id]/route');
            vi.mocked(ProjectStore.getProject).mockRejectedValue(new Error('Project not found'));

            const params = Promise.resolve({ id: '999' });
            const response = await GET({} as Request, { params });

            expect(response.status).toBe(404);
            const data = await response.json();
            expect(data.error).toBe('Project not found');
        });
    });

    describe('PUT /api/projects/[id]', () => {
        it('should update an existing project and return meta', async () => {
            const { PUT } = await import('../../app/api/projects/[id]/route');
            const reqObj = {
                json: async () => mockProjectData
            };
            const request = reqObj as unknown as Request;
            vi.mocked(ProjectStore.saveProject).mockResolvedValue();

            const params = Promise.resolve({ id: '123' });
            const response = await PUT(request, { params });

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toEqual(mockProjectData.meta);
            expect(ProjectStore.saveProject).toHaveBeenCalledWith(mockProjectData);
        });

        it('should handle save errors correctly', async () => {
            const { PUT } = await import('../../app/api/projects/[id]/route');
            const reqObj = {
                json: async () => mockProjectData
            };
            const request = reqObj as unknown as Request;
            vi.mocked(ProjectStore.saveProject).mockRejectedValue(new Error('Save error'));

            const params = Promise.resolve({ id: '123' });
            const response = await PUT(request, { params });

            expect(response.status).toBe(500);
            const data = await response.json();
            expect(data.error).toBe('Save error');
        });
    });

    describe('DELETE /api/projects/[id]', () => {
        it('should delete a specific project', async () => {
            const { DELETE } = await import('../../app/api/projects/[id]/route');
            vi.mocked(ProjectStore.deleteProject).mockResolvedValue();

            const params = Promise.resolve({ id: '123' });
            const response = await DELETE({} as Request, { params });

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toEqual({ success: true });
            expect(ProjectStore.deleteProject).toHaveBeenCalledWith('123');
        });

        it('should handle delete errors correctly', async () => {
            const { DELETE } = await import('../../app/api/projects/[id]/route');
            vi.mocked(ProjectStore.deleteProject).mockRejectedValue(new Error('Delete error'));

            const params = Promise.resolve({ id: '123' });
            const response = await DELETE({} as Request, { params });

            expect(response.status).toBe(500);
            const data = await response.json();
            expect(data.error).toBe('Delete error');
        });
    });
});
