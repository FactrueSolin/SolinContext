// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../app/lib/api/errors';

const mockPrincipal = {
    userId: 'user-1',
    activeWorkspaceId: 'workspace-1',
    activeWorkspaceSlug: 'ai-team',
    activeWorkspaceName: 'AI Team',
    activeWorkspaceType: 'organization',
    activeWorkspaceStatus: 'active',
    workspaceRole: 'owner',
    permissions: ['aigc_detection:read', 'aigc_detection:write'],
};

const mockService = {
    listTasks: vi.fn(),
    createTask: vi.fn(),
    getTaskDetail: vi.fn(),
    getTaskResult: vi.fn(),
    getTaskCleanedMarkdown: vi.fn(),
    getTaskMarkedMarkdown: vi.fn(),
    retryTask: vi.fn(),
};

const mockResolvePrincipal = vi.fn();
const mockRequirePermission = vi.fn();

vi.mock('../../app/lib/auth/principal', () => ({
    resolvePrincipal: mockResolvePrincipal,
    requirePermission: mockRequirePermission,
}));

vi.mock('../../app/lib/aigc-detection/service', () => ({
    getAigcDetectionService: () => mockService,
}));

function createRequest(path: string, method = 'GET', body?: BodyInit, headers: HeadersInit = {}) {
    return new Request(`http://localhost${path}`, {
        method,
        headers,
        body,
    });
}

describe('Workspace AIGC detection API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockResolvePrincipal.mockResolvedValue(mockPrincipal);
        mockRequirePermission.mockImplementation(() => undefined);
    });

    it('lists tasks with parsed query params', async () => {
        const { GET } = await import('../../app/api/workspaces/[workspaceSlug]/aigc-detection/tasks/route');
        mockService.listTasks.mockReturnValue({
            items: [{ id: 'task-1', status: 'submitted' }],
            pagination: { page: 2, pageSize: 10, total: 1 },
        });

        const response = await GET(
            createRequest('/api/workspaces/ai-team/aigc-detection/tasks?page=2&pageSize=10&status=submitted&keyword=%20paper%20'),
            { params: Promise.resolve({ workspaceSlug: 'ai-team' }) }
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            data: {
                items: [{ id: 'task-1', status: 'submitted' }],
                pagination: { page: 2, pageSize: 10, total: 1 },
            },
        });
        expect(mockRequirePermission).toHaveBeenCalledWith(mockPrincipal, 'aigc_detection:read');
        expect(mockService.listTasks).toHaveBeenCalledWith(mockPrincipal, {
            page: 2,
            pageSize: 10,
            status: 'submitted',
            keyword: 'paper',
        });
    });

    it('creates a task from multipart form data', async () => {
        const { POST } = await import('../../app/api/workspaces/[workspaceSlug]/aigc-detection/tasks/route');
        mockService.createTask.mockResolvedValue({
            task: { id: 'task-1', status: 'submitted' },
            reusedResult: false,
        });

        const formData = new FormData();
        formData.set('file', new File(['demo'], 'paper.pdf', { type: 'application/pdf' }));
        formData.set('forceReprocess', 'true');

        const response = await POST(
            createRequest('/api/workspaces/ai-team/aigc-detection/tasks', 'POST', formData),
            { params: Promise.resolve({ workspaceSlug: 'ai-team' }) }
        );

        expect(response.status).toBe(201);
        expect(mockRequirePermission).toHaveBeenCalledWith(mockPrincipal, 'aigc_detection:write');
        expect(mockService.createTask).toHaveBeenCalledWith(
            mockPrincipal,
            expect.objectContaining({
                forceReprocess: true,
                file: expect.objectContaining({ name: 'paper.pdf' }),
            })
        );
    });

    it('returns validation errors when file is missing', async () => {
        const { POST } = await import('../../app/api/workspaces/[workspaceSlug]/aigc-detection/tasks/route');
        const response = await POST(
            createRequest('/api/workspaces/ai-team/aigc-detection/tasks', 'POST', new FormData()),
            { params: Promise.resolve({ workspaceSlug: 'ai-team' }) }
        );
        const data = await response.json();

        expect(response.status).toBe(422);
        expect(data.error.code).toBe('AIGC_DETECTION_VALIDATION_FAILED');
        expect(mockService.createTask).not.toHaveBeenCalled();
    });

    it('returns task detail, result, and markdown through nested routes', async () => {
        const detailRoute = await import('../../app/api/workspaces/[workspaceSlug]/aigc-detection/tasks/[taskId]/route');
        const resultRoute = await import('../../app/api/workspaces/[workspaceSlug]/aigc-detection/tasks/[taskId]/result/route');
        const cleanedMarkdownRoute = await import('../../app/api/workspaces/[workspaceSlug]/aigc-detection/tasks/[taskId]/cleaned-markdown/route');
        const markedMarkdownRoute = await import('../../app/api/workspaces/[workspaceSlug]/aigc-detection/tasks/[taskId]/marked-markdown/route');
        mockService.getTaskDetail.mockResolvedValue({ id: 'task-1', status: 'processing' });
        mockService.getTaskResult.mockResolvedValue({ taskId: 'task-1', status: 'succeeded' });
        mockService.getTaskCleanedMarkdown.mockResolvedValue({
            taskId: 'task-1',
            status: 'succeeded',
            markdown: '# Clean',
        });
        mockService.getTaskMarkedMarkdown.mockResolvedValue({
            taskId: 'task-1',
            status: 'succeeded',
            markdown: '# [[AI_LIKELY]]Marked[[/AI_LIKELY]]',
            markerStart: '[[AI_LIKELY]]',
            markerEnd: '[[/AI_LIKELY]]',
            markedAiSentenceCount: 1,
            unmatchedAiSentenceCount: 0,
            spans: [],
        });

        const detailResponse = await detailRoute.GET(
            createRequest('/api/workspaces/ai-team/aigc-detection/tasks/task-1'),
            { params: Promise.resolve({ workspaceSlug: 'ai-team', taskId: 'task-1' }) }
        );
        const resultResponse = await resultRoute.GET(
            createRequest('/api/workspaces/ai-team/aigc-detection/tasks/task-1/result'),
            { params: Promise.resolve({ workspaceSlug: 'ai-team', taskId: 'task-1' }) }
        );
        const cleanedMarkdownResponse = await cleanedMarkdownRoute.GET(
            createRequest('/api/workspaces/ai-team/aigc-detection/tasks/task-1/cleaned-markdown'),
            { params: Promise.resolve({ workspaceSlug: 'ai-team', taskId: 'task-1' }) }
        );
        const markedMarkdownResponse = await markedMarkdownRoute.GET(
            createRequest('/api/workspaces/ai-team/aigc-detection/tasks/task-1/marked-markdown'),
            { params: Promise.resolve({ workspaceSlug: 'ai-team', taskId: 'task-1' }) }
        );

        expect(detailResponse.status).toBe(200);
        await expect(detailResponse.json()).resolves.toEqual({
            data: { task: { id: 'task-1', status: 'processing' } },
        });
        expect(resultResponse.status).toBe(200);
        await expect(resultResponse.json()).resolves.toEqual({
            data: { taskId: 'task-1', status: 'succeeded' },
        });
        expect(cleanedMarkdownResponse.status).toBe(200);
        await expect(cleanedMarkdownResponse.json()).resolves.toEqual({
            data: { taskId: 'task-1', status: 'succeeded', markdown: '# Clean' },
        });
        expect(markedMarkdownResponse.status).toBe(200);
        await expect(markedMarkdownResponse.json()).resolves.toEqual({
            data: {
                taskId: 'task-1',
                status: 'succeeded',
                markdown: '# [[AI_LIKELY]]Marked[[/AI_LIKELY]]',
                markerStart: '[[AI_LIKELY]]',
                markerEnd: '[[/AI_LIKELY]]',
                markedAiSentenceCount: 1,
                unmatchedAiSentenceCount: 0,
                spans: [],
            },
        });
    });

    it('retries a failed task', async () => {
        const { POST } = await import('../../app/api/workspaces/[workspaceSlug]/aigc-detection/tasks/[taskId]/retry/route');
        mockService.retryTask.mockResolvedValue({ id: 'task-1', status: 'submitted' });

        const response = await POST(
            createRequest('/api/workspaces/ai-team/aigc-detection/tasks/task-1/retry', 'POST'),
            { params: Promise.resolve({ workspaceSlug: 'ai-team', taskId: 'task-1' }) }
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            data: { task: { id: 'task-1', status: 'submitted' } },
        });
        expect(mockRequirePermission).toHaveBeenCalledWith(mockPrincipal, 'aigc_detection:write');
    });

    it('wraps service errors', async () => {
        const { GET } = await import('../../app/api/workspaces/[workspaceSlug]/aigc-detection/tasks/[taskId]/result/route');
        mockService.getTaskResult.mockRejectedValue(
            new ApiError(409, 'AIGC_DETECTION_TASK_NOT_COMPLETED', 'AIGC detection task is not completed yet')
        );

        const response = await GET(
            createRequest('/api/workspaces/ai-team/aigc-detection/tasks/task-1/result'),
            { params: Promise.resolve({ workspaceSlug: 'ai-team', taskId: 'task-1' }) }
        );
        const data = await response.json();

        expect(response.status).toBe(409);
        expect(data.error.code).toBe('AIGC_DETECTION_TASK_NOT_COMPLETED');
    });
});
