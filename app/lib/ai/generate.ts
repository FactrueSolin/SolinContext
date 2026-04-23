import type { GenerateRequest, GenerateResponse } from '../../types';
import {
    buildAnthropicApiUrl,
    buildAnthropicRequestBody,
    createAnthropicPassthroughStream,
    parseAnthropicResponse,
    readAnthropicErrorMessage,
    requestAnthropicMessage,
} from './providers/anthropic';

export interface ServerGenerateConfig {
    apiKey: string;
    baseUrl: string;
    model: string;
}

export async function requestGenerateUpstream(
    config: ServerGenerateConfig,
    request: GenerateRequest,
    options: { signal?: AbortSignal } = {}
): Promise<Response> {
    return requestAnthropicMessage({
        apiKey: config.apiKey,
        apiUrl: buildAnthropicApiUrl(config.baseUrl),
        requestBody: {
            ...buildAnthropicRequestBody(config.model, request),
            ...(request.stream ? { stream: true } : {}),
        },
        signal: options.signal,
    });
}

export async function readGenerateUpstreamError(response: Response): Promise<string> {
    return readAnthropicErrorMessage(response);
}

export async function parseGenerateResponse(response: Response): Promise<GenerateResponse> {
    return parseAnthropicResponse(response);
}

export function createGenerateStreamResponse(response: Response): Response {
    if (!response.body) {
        return new Response(null, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
            },
        });
    }

    return new Response(createAnthropicPassthroughStream(response.body), {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        },
    });
}
