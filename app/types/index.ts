// ==================== Content Block Types ====================

// --- 基础块（已有，微调） ---

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ThinkingBlock {
  type: 'thinking';
  thinking: string;
  signature: string;
}

export interface RedactedThinkingBlock {
  type: 'redacted_thinking';
  data: string;
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
  content: string;
  is_error?: boolean;
}

// --- 图片块 (仅 user) ---

export interface Base64ImageSource {
  type: 'base64';
  media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  data: string;
}

export interface URLImageSource {
  type: 'url';
  url: string;
}

export type ImageSource = Base64ImageSource | URLImageSource;

export interface ImageBlock {
  type: 'image';
  source: ImageSource;
}

// --- 文档块 (仅 user) ---

export interface Base64PDFSource {
  type: 'base64';
  media_type: 'application/pdf';
  data: string;
}

export interface PlainTextSource {
  type: 'text';
  media_type: 'text/plain';
  data: string;
}

export interface URLPDFSource {
  type: 'url';
  url: string;
}

export type DocumentSource = Base64PDFSource | PlainTextSource | URLPDFSource;

export interface DocumentBlock {
  type: 'document';
  source: DocumentSource;
  title?: string;
  context?: string;
}

// --- 搜索结果块 (仅 user) ---

export interface SearchResultBlock {
  type: 'search_result';
  source: string;
  title: string;
  content: string;
}

// --- 服务端工具调用块 (仅 assistant) ---

export type ServerToolName = 'web_search' | 'web_fetch' | 'code_execution';

export interface ServerToolUseBlock {
  type: 'server_tool_use';
  id: string;
  name: ServerToolName;
  input: Record<string, unknown>;
}

// --- 网页搜索结果块 (仅 assistant) ---

export interface WebSearchResultItem {
  url: string;
  title: string;
  snippet: string;
}

export interface WebSearchToolResultBlock {
  type: 'web_search_tool_result';
  tool_use_id: string;
  content: WebSearchResultItem[];
}

// --- 网页抓取结果块 (仅 assistant) ---

export interface WebFetchToolResultBlock {
  type: 'web_fetch_tool_result';
  tool_use_id: string;
  url: string;
  content: string;
}

// --- 代码执行结果块 (仅 assistant) ---

export interface CodeExecutionToolResultBlock {
  type: 'code_execution_tool_result';
  tool_use_id: string;
  stdout: string;
  stderr: string;
  return_code: number;
}

// --- 容器上传块 (仅 assistant) ---

export interface ContainerUploadBlock {
  type: 'container_upload';
  file_id: string;
}

// ==================== Content Block Union Types ====================

// User 消息可用的内容块
export type UserContentBlock =
  | TextBlock
  | ImageBlock
  | DocumentBlock
  | SearchResultBlock
  | ToolResultBlock;

// Assistant 消息可用的内容块
export type AssistantContentBlock =
  | TextBlock
  | ThinkingBlock
  | RedactedThinkingBlock
  | ToolUseBlock
  | ServerToolUseBlock
  | WebSearchToolResultBlock
  | WebFetchToolResultBlock
  | CodeExecutionToolResultBlock
  | ContainerUploadBlock;

// 所有内容块的联合类型
export type ContentBlock = UserContentBlock | AssistantContentBlock;

// 所有内容块 type 值的联合类型
export type ContentBlockType = ContentBlock['type'];

// ==================== Message & Project Types ====================

export type MessageRole = 'user' | 'assistant';

export interface EditorMessage {
  id: string;
  role: MessageRole;
  content: ContentBlock[];
  // 是否正在AI生成中
  isGenerating?: boolean;
}

export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;      // 0-1, 控制随机性
  topP?: number;             // 0-1, 核采样
  topK?: number;             // 正整数, Top-K 采样
  maxTokens?: number;        // 正整数, 最大输出 token 数
  stopSequences?: string[];  // 停止序列
  stream?: boolean;          // 流式输出
  thinking?: boolean;        // 思考模式（extended thinking）
  thinkingBudget?: number;   // 思考 token 预算，默认 10000
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
  systemPrompt: string;
  messages: Array<{
    role: MessageRole;
    content: ContentBlock[];
  }>;
  temperature?: number;
  topP?: number;
  topK?: number;
  maxTokens?: number;
  stopSequences?: string[];
  stream?: boolean;
  thinking?: boolean;
  thinkingBudget?: number;
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
