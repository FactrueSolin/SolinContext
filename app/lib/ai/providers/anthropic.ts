import type { ContentBlock, GenerateRequest, GenerateResponse } from '../../../types';
import { encodeSseFrame, iterateSseFrames } from '../stream-events';

interface AnthropicContentBlock {
    type: string;
    text?: string;
    thinking?: string;
    signature?: string;
}

interface AnthropicResponse {
    content: AnthropicContentBlock[];
    stop_reason: string;
    usage: {
        input_tokens: number;
        output_tokens: number;
    };
}

interface AnthropicUsage {
    input_tokens?: number;
    output_tokens?: number;
}

interface AnthropicMessageStartEvent {
    type: 'message_start';
    message?: {
        usage?: AnthropicUsage;
    };
}

interface AnthropicMessageDeltaEvent {
    type: 'message_delta';
    delta?: {
        stop_reason?: string | null;
    };
    usage?: AnthropicUsage;
}

interface AnthropicMessageStopEvent {
    type: 'message_stop';
}

interface AnthropicContentBlockDeltaEvent {
    type: 'content_block_delta';
    delta?: {
        type?: string;
        text?: string;
        thinking?: string;
        signature?: string;
    };
}

interface AnthropicErrorEvent {
    type: 'error';
    error?: {
        type?: string;
        message?: string;
    };
}

interface AnthropicContentBlockStartEvent {
    type: 'content_block_start';
    content_block?: {
        type?: string;
    };
}

interface AnthropicContentBlockStopEvent {
    type: 'content_block_stop';
}

interface AnthropicPingEvent {
    type: 'ping';
}

export type AnthropicStreamEvent =
    | AnthropicMessageStartEvent
    | AnthropicMessageDeltaEvent
    | AnthropicMessageStopEvent
    | AnthropicContentBlockDeltaEvent
    | AnthropicErrorEvent
    | AnthropicContentBlockStartEvent
    | AnthropicContentBlockStopEvent
    | AnthropicPingEvent;

function asObject(value: unknown): Record<string, unknown> {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }

    return value as Record<string, unknown>;
}

function inferMaxTokens(model: string): number {
    if (model.includes('claude-4') || model.includes('claude-sonnet-4') || model.includes('claude-opus-4')) {
        return 16000;
    }

    if (model.includes('claude-3-5') || model.includes('claude-3.5')) {
        return 8192;
    }

    if (model.includes('claude-3')) {
        return 4096;
    }

    return 4096;
}

function toContentBlocks(content: AnthropicContentBlock[]): ContentBlock[] {
    return content.map((block) => {
        if (block.type === 'text' && block.text !== undefined) {
            return { type: 'text' as const, text: block.text };
        }

        if (block.type === 'thinking' && block.thinking !== undefined) {
            return {
                type: 'thinking' as const,
                thinking: block.thinking,
                signature: block.signature ?? '',
            };
        }

        if (block.type === 'redacted_thinking') {
            return { type: 'redacted_thinking' as const, data: '' };
        }

        return { type: 'text' as const, text: block.text ?? '' };
    });
}

export function buildAnthropicApiUrl(baseUrl: string): string {
    return `${baseUrl.replace(/\/+$/, '')}/v1/messages`;
}

export function buildAnthropicRequestBody(
    model: string,
    body: GenerateRequest
): Record<string, unknown> {
    const {
        systemPrompt,
        messages,
        temperature,
        topP,
        topK,
        maxTokens,
        stopSequences,
        thinking,
        thinkingBudget,
    } = body;

    const requestBody: Record<string, unknown> = {
        model,
        max_tokens: maxTokens ?? inferMaxTokens(model),
        messages: messages.map((message) => ({
            role: message.role,
            content: message.content,
        })),
    };

    if (systemPrompt) {
        requestBody.system = systemPrompt;
    }

    if (thinking === true) {
        requestBody.thinking = {
            type: 'enabled',
            budget_tokens: thinkingBudget || 10000,
        };
    } else {
        if (temperature !== undefined) {
            requestBody.temperature = temperature;
        }

        if (topP !== undefined) {
            requestBody.top_p = topP;
        }

        if (topK !== undefined) {
            requestBody.top_k = topK;
        }
    }

    if (stopSequences && stopSequences.length > 0) {
        requestBody.stop_sequences = stopSequences;
    }

    return requestBody;
}

export async function requestAnthropicMessage(options: {
    apiKey: string;
    apiUrl: string;
    requestBody: Record<string, unknown>;
    signal?: AbortSignal;
}): Promise<Response> {
    return fetch(options.apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': options.apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(options.requestBody),
        signal: options.signal,
    });
}

export async function readAnthropicErrorMessage(response: Response): Promise<string> {
    return response.text();
}

export async function parseAnthropicResponse(response: Response): Promise<GenerateResponse> {
    const data = await response.json() as AnthropicResponse;

    return {
        content: toContentBlocks(data.content),
        stopReason: data.stop_reason,
        usage: {
            inputTokens: data.usage.input_tokens,
            outputTokens: data.usage.output_tokens,
        },
    };
}

function isJson(value: string): boolean {
    try {
        JSON.parse(value);
        return true;
    } catch {
        return false;
    }
}

export function createAnthropicPassthroughStream(
    stream: ReadableStream<Uint8Array>
): ReadableStream<Uint8Array> {
    return new ReadableStream({
        async start(controller) {
            try {
                for await (const frame of iterateSseFrames(stream)) {
                    if (!frame.data) {
                        continue;
                    }

                    for (const dataLine of frame.data.split('\n')) {
                        if (!isJson(dataLine)) {
                            continue;
                        }

                        controller.enqueue(
                            encodeSseFrame({
                                event: frame.event,
                                data: dataLine,
                            })
                        );
                    }
                }
            } finally {
                controller.close();
            }
        },
    });
}

export function parseAnthropicStreamEventData(data: string): AnthropicStreamEvent | null {
    let parsed: unknown;

    try {
        parsed = JSON.parse(data);
    } catch {
        return null;
    }

    const source = asObject(parsed);
    const type = source.type;

    if (typeof type !== 'string') {
        return null;
    }

    switch (type) {
        case 'message_start':
        case 'message_delta':
        case 'message_stop':
        case 'content_block_delta':
        case 'content_block_start':
        case 'content_block_stop':
        case 'ping':
        case 'error':
            return source as unknown as AnthropicStreamEvent;
        default:
            return null;
    }
}
