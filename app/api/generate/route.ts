import { NextResponse } from 'next/server';
import { GenerateRequest, GenerateResponse, ContentBlock } from '../../types';

// Anthropic API 响应的类型定义
interface AnthropicContentBlock {
    type: string;
    text?: string;
    thinking?: string;
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

export async function POST(request: Request) {
    try {
        const body = await request.json() as GenerateRequest;

        const { baseUrl, apiKey, model, systemPrompt, messages } = body;

        if (!apiKey) {
            return NextResponse.json({ error: 'API key is required' }, { status: 400 });
        }

        // 构建Anthropic API请求
        const apiUrl = `${baseUrl.replace(/\/+$/, '')}/v1/messages`;

        const requestBody: Record<string, unknown> = {
            model,
            max_tokens: inferMaxTokens(model),
            messages: messages.map(msg => ({
                role: msg.role,
                content: msg.content,
            })),
        };

        if (systemPrompt) {
            requestBody.system = systemPrompt;
        }

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
                return { type: 'thinking' as const, thinking: block.thinking, signature: '' };
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
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
