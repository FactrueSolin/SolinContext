// 内容块类型
export interface TextBlock {
    type: 'text';
    text: string;
}

export interface ThinkingBlock {
    type: 'thinking';
    thinking: string;
}

export interface ToolUseBlock {
    type: 'tool_use';
    id: string;
    name: string;
    input: Record<string, unknown>;
}

export interface ToolResultBlock {
    type: 'tool_result';
    tool_use_id: string;
    content: string | TextBlock[];
    is_error?: boolean;
}

export type ContentBlock = TextBlock | ThinkingBlock | ToolUseBlock | ToolResultBlock;

// 消息角色
export type MessageRole = 'user' | 'assistant';

// 编辑器消息（带唯一ID便于前端管理）
export interface EditorMessage {
    id: string;
    role: MessageRole;
    content: ContentBlock[];
    // 是否正在AI生成中
    isGenerating?: boolean;
}

// API 配置
export interface ApiConfig {
    baseUrl: string;
    apiKey: string;
    model: string;
    maxTokens?: number;
}

// 项目元数据
export interface ProjectMeta {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
}

// 完整项目数据
export interface ProjectData {
    meta: ProjectMeta;
    systemPrompt: string;
    messages: EditorMessage[];
    apiConfig: ApiConfig;
}

// API生成请求体
export interface GenerateRequest {
    baseUrl: string;
    apiKey: string;
    model: string;
    maxTokens?: number;
    systemPrompt: string;
    messages: Array<{
        role: MessageRole;
        content: ContentBlock[] | string;
    }>;
}

// API生成响应体
export interface GenerateResponse {
    content: ContentBlock[];
    stopReason: string;
    usage: {
        inputTokens: number;
        outputTokens: number;
    };
}

// 历史记录元数据
export interface HistoryEntry {
    filename: string;
    timestamp: string;
}
