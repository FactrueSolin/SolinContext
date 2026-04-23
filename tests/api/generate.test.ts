import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';

function createGenerateRequest(body: unknown) {
    return new Request('http://localhost/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

function createSseStream(chunks: string[]) {
    const encoder = new TextEncoder();

    return new ReadableStream({
        start(controller) {
            for (const chunk of chunks) {
                controller.enqueue(encoder.encode(chunk));
            }
            controller.close();
        },
    });
}

describe('Generate API', () => {
    const originalFetch = global.fetch;
    const originalEnv = {
        AI_API_KEY: process.env.AI_API_KEY,
        AI_BASE_URL: process.env.AI_BASE_URL,
        AI_MODEL: process.env.AI_MODEL,
        AI_COMPARE_API_KEY: process.env.AI_COMPARE_API_KEY,
        AI_COMPARE_BASE_URL: process.env.AI_COMPARE_BASE_URL,
        AI_COMPARE_MODEL: process.env.AI_COMPARE_MODEL,
    };
    let mockFetch: Mock;

    beforeEach(() => {
        vi.resetModules();
        mockFetch = vi.fn();
        global.fetch = mockFetch;
        process.env.AI_API_KEY = 'sk-ant-test-key';
        process.env.AI_BASE_URL = 'https://api.anthropic.com';
        process.env.AI_MODEL = 'claude-sonnet-4-20250514';
        delete process.env.AI_COMPARE_API_KEY;
        delete process.env.AI_COMPARE_BASE_URL;
        delete process.env.AI_COMPARE_MODEL;
    });

    afterEach(() => {
        global.fetch = originalFetch;
        process.env.AI_API_KEY = originalEnv.AI_API_KEY;
        process.env.AI_BASE_URL = originalEnv.AI_BASE_URL;
        process.env.AI_MODEL = originalEnv.AI_MODEL;
        process.env.AI_COMPARE_API_KEY = originalEnv.AI_COMPARE_API_KEY;
        process.env.AI_COMPARE_BASE_URL = originalEnv.AI_COMPARE_BASE_URL;
        process.env.AI_COMPARE_MODEL = originalEnv.AI_COMPARE_MODEL;
    });

    it('POST /api/generate returns 500 when server AI env is missing', async () => {
        const { POST } = await import('../../app/api/generate/route');
        delete process.env.AI_API_KEY;

        const response = await POST(
            createGenerateRequest({
                messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
            }),
        );

        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toEqual({ error: 'Missing required env: AI_API_KEY' });
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('POST /api/generate forwards a standard non-stream request to Anthropic', async () => {
        const { POST } = await import('../../app/api/generate/route');

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                content: [
                    { type: 'text', text: 'Hello there!' },
                    { type: 'thinking', thinking: 'internal reasoning', signature: 'sig-1' },
                    { type: 'redacted_thinking' },
                ],
                stop_reason: 'end_turn',
                usage: { input_tokens: 10, output_tokens: 5 },
            }),
        });

        const response = await POST(
            createGenerateRequest({
                systemPrompt: 'Be precise',
                temperature: 0.2,
                topP: 0.9,
                topK: 12,
                stopSequences: ['</answer>'],
                messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
            }),
        );
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch.mock.calls[0][0]).toBe('https://api.anthropic.com/v1/messages');

        const fetchOptions = mockFetch.mock.calls[0][1];
        expect(fetchOptions.method).toBe('POST');
        expect(fetchOptions.headers['x-api-key']).toBe('sk-ant-test-key');
        expect(fetchOptions.headers['anthropic-version']).toBe('2023-06-01');
        expect(fetchOptions.headers['Content-Type']).toBe('application/json');

        const fetchBody = JSON.parse(fetchOptions.body);
        expect(fetchBody).toEqual({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 16000,
            system: 'Be precise',
            temperature: 0.2,
            top_p: 0.9,
            top_k: 12,
            stop_sequences: ['</answer>'],
            messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
        });

        expect(data).toEqual({
            content: [
                { type: 'text', text: 'Hello there!' },
                { type: 'thinking', thinking: 'internal reasoning', signature: 'sig-1' },
                { type: 'redacted_thinking', data: '' },
            ],
            stopReason: 'end_turn',
            usage: { inputTokens: 10, outputTokens: 5 },
        });
    });

    it('POST /api/generate builds thinking-mode requests without sampling params', async () => {
        const { POST } = await import('../../app/api/generate/route');

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                content: [{ type: 'text', text: 'done' }],
                stop_reason: 'end_turn',
                usage: { input_tokens: 1, output_tokens: 1 },
            }),
        });

        const response = await POST(
            createGenerateRequest({
                thinking: true,
                thinkingBudget: 2048,
                temperature: 0.7,
                topP: 0.8,
                topK: 10,
                messages: [{ role: 'user', content: [{ type: 'text', text: 'think' }] }],
            }),
        );

        expect(response.status).toBe(200);

        const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(fetchBody.max_tokens).toBe(16000);
        expect(fetchBody.thinking).toEqual({ type: 'enabled', budget_tokens: 2048 });
        expect(fetchBody.temperature).toBeUndefined();
        expect(fetchBody.top_p).toBeUndefined();
        expect(fetchBody.top_k).toBeUndefined();
    });

    it('POST /api/generate returns upstream API errors with original status', async () => {
        const { POST } = await import('../../app/api/generate/route');

        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 401,
            text: async () => JSON.stringify({
                error: {
                    type: 'invalid_request_error',
                    message: 'Invalid API key',
                },
            }),
        });

        const response = await POST(
            createGenerateRequest({
                messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
            }),
        );

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.error).toContain('Invalid API key');
    });

    it('POST /api/generate returns 500 when fetch throws', async () => {
        const { POST } = await import('../../app/api/generate/route');

        mockFetch.mockRejectedValueOnce(new Error('Network unreachable'));

        const response = await POST(
            createGenerateRequest({
                messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
            }),
        );

        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toEqual({ error: 'Network unreachable' });
    });

    it('POST /api/generate streams SSE events and drops invalid injected lines', async () => {
        const { POST } = await import('../../app/api/generate/route');

        mockFetch.mockResolvedValueOnce({
            ok: true,
            body: createSseStream([
                'event: content_block_start\n',
                'data: {"type":"content_block_start","index":0}\n',
                'data: not-json\n',
                '\n',
                'event: message_stop\n',
                'data: {"type":"message_stop"}\n\n',
            ]),
        });

        const response = await POST(
            createGenerateRequest({
                stream: true,
                messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
            }),
        );

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('text/event-stream');

        const text = await response.text();
        expect(text).toContain('event: content_block_start');
        expect(text).toContain('data: {"type":"content_block_start","index":0}');
        expect(text).toContain('event: message_stop');
        expect(text).toContain('data: {"type":"message_stop"}');
        expect(text).not.toContain('data: not-json');
    });

    it('POST /api/generate returns 500 when request JSON is malformed', async () => {
        const { POST } = await import('../../app/api/generate/route');
        const malformedRequest = new Request('http://localhost/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{"apiKey":',
        });

        const response = await POST(malformedRequest);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toContain('JSON');
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('POST /api/generate uses compare model env when targetModel=compare', async () => {
        const { POST } = await import('../../app/api/generate/route');
        process.env.AI_COMPARE_API_KEY = 'sk-ant-compare-key';
        process.env.AI_COMPARE_BASE_URL = 'https://compare.anthropic.com/';
        process.env.AI_COMPARE_MODEL = 'claude-3-5-sonnet-20241022';

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                content: [{ type: 'text', text: 'compare' }],
                stop_reason: 'end_turn',
                usage: { input_tokens: 1, output_tokens: 1 },
            }),
        });

        const response = await POST(
            createGenerateRequest({
                targetModel: 'compare',
                messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
            }),
        );

        expect(response.status).toBe(200);
        expect(mockFetch.mock.calls[0][0]).toBe('https://compare.anthropic.com/v1/messages');
        expect(mockFetch.mock.calls[0][1].headers['x-api-key']).toBe('sk-ant-compare-key');

        const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(fetchBody.model).toBe('claude-3-5-sonnet-20241022');
        expect(fetchBody.max_tokens).toBe(8192);
    });
});
