import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { ProjectStore } from '../../app/lib/project-store';
import { createNewProject } from '../../app/lib/utils';
import { ProjectData } from '../../app/types';

// 模拟ProjectStore
vi.mock('../../app/lib/project-store', () => {
    return {
        ProjectStore: {
            listProjects: vi.fn(),
            saveProject: vi.fn(),
        }
    };
});

describe('Projects API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET /api/projects', () => {
        it('should list projects correctly', async () => {
            const { GET } = await import('../../app/api/projects/route');
            const mockProjects = [
                { id: '1', name: 'Proj1', createdAt: '2023', updatedAt: '2023' },
                { id: '2', name: 'Proj2', createdAt: '2023', updatedAt: '2023' },
            ];

            vi.mocked(ProjectStore.listProjects).mockResolvedValue(mockProjects);

            const response = await GET();

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toEqual(mockProjects);
            expect(ProjectStore.listProjects).toHaveBeenCalledTimes(1);
        });

        it('should handle list errors correctly', async () => {
            const { GET } = await import('../../app/api/projects/route');
            vi.mocked(ProjectStore.listProjects).mockRejectedValue(new Error('List error'));

            const response = await GET();

            expect(response.status).toBe(500);
            const data = await response.json();
            expect(data.error).toBe('List error');
        });
    });

    describe('POST /api/projects', () => {
        it('should create a new project with name', async () => {
            const { POST } = await import('../../app/api/projects/route');
            const reqObj = {
                json: async () => ({ name: 'Test Project' })
            };
            const request = reqObj as unknown as NextRequest;

            vi.mocked(ProjectStore.saveProject).mockResolvedValue();

            const response = await POST(request);

            expect(response.status).toBe(201);
            const data = await response.json();

            expect(data.meta.name).toBe('Test Project');
            expect(ProjectStore.saveProject).toHaveBeenCalledTimes(1);
        });

        it('should apply apiConfig if provided', async () => {
            const { POST } = await import('../../app/api/projects/route');
            const customApiConfig = {
                baseUrl: 'custom',
                apiKey: 'key',
                model: 'model',
                maxTokens: 100
            };
            const reqObj = {
                json: async () => ({
                    name: 'Test Project',
                    apiConfig: customApiConfig
                })
            };
            const request = reqObj as unknown as NextRequest;

            vi.mocked(ProjectStore.saveProject).mockResolvedValue();

            const response = await POST(request);

            expect(response.status).toBe(201);
            const data = await response.json();

            expect(data.apiConfig).toEqual(customApiConfig);
            expect(ProjectStore.saveProject).toHaveBeenCalledTimes(1);
        });

        it('should return 400 when name is missing', async () => {
            const { POST } = await import('../../app/api/projects/route');
            const reqObj = {
                json: async () => ({ apiConfig: {} })
            };
            const request = reqObj as unknown as NextRequest;

            const response = await POST(request);

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.error).toBe('Project name is required');
            expect(ProjectStore.saveProject).not.toHaveBeenCalled();
        });

        it('should handle save errors correctly', async () => {
            const { POST } = await import('../../app/api/projects/route');
            const reqObj = {
                json: async () => ({ name: 'Test' })
            };
            const request = reqObj as unknown as NextRequest;

            vi.mocked(ProjectStore.saveProject).mockRejectedValue(new Error('Save error'));

            const response = await POST(request);

            expect(response.status).toBe(500);
            const data = await response.json();
            expect(data.error).toBe('Save error');
        });
    });
});
