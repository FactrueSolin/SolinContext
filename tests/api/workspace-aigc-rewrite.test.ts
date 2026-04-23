import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { resetAigcRewriteServiceStateForTests } from '../../app/lib/aigc-rewrite/service';

const mockPrincipal = {
    userId: 'user-1',
    logtoUserId: 'logto-user-1',
    email: 'user@example.com',
    name: 'User',
    avatarUrl: null,
    activeWorkspaceId: 'workspace-1',
    activeWorkspaceSlug: 'ai-team',
    activeWorkspaceName: 'AI Team',
    activeWorkspaceType: 'organization',
    activeWorkspaceStatus: 'active',
    workspaceRole: 'owner',
    permissions: ['credential:use'],
} as const;

const mockResolvePrincipal = vi.fn();
const mockRequirePermission = vi.fn();

vi.mock('../../app/lib/auth/principal', () => ({
    resolvePrincipal: mockResolvePrincipal,
    requirePermission: mockRequirePermission,
}));

function createRequest(body: unknown, headers: HeadersInit = {}) {
    return new Request('http://localhost/api/workspaces/ai-team/aigc-rewrite/generate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            'x-request-id': 'req-test-1',
            ...headers,
        },
        body: JSON.stringify(body),
    });
}

function createSseStream(chunks: string[]) {
    const encoder = new TextEncoder();

    return new ReadableStream<Uint8Array>({
        start(controller) {
            for (const chunk of chunks) {
                controller.enqueue(encoder.encode(chunk));
            }
            controller.close();
        },
    });
}

describe('Workspace AIGC Rewrite API', () => {
    const originalFetch = global.fetch;
    const originalEnv = {
        AIGC_REWRITE_ENABLED: process.env.AIGC_REWRITE_ENABLED,
        AIGC_REWRITE_PROVIDER: process.env.AIGC_REWRITE_PROVIDER,
        AIGC_REWRITE_BASE_URL: process.env.AIGC_REWRITE_BASE_URL,
        AIGC_REWRITE_API_KEY: process.env.AIGC_REWRITE_API_KEY,
        AIGC_REWRITE_MODEL: process.env.AIGC_REWRITE_MODEL,
        AIGC_REWRITE_THINKING_BUDGET: process.env.AIGC_REWRITE_THINKING_BUDGET,
        AIGC_REWRITE_REQUEST_TIMEOUT_MS: process.env.AIGC_REWRITE_REQUEST_TIMEOUT_MS,
        AIGC_REWRITE_RATE_LIMIT_WINDOW_MS: process.env.AIGC_REWRITE_RATE_LIMIT_WINDOW_MS,
        AIGC_REWRITE_RATE_LIMIT_MAX_REQUESTS: process.env.AIGC_REWRITE_RATE_LIMIT_MAX_REQUESTS,
        AIGC_REWRITE_MAX_CONCURRENT_REQUESTS: process.env.AIGC_REWRITE_MAX_CONCURRENT_REQUESTS,
        AI_BASE_URL: process.env.AI_BASE_URL,
        AI_API_KEY: process.env.AI_API_KEY,
        AI_MODEL: process.env.AI_MODEL,
    };
    let mockFetch: Mock;

    beforeEach(() => {
        vi.clearAllMocks();
        mockResolvePrincipal.mockResolvedValue(mockPrincipal);
        mockRequirePermission.mockImplementation(() => undefined);
        mockFetch = vi.fn();
        global.fetch = mockFetch;
        process.env.AIGC_REWRITE_ENABLED = 'true';
        process.env.AIGC_REWRITE_PROVIDER = 'anthropic';
        process.env.AIGC_REWRITE_BASE_URL = 'https://rewrite.anthropic.test/';
        process.env.AIGC_REWRITE_API_KEY = 'sk-rewrite-key';
        process.env.AIGC_REWRITE_MODEL = 'claude-sonnet-4-20250514';
        process.env.AIGC_REWRITE_THINKING_BUDGET = '4096';
        process.env.AIGC_REWRITE_REQUEST_TIMEOUT_MS = '5000';
        process.env.AIGC_REWRITE_RATE_LIMIT_WINDOW_MS = '60000';
        process.env.AIGC_REWRITE_RATE_LIMIT_MAX_REQUESTS = '5';
        process.env.AIGC_REWRITE_MAX_CONCURRENT_REQUESTS = '1';
        delete process.env.AI_BASE_URL;
        delete process.env.AI_API_KEY;
        delete process.env.AI_MODEL;
        resetAigcRewriteServiceStateForTests();
    });

    afterEach(() => {
        global.fetch = originalFetch;
        process.env.AIGC_REWRITE_ENABLED = originalEnv.AIGC_REWRITE_ENABLED;
        process.env.AIGC_REWRITE_PROVIDER = originalEnv.AIGC_REWRITE_PROVIDER;
        process.env.AIGC_REWRITE_BASE_URL = originalEnv.AIGC_REWRITE_BASE_URL;
        process.env.AIGC_REWRITE_API_KEY = originalEnv.AIGC_REWRITE_API_KEY;
        process.env.AIGC_REWRITE_MODEL = originalEnv.AIGC_REWRITE_MODEL;
        process.env.AIGC_REWRITE_THINKING_BUDGET = originalEnv.AIGC_REWRITE_THINKING_BUDGET;
        process.env.AIGC_REWRITE_REQUEST_TIMEOUT_MS = originalEnv.AIGC_REWRITE_REQUEST_TIMEOUT_MS;
        process.env.AIGC_REWRITE_RATE_LIMIT_WINDOW_MS = originalEnv.AIGC_REWRITE_RATE_LIMIT_WINDOW_MS;
        process.env.AIGC_REWRITE_RATE_LIMIT_MAX_REQUESTS = originalEnv.AIGC_REWRITE_RATE_LIMIT_MAX_REQUESTS;
        process.env.AIGC_REWRITE_MAX_CONCURRENT_REQUESTS = originalEnv.AIGC_REWRITE_MAX_CONCURRENT_REQUESTS;
        process.env.AI_BASE_URL = originalEnv.AI_BASE_URL;
        process.env.AI_API_KEY = originalEnv.AI_API_KEY;
        process.env.AI_MODEL = originalEnv.AI_MODEL;
        resetAigcRewriteServiceStateForTests();
    });

    it('POST /api/workspaces/[workspaceSlug]/aigc-rewrite/generate streams normalized SSE events', async () => {
        const { POST } = await import('../../app/api/workspaces/[workspaceSlug]/aigc-rewrite/generate/route');

        mockFetch.mockResolvedValueOnce({
            ok: true,
            body: createSseStream([
                'event: message_start\n',
                'data: {"type":"message_start","message":{"usage":{"input_tokens":12,"output_tokens":0}}}\n\n',
                'event: content_block_delta\n',
                'data: {"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"先分析样本。"}}\n\n',
                'event: content_block_delta\n',
                'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"这是改写后的正文。"}}\n\n',
                'event: message_delta\n',
                'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"input_tokens":12,"output_tokens":34}}\n\n',
                'event: message_stop\n',
                'data: {"type":"message_stop"}\n\n',
            ]),
        });

        const response = await POST(
            createRequest({
                sampleBefore: '  原始样本  ',
                sampleAfter: '  改写样本  ',
                targetText: '  需要改写的正文  ',
            }),
            { params: Promise.resolve({ workspaceSlug: 'ai-team' }) }
        );

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('text/event-stream');
        expect(response.headers.get('x-request-id')).toBe('req-test-1');
        expect(mockResolvePrincipal).toHaveBeenCalledWith(expect.any(Request), { workspaceSlug: 'ai-team' });
        expect(mockRequirePermission).toHaveBeenCalledWith(mockPrincipal, 'credential:use');

        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch.mock.calls[0][0]).toBe('https://rewrite.anthropic.test/v1/messages');
        const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(fetchBody).toEqual({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 16000,
            system: expect.stringContaining('<example>'),
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: '<user>\n需要改写的正文\n</user>',
                        },
                    ],
                },
            ],
            stream: true,
            thinking: {
                type: 'enabled',
                budget_tokens: 4096,
            },
        });

        const text = await response.text();
        expect(text).toContain('event: meta');
        expect(text).toContain('"requestId":"req-test-1"');
        expect(text).toContain('"workspaceSlug":"ai-team"');
        expect(text).toContain('"channel":"thinking","text":"先分析样本。"');
        expect(text).toContain('"channel":"output","text":"这是改写后的正文。"');
        expect(text).toContain('event: done');
        expect(text).toContain('"stopReason":"end_turn"');
        expect(text).toContain('"inputTokens":12');
        expect(text).toContain('"outputTokens":34');
    });

    it('POST /api/workspaces/[workspaceSlug]/aigc-rewrite/generate rejects invalid request bodies', async () => {
        const { POST } = await import('../../app/api/workspaces/[workspaceSlug]/aigc-rewrite/generate/route');

        const response = await POST(
            createRequest({
                sampleBefore: 'same',
                sampleAfter: 'same',
                targetText: 'content',
            }),
            { params: Promise.resolve({ workspaceSlug: 'ai-team' }) }
        );
        const data = await response.json();

        expect(response.status).toBe(422);
        expect(data.error.code).toBe('AIGC_REWRITE_VALIDATION_FAILED');
        expect(data.error.details.sampleAfter).toBeDefined();
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('POST /api/workspaces/[workspaceSlug]/aigc-rewrite/generate returns 500 when feature is disabled', async () => {
        const { POST } = await import('../../app/api/workspaces/[workspaceSlug]/aigc-rewrite/generate/route');
        process.env.AIGC_REWRITE_ENABLED = 'false';

        const response = await POST(
            createRequest({
                sampleBefore: 'before',
                sampleAfter: 'after',
                targetText: 'content',
            }),
            { params: Promise.resolve({ workspaceSlug: 'ai-team' }) }
        );
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error.code).toBe('AIGC_REWRITE_DISABLED');
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('POST /api/workspaces/[workspaceSlug]/aigc-rewrite/generate falls back to shared AI env when rewrite env is absent', async () => {
        const { POST } = await import('../../app/api/workspaces/[workspaceSlug]/aigc-rewrite/generate/route');
        delete process.env.AIGC_REWRITE_BASE_URL;
        delete process.env.AIGC_REWRITE_API_KEY;
        delete process.env.AIGC_REWRITE_MODEL;
        process.env.AI_BASE_URL = 'https://primary.anthropic.test';
        process.env.AI_API_KEY = 'sk-primary-key';
        process.env.AI_MODEL = 'claude-3-5-sonnet-20241022';

        mockFetch.mockResolvedValueOnce({
            ok: true,
            body: createSseStream([
                'event: message_stop\n',
                'data: {"type":"message_stop"}\n\n',
            ]),
        });

        const response = await POST(
            createRequest({
                sampleBefore: 'before',
                sampleAfter: 'after',
                targetText: 'content',
            }),
            { params: Promise.resolve({ workspaceSlug: 'ai-team' }) }
        );

        expect(response.status).toBe(200);
        expect(mockFetch.mock.calls[0][0]).toBe('https://primary.anthropic.test/v1/messages');
        const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(fetchBody.model).toBe('claude-3-5-sonnet-20241022');
    });

    it('POST /api/workspaces/[workspaceSlug]/aigc-rewrite/generate converts upstream failures to a stable error envelope', async () => {
        const { POST } = await import('../../app/api/workspaces/[workspaceSlug]/aigc-rewrite/generate/route');

        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 503,
            text: async () => '{"error":{"message":"overloaded"}}',
        });

        const response = await POST(
            createRequest({
                sampleBefore: 'before',
                sampleAfter: 'after',
                targetText: 'content',
            }),
            { params: Promise.resolve({ workspaceSlug: 'ai-team' }) }
        );
        const data = await response.json();

        expect(response.status).toBe(502);
        expect(data.error.code).toBe('AIGC_REWRITE_UPSTREAM_ERROR');
        expect(data.error.message).toBe('Model request failed');
    });
});
