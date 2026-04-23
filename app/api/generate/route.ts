import { NextResponse } from 'next/server';
import { GenerateRequest, GenerateResponse, ContentBlock } from '../../types';
import { getServerAiModelConfig } from '../../lib/ai/runtime';

// Anthropic API 响应的类型定义
interface AnthropicContentBlock {
    type: string;
    text?: string;
    thinking?: string;
    signature?: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
}

interface AnthropicResponse {
    content: AnthropicContentBlock[];
    stop_reason: string;
    usage: {
        input_tokens: number;
        output_tokens: number;
    };
}

// 根据模型名推测合适的 max_tokens 值
function inferMaxTokens(model: string): number {
    // Claude 4 系列和 claude-sonnet-4 系列
    if (model.includes('claude-4') || model.includes('claude-sonnet-4') || model.includes('claude-opus-4')) {
        return 16000;
    }
    // Claude 3.5 系列
    if (model.includes('claude-3-5') || model.includes('claude-3.5')) {
        return 8192;
    }
    // Claude 3 系列
    if (model.includes('claude-3')) {
        return 4096;
    }
    // 默认值
    return 4096;
}

/**
 * 构建发送给 Anthropic API 的请求体
 */
function buildAnthropicRequestBody(model: string, body: GenerateRequest): Record<string, unknown> {
    const {
        systemPrompt, messages, temperature, topP, topK,
        maxTokens, stopSequences, thinking, thinkingBudget
    } = body;

    const isThinkingEnabled = thinking === true;

    const requestBody: Record<string, unknown> = {
        model,
        max_tokens: maxTokens ?? inferMaxTokens(model),
        messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
        })),
    };

    if (systemPrompt) {
        requestBody.system = systemPrompt;
    }

    // 思考模式参数
    if (isThinkingEnabled) {
        requestBody.thinking = {
            type: 'enabled',
            budget_tokens: thinkingBudget || 10000,
        };
        // 思考模式下 temperature 必须为 1，不能设置 top_p 和 top_k
        // 不设置 temperature、top_p、top_k，让 API 使用默认值
    } else {
        // 非思考模式下传递可选的高级参数
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

/**
 * 处理非流式请求
 */
async function handleNonStreamRequest(
    apiUrl: string,
    apiKey: string,
    requestBody: Record<string, unknown>
) {
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json(
            { error: `API request failed: ${response.status} ${errorText}` },
            { status: response.status }
        );
    }

    const data = await response.json() as AnthropicResponse;

    // 转换响应为我们的格式
    const contentBlocks: ContentBlock[] = data.content.map((block: AnthropicContentBlock) => {
        if (block.type === 'text' && block.text !== undefined) {
            return { type: 'text' as const, text: block.text };
        }
        if (block.type === 'thinking' && block.thinking !== undefined) {
            return { type: 'thinking' as const, thinking: block.thinking, signature: block.signature || '' };
        }
        if (block.type === 'redacted_thinking') {
            return { type: 'redacted_thinking' as const, data: '' };
        }
        // 默认返回text类型
        return { type: 'text' as const, text: block.text || '' };
    });

    const result: GenerateResponse = {
        content: contentBlocks,
        stopReason: data.stop_reason,
        usage: {
            inputTokens: data.usage.input_tokens,
            outputTokens: data.usage.output_tokens,
        },
    };

    return NextResponse.json(result);
}

/**
 * 处理流式请求 - 将 Anthropic SSE 流转发给前端
 */
async function handleStreamRequest(
    apiUrl: string,
    apiKey: string,
    requestBody: Record<string, unknown>
) {
    const streamRequestBody = { ...requestBody, stream: true };

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(streamRequestBody),
    });

    if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json(
            { error: `API request failed: ${response.status} ${errorText}` },
            { status: response.status }
        );
    }

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
        async start(controller) {
            if (!response.body) {
                controller.close();
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });

                    // 按行分割，处理 SSE 事件
                    const lines = buffer.split('\n');
                    // 最后一行可能不完整，保留在 buffer 中
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (trimmedLine.startsWith('data: ')) {
                            const dataStr = trimmedLine.slice(6);
                            // 验证是否为有效 JSON
                            try {
                                JSON.parse(dataStr);
                                // 转发 SSE 事件给前端
                                controller.enqueue(encoder.encode(`data: ${dataStr}\n\n`));
                            } catch {
                                // 跳过无效 JSON
                            }
                        } else if (trimmedLine.startsWith('event: ')) {
                            // 转发事件类型行
                            controller.enqueue(encoder.encode(`${trimmedLine}\n`));
                        }
                    }
                }

                // 处理 buffer 中剩余的数据
                if (buffer.trim()) {
                    const trimmedLine = buffer.trim();
                    if (trimmedLine.startsWith('data: ')) {
                        const dataStr = trimmedLine.slice(6);
                        try {
                            JSON.parse(dataStr);
                            controller.enqueue(encoder.encode(`data: ${dataStr}\n\n`));
                        } catch {
                            // 跳过无效 JSON
                        }
                    } else if (trimmedLine.startsWith('event: ')) {
                        controller.enqueue(encoder.encode(`${trimmedLine}\n`));
                    }
                }
            } finally {
                reader.releaseLock();
                controller.close();
            }
        },
    });

    return new Response(readableStream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}

export async function POST(request: Request) {
    try {
        const body = await request.json() as GenerateRequest;
        const { stream, targetModel = 'primary' } = body;
        const modelConfig = getServerAiModelConfig(targetModel);

        // 构建 Anthropic API 请求 URL 和请求体
        const apiUrl = `${modelConfig.baseUrl}/v1/messages`;
        const requestBody = buildAnthropicRequestBody(modelConfig.model, body);

        // 根据是否流式选择处理方式
        if (stream) {
            return await handleStreamRequest(apiUrl, modelConfig.apiKey, requestBody);
        } else {
            return await handleNonStreamRequest(apiUrl, modelConfig.apiKey, requestBody);
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
