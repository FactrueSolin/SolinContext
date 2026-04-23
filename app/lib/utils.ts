import {
    ApiConfig,
    EditorMessage,
    MessageRole,
    ProjectData,
    ContentBlock,
    ImageBlock,
    DocumentBlock,
    SearchResultBlock,
    RedactedThinkingBlock,
    ServerToolUseBlock,
    WebSearchToolResultBlock,
    WebFetchToolResultBlock,
    CodeExecutionToolResultBlock,
    ContainerUploadBlock,
} from '../types';
import { sanitizeApiConfig } from './ai/api-config';

// 生成唯一ID
export function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 创建默认API配置
export function createDefaultApiConfig(): ApiConfig {
    return sanitizeApiConfig(undefined);
}

// 创建空消息
export function createEmptyMessage(role: MessageRole): EditorMessage {
    return {
        id: generateId(),
        role,
        content: [{ type: 'text', text: '' }],
    };
}

// ==================== 空内容块创建函数 ====================

export function createEmptyImageBlock(): ImageBlock {
    return { type: 'image', source: { type: 'url', url: '' } };
}

export function createEmptyDocumentBlock(): DocumentBlock {
    return { type: 'document', source: { type: 'text', media_type: 'text/plain', data: '' } };
}

export function createEmptySearchResultBlock(): SearchResultBlock {
    return { type: 'search_result', source: '', title: '', content: '' };
}

export function createEmptyRedactedThinkingBlock(): RedactedThinkingBlock {
    return { type: 'redacted_thinking', data: '' };
}

export function createEmptyServerToolUseBlock(): ServerToolUseBlock {
    return { type: 'server_tool_use', id: generateId(), name: 'web_search', input: {} };
}

export function createEmptyWebSearchToolResultBlock(): WebSearchToolResultBlock {
    return { type: 'web_search_tool_result', tool_use_id: '', content: [] };
}

export function createEmptyWebFetchToolResultBlock(): WebFetchToolResultBlock {
    return { type: 'web_fetch_tool_result', tool_use_id: '', url: '', content: '' };
}

export function createEmptyCodeExecutionToolResultBlock(): CodeExecutionToolResultBlock {
    return { type: 'code_execution_tool_result', tool_use_id: '', stdout: '', stderr: '', return_code: 0 };
}

export function createEmptyContainerUploadBlock(): ContainerUploadBlock {
    return { type: 'container_upload', file_id: '' };
}

// ==================== 导出为 XML Prompt ====================

function formatBlockForXml(block: ContentBlock): string {
    switch (block.type) {
        case 'text': {
            const text = block.text.trim();
            return text ? `  ${text.replace(/\n/g, '\n  ')}\n` : '';
        }
        case 'thinking': {
            const thinking = block.thinking.trim();
            return thinking
                ? `  <thinking>\n    ${thinking.replace(/\n/g, '\n    ')}\n  </thinking>\n`
                : '';
        }
        case 'redacted_thinking': {
            const data = block.data.trim();
            return data
                ? `  <redacted_thinking>\n    ${data.replace(/\n/g, '\n    ')}\n  </redacted_thinking>\n`
                : '';
        }
        case 'tool_use': {
            return `  <tool_use>\n    ${JSON.stringify({ id: block.id, name: block.name, input: block.input }, null, 2).replace(/\n/g, '\n    ')}\n  </tool_use>\n`;
        }
        case 'tool_result': {
            return `  <tool_result>\n    ${JSON.stringify({ tool_use_id: block.tool_use_id, content: block.content, is_error: block.is_error }, null, 2).replace(/\n/g, '\n    ')}\n  </tool_result>\n`;
        }
        case 'image': {
            return `  <image>\n    ${JSON.stringify({ source: block.source }, null, 2).replace(/\n/g, '\n    ')}\n  </image>\n`;
        }
        case 'document': {
            return `  <document>\n    ${JSON.stringify({ source: block.source, title: block.title, context: block.context }, null, 2).replace(/\n/g, '\n    ')}\n  </document>\n`;
        }
        case 'search_result': {
            return `  <search_result>\n    ${JSON.stringify({ source: block.source, title: block.title, content: block.content }, null, 2).replace(/\n/g, '\n    ')}\n  </search_result>\n`;
        }
        case 'server_tool_use': {
            return `  <server_tool_use>\n    ${JSON.stringify({ id: block.id, name: block.name, input: block.input }, null, 2).replace(/\n/g, '\n    ')}\n  </server_tool_use>\n`;
        }
        case 'web_search_tool_result': {
            return `  <web_search_tool_result>\n    ${JSON.stringify({ tool_use_id: block.tool_use_id, content: block.content }, null, 2).replace(/\n/g, '\n    ')}\n  </web_search_tool_result>\n`;
        }
        case 'web_fetch_tool_result': {
            return `  <web_fetch_tool_result>\n    ${JSON.stringify({ tool_use_id: block.tool_use_id, url: block.url, content: block.content }, null, 2).replace(/\n/g, '\n    ')}\n  </web_fetch_tool_result>\n`;
        }
        case 'code_execution_tool_result': {
            return `  <code_execution_tool_result>\n    ${JSON.stringify({ tool_use_id: block.tool_use_id, stdout: block.stdout, stderr: block.stderr, return_code: block.return_code }, null, 2).replace(/\n/g, '\n    ')}\n  </code_execution_tool_result>\n`;
        }
        case 'container_upload': {
            return `  <container_upload>\n    ${JSON.stringify({ file_id: block.file_id }, null, 2).replace(/\n/g, '\n    ')}\n  </container_upload>\n`;
        }
        default: {
            // 确保所有类型都被处理
            const _exhaustive: never = block;
            return '';
        }
    }
}

export function exportToXmlPrompt(systemPrompt: string, messages: EditorMessage[]): string {
    let xml = '';

    if (systemPrompt && systemPrompt.trim().length > 0) {
        xml += `<system>\n  ${systemPrompt.trim().replace(/\n/g, '\n  ')}\n</system>\n`;
    }

    for (const msg of messages) {
        const role = msg.role;
        xml += `<${role}>\n`;

        for (const block of msg.content) {
            xml += formatBlockForXml(block);
        }

        xml += `</${role}>\n`;
    }

    return `<answer_format>\n${xml.trimEnd()}\n</answer_format>`;
}

// ==================== 导出为 Messages API JSON ====================

function formatBlockForJson(block: ContentBlock): Record<string, unknown> {
    switch (block.type) {
        case 'text':
            return { type: 'text', text: block.text };
        case 'thinking':
            return { type: 'thinking', thinking: block.thinking, signature: block.signature };
        case 'redacted_thinking':
            return { type: 'redacted_thinking', data: block.data };
        case 'tool_use':
            return { type: 'tool_use', id: block.id, name: block.name, input: block.input };
        case 'tool_result':
            return { type: 'tool_result', tool_use_id: block.tool_use_id, content: block.content, is_error: block.is_error };
        case 'image':
            return { type: 'image', source: block.source };
        case 'document': {
            const result: Record<string, unknown> = { type: 'document', source: block.source };
            if (block.title !== undefined) result.title = block.title;
            if (block.context !== undefined) result.context = block.context;
            return result;
        }
        case 'search_result':
            return { type: 'search_result', source: block.source, title: block.title, content: block.content };
        case 'server_tool_use':
            return { type: 'server_tool_use', id: block.id, name: block.name, input: block.input };
        case 'web_search_tool_result':
            return { type: 'web_search_tool_result', tool_use_id: block.tool_use_id, content: block.content };
        case 'web_fetch_tool_result':
            return { type: 'web_fetch_tool_result', tool_use_id: block.tool_use_id, url: block.url, content: block.content };
        case 'code_execution_tool_result':
            return { type: 'code_execution_tool_result', tool_use_id: block.tool_use_id, stdout: block.stdout, stderr: block.stderr, return_code: block.return_code };
        case 'container_upload':
            return { type: 'container_upload', file_id: block.file_id };
        default: {
            // 确保所有类型都被处理
            const _exhaustive: never = block;
            return {};
        }
    }
}

export function exportToMessageJson(systemPrompt: string, messages: EditorMessage[]): string {
    const output: {
        system: string;
        messages: Array<{
            role: string;
            content: Array<Record<string, unknown>>;
        }>;
    } = {
        system: systemPrompt,
        messages: messages.map((msg) => ({
            role: msg.role,
            content: msg.content.map(formatBlockForJson),
        })),
    };

    return JSON.stringify(output, null, 2);
}

// 创建新项目
export function createNewProject(name: string): ProjectData {
    const now = new Date().toISOString();
    return {
        meta: {
            id: generateId(),
            name,
            createdAt: now,
            updatedAt: now,
        },
        systemPrompt: 'You are a helpful assistant.',
        messages: [
            {
                id: generateId(),
                role: 'user' as MessageRole,
                content: [{ type: 'text' as const, text: 'Hello, how can you help me?' }],
            },
            {
                id: generateId(),
                role: 'assistant' as MessageRole,
                content: [{ type: 'text' as const, text: 'Hello! I\'m a helpful assistant. I can help you with various tasks. How can I assist you today?' }],
            },
        ],
        apiConfig: createDefaultApiConfig(),
    };
}
