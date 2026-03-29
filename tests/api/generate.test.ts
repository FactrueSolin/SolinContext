import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { NextRequest } from 'next/server';

// Need to mock fetch before importing the route
const originalFetch = global.fetch;

describe('Generate API', () => {
    let mockFetch: Mock;

    beforeEach(() => {
        vi.resetModules();
        mockFetch = vi.fn();
        global.fetch = mockFetch;
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('should return 400 when missing apiKey', async () => {
        const { POST } = await import('../../app/api/generate/route');

        const requestObj = {
            json: async () => ({
                baseUrl: 'https://api.anthropic.com/v1',
                model: 'claude-3-5-sonnet-20241022',
                messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }]
            })
        };

        const request = requestObj as unknown as NextRequest;

        const response = await POST(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe('API key is required');
    });

    it('should forward request to anthropic API successfully', async () => {
        const { POST } = await import('../../app/api/generate/route');

        // Mock the successful response from Anthropic
        const mockAnthropicResponse = {
            id: 'msg_123',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'Hello there!' }],
            model: 'claude-3-5-sonnet-20241022',
            stop_reason: 'end_turn',
            stop_sequence: null,
            usage: { input_tokens: 10, output_tokens: 5 }
        };

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockAnthropicResponse
        });

        const requestObj = {
            json: async () => ({
                baseUrl: 'https://api.anthropic.com/v1',
                apiKey: 'sk-ant-test-key',
                model: 'claude-3-5-sonnet-20241022',
                messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }]
            })
        };

        const request = requestObj as unknown as NextRequest;
        const response = await POST(request);

        expect(response.status).toBe(200);

        // Check that fetch was called correctly
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch.mock.calls[0][0]).toBe('https://api.anthropic.com/v1/v1/messages');

        const fetchOptions = mockFetch.mock.calls[0][1];
        expect(fetchOptions.method).toBe('POST');
        expect(fetchOptions.headers['x-api-key']).toBe('sk-ant-test-key');
        expect(fetchOptions.headers['anthropic-version']).toBe('2023-06-01');
        expect(fetchOptions.headers['content-type'] || fetchOptions.headers['Content-Type']).toBe('application/json');

        const fetchBody = JSON.parse(fetchOptions.body);
        expect(fetchBody.model).toBe('claude-3-5-sonnet-20241022');
        expect(fetchBody.messages).toEqual([{ role: 'user', content: [{ type: 'text', text: 'hello' }] }]);

        // Check the response
        const data = await response.json();
        expect(data.content).toEqual([{ type: 'text', text: 'Hello there!' }]);
    });

    it('should handle anthropic API errors correctly', async () => {
        const { POST } = await import('../../app/api/generate/route');

        const errorResponse = {
            error: {
                type: 'invalid_request_error',
                message: 'Invalid API key'
            }
        };

        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 401,
            text: async () => JSON.stringify(errorResponse)
        });

        const requestObj = {
            json: async () => ({
                baseUrl: 'https://api.anthropic.com/v1',
                apiKey: 'invalid-key',
                model: 'claude-3-5-sonnet-20241022',
                messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }]
            })
        };

        const request = requestObj as unknown as NextRequest;
        const response = await POST(request);

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.error).toContain('Invalid API key');
    });
});
