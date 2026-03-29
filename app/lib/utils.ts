import { ApiConfig, EditorMessage, MessageRole, ProjectData } from '../types';

// 生成唯一ID
export function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 创建默认API配置
export function createDefaultApiConfig(): ApiConfig {
    return {
        baseUrl: 'https://api.anthropic.com',
        apiKey: '',
        model: 'claude-sonnet-4-20250514',
        maxTokens: undefined,
    };
}

// 创建空消息
export function createEmptyMessage(role: MessageRole): EditorMessage {
    return {
        id: generateId(),
        role,
        content: [{ type: 'text', text: '' }],
    };
}

// 创建新项目
export function exportToXmlPrompt(systemPrompt: string, messages: EditorMessage[]): string {
    let xml = '';
    
    if (systemPrompt && systemPrompt.trim().length > 0) {
        xml += `<system>\n  ${systemPrompt.trim().replace(/\n/g, '\n  ')}\n</system>\n`;
    }

    for (const msg of messages) {
        const role = msg.role;
        xml += `<${role}>\n`;

        for (const block of msg.content) {
            if (block.type === 'text') {
                const text = block.text.trim();
                if (text) {
                    xml += `  ${text.replace(/\n/g, '\n  ')}\n`;
                }
            } else if (block.type === 'thinking') {
                const thinking = block.thinking.trim();
                if (thinking) {
                    xml += `  <thinking>\n    ${thinking.replace(/\n/g, '\n    ')}\n  </thinking>\n`;
                }
            } else if (block.type === 'tool_use') {
                xml += `  <tool_use>\n    ${JSON.stringify({ id: block.id, name: block.name, input: block.input }, null, 2).replace(/\n/g, '\n    ')}\n  </tool_use>\n`;
            } else if (block.type === 'tool_result') {
                xml += `  <tool_result>\n    ${JSON.stringify({ tool_use_id: block.tool_use_id, content: block.content, is_error: block.is_error }, null, 2).replace(/\n/g, '\n    ')}\n  </tool_result>\n`;
            }
        }
        
        xml += `</${role}>\n`;
    }

    return xml.trimEnd();
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
