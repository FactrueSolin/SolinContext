'use client';

import React, {
    createContext,
    useContext,
    useReducer,
    useCallback,
    useMemo,
    useRef,
    ReactNode,
} from 'react';
import type {
    ProjectMeta,
    ProjectData,
    ApiConfig,
    MessageRole,
    ContentBlock,
    EditorMessage,
    GenerateRequest,
    GenerateResponse,
    PromptAssetDrawerEntry,
    PromptAssetNotice
} from '../types';
import { createDefaultApiConfig, createEmptyMessage, generateId } from '../lib/utils';
import { sanitizeApiConfig } from '../lib/ai/api-config';
import { getWorkspaceSlugFromWindow } from '../lib/workspace-routing';

interface ApiEnvelope<T> {
    data: T;
}

interface WorkspaceProjectListResponse {
    items: ProjectMeta[];
}

interface WorkspaceProjectDetail {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    systemPrompt: string;
    defaultCredentialId: string | null;
    currentRevisionId: string | null;
    messages: EditorMessage[];
    apiConfig: ApiConfig;
}

function isApiEnvelope<T>(payload: unknown): payload is ApiEnvelope<T> {
    return (
        payload !== null &&
        typeof payload === 'object' &&
        'data' in payload &&
        Object.keys(payload).length === 1
    );
}

function extractApiData<T>(payload: ApiEnvelope<T> | T): T;
function extractApiData<T>(payload: unknown): T {
    if (isApiEnvelope<T>(payload)) {
        return payload.data;
    }

    return payload as T;
}

function mapWorkspaceProjectDetail(detail: WorkspaceProjectDetail): ProjectData {
    return {
        meta: {
            id: detail.id,
            name: detail.name,
            createdAt: detail.createdAt,
            updatedAt: detail.updatedAt,
        },
        systemPrompt: detail.systemPrompt,
        messages: detail.messages,
        apiConfig: detail.apiConfig,
        currentRevisionId: detail.currentRevisionId,
        defaultCredentialId: detail.defaultCredentialId,
    };
}

function mergeApiConfigWithRuntimeMetadata(
    currentConfig: ApiConfig,
    nextConfig: Partial<ApiConfig>
): ApiConfig {
    const sanitized = sanitizeApiConfig({ ...currentConfig, ...nextConfig });

    return {
        ...sanitized,
        primaryModelLabel: currentConfig.primaryModelLabel,
        compareModelLabel: currentConfig.compareModelLabel,
        hasCompareModel: currentConfig.hasCompareModel,
    };
}

function getProjectCollectionEndpoint(workspaceSlug?: string | null): string {
    return workspaceSlug
        ? `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects`
        : '/api/projects';
}

function getProjectDetailEndpoint(id: string, workspaceSlug?: string | null): string {
    return workspaceSlug
        ? `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(id)}`
        : `/api/projects/${id}`;
}

export interface EditorState {
    projects: ProjectMeta[];
    currentProject: ProjectData | null;
    isLoading: boolean;
    isSaving: boolean;
    isGenerating: boolean;
    error: string | null;
    showApiConfig: boolean;
    showProjectList: boolean;
    showPromptAssets: boolean;
    promptAssetEntry: PromptAssetDrawerEntry;
    promptAssetNotice: PromptAssetNotice | null;
}

export interface EditorActions {
    dispatch: React.Dispatch<EditorAction>;
    loadProjects: () => Promise<void>;
    loadProject: (id: string) => Promise<void>;
    saveProject: () => Promise<void>;
    createProject: (name: string) => Promise<ProjectData>;
    deleteProject: (id: string) => Promise<void>;
    generateForMessage: (messageId: string) => Promise<void>;
    generateABCompare: (messageId: string) => Promise<void>;
    stopGeneration: (messageId: string) => void;
    resolveABCompare: (keepMessageId: string, abGroupId: string) => void;
    renameProject: (name: string) => Promise<void>;
    toggleApiConfig: () => void;
    toggleProjectList: () => void;
    openPromptAssets: (entry?: PromptAssetDrawerEntry) => void;
    togglePromptAssets: (entry?: PromptAssetDrawerEntry) => void;
    closePromptAssets: () => void;
    updateSystemPrompt: (systemPrompt: string) => void;
    updateApiConfig: (apiConfig: Partial<ApiConfig>) => void;
    addMessage: (role: MessageRole) => void;
    deleteMessage: (messageId: string) => void;
    updateMessageRole: (messageId: string, role: MessageRole) => void;
    addContentBlock: (messageId: string, blockType: ContentBlock['type']) => void;
    deleteContentBlock: (messageId: string, blockIndex: number) => void;
    updateContentBlock: (messageId: string, blockIndex: number, block: ContentBlock) => void;
    moveMessage: (messageId: string, direction: 'up' | 'down') => void;
    setAssistantContent: (messageId: string, content: ContentBlock[]) => void;
    updateProjectName: (name: string) => void;
    setError: (error: string | null) => void;
    setPromptAssetNotice: (notice: PromptAssetNotice | null) => void;
}

export type EditorAction =
    | { type: 'SET_PROJECTS'; projects: ProjectMeta[] }
    | { type: 'SET_CURRENT_PROJECT'; project: ProjectData | null }
    | { type: 'SET_LOADING'; isLoading: boolean }
    | { type: 'SET_SAVING'; isSaving: boolean }
    | { type: 'SET_GENERATING'; isGenerating: boolean }
    | { type: 'SET_ERROR'; error: string | null }
    | { type: 'TOGGLE_API_CONFIG' }
    | { type: 'TOGGLE_PROJECT_LIST' }
    | { type: 'OPEN_PROMPT_ASSETS'; entry: PromptAssetDrawerEntry }
    | { type: 'TOGGLE_PROMPT_ASSETS'; entry: PromptAssetDrawerEntry }
    | { type: 'CLOSE_PROMPT_ASSETS' }
    | { type: 'SET_PROMPT_ASSET_NOTICE'; notice: PromptAssetNotice | null }
    | { type: 'UPDATE_SYSTEM_PROMPT'; systemPrompt: string }
    | { type: 'UPDATE_API_CONFIG'; apiConfig: Partial<ApiConfig> }
    | { type: 'ADD_MESSAGE'; role: MessageRole }
    | { type: 'DELETE_MESSAGE'; messageId: string }
    | { type: 'UPDATE_MESSAGE_ROLE'; messageId: string; role: MessageRole }
    | { type: 'ADD_CONTENT_BLOCK'; messageId: string; blockType: ContentBlock['type'] }
    | { type: 'DELETE_CONTENT_BLOCK'; messageId: string; blockIndex: number }
    | { type: 'UPDATE_CONTENT_BLOCK'; messageId: string; blockIndex: number; block: ContentBlock }
    | { type: 'MOVE_MESSAGE'; messageId: string; direction: 'up' | 'down' }
    | { type: 'SET_ASSISTANT_CONTENT'; messageId: string; content: ContentBlock[] }
    | { type: 'UPDATE_PROJECT_NAME'; name: string }
    | { type: 'APPEND_TO_CONTENT_BLOCK'; messageId: string; blockIndex: number; text: string }
    | { type: 'SET_MESSAGE_CONTENT'; messageId: string; content: ContentBlock[] }
    | { type: 'SET_MESSAGE_GENERATING'; messageId: string; isGenerating: boolean }
    | { type: 'ADD_MESSAGES'; messages: EditorMessage[] }
    | { type: 'RESOLVE_AB_COMPARE'; keepMessageId: string; abGroupId: string };

export const initialState: EditorState = {
    projects: [],
    currentProject: null,
    isLoading: false,
    isSaving: false,
    isGenerating: false,
    error: null,
    showApiConfig: false,
    showProjectList: true,
    showPromptAssets: false,
    promptAssetEntry: 'browse',
    promptAssetNotice: null,
};

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
    switch (action.type) {
        case 'SET_PROJECTS':
            return { ...state, projects: action.projects };
        case 'SET_CURRENT_PROJECT':
            return { ...state, currentProject: action.project };
        case 'SET_LOADING':
            return { ...state, isLoading: action.isLoading };
        case 'SET_SAVING':
            return { ...state, isSaving: action.isSaving };
        case 'SET_GENERATING':
            return { ...state, isGenerating: action.isGenerating };
        case 'SET_ERROR':
            return { ...state, error: action.error };
        case 'TOGGLE_API_CONFIG':
            return {
                ...state,
                showApiConfig: !state.showApiConfig,
                showPromptAssets: !state.showApiConfig ? false : state.showPromptAssets,
            };
        case 'TOGGLE_PROJECT_LIST':
            return { ...state, showProjectList: !state.showProjectList };
        case 'OPEN_PROMPT_ASSETS':
            return {
                ...state,
                showPromptAssets: true,
                promptAssetEntry: action.entry,
                showApiConfig: false,
            };
        case 'TOGGLE_PROMPT_ASSETS': {
            const nextShowPromptAssets = !state.showPromptAssets;
            return {
                ...state,
                showPromptAssets: nextShowPromptAssets,
                promptAssetEntry: action.entry,
                showApiConfig: nextShowPromptAssets ? false : state.showApiConfig,
            };
        }
        case 'CLOSE_PROMPT_ASSETS':
            return {
                ...state,
                showPromptAssets: false,
                promptAssetEntry: 'browse',
            };
        case 'SET_PROMPT_ASSET_NOTICE':
            return {
                ...state,
                promptAssetNotice: action.notice,
            };
        case 'UPDATE_SYSTEM_PROMPT':
            if (!state.currentProject) return state;
            return {
                ...state,
                currentProject: {
                    ...state.currentProject,
                    systemPrompt: action.systemPrompt,
                },
            };
        case 'UPDATE_API_CONFIG':
            if (!state.currentProject) return state;
            const newApiConfig = mergeApiConfigWithRuntimeMetadata(
                state.currentProject.apiConfig,
                action.apiConfig
            );
            try {
                localStorage.setItem(
                    'aicontext_api_config',
                    JSON.stringify(sanitizeApiConfig(newApiConfig))
                );
            } catch (e) {
                console.error('Failed to save API config to localStorage', e);
            }
            return {
                ...state,
                currentProject: {
                    ...state.currentProject,
                    apiConfig: newApiConfig,
                },
            };
        case 'ADD_MESSAGE':
            if (!state.currentProject) return state;
            return {
                ...state,
                currentProject: {
                    ...state.currentProject,
                    messages: [...state.currentProject.messages, createEmptyMessage(action.role)],
                },
            };
        case 'DELETE_MESSAGE':
            if (!state.currentProject) return state;
            return {
                ...state,
                currentProject: {
                    ...state.currentProject,
                    messages: state.currentProject.messages.filter((m) => m.id !== action.messageId),
                },
            };
        case 'UPDATE_MESSAGE_ROLE':
            if (!state.currentProject) return state;
            return {
                ...state,
                currentProject: {
                    ...state.currentProject,
                    messages: state.currentProject.messages.map((m) =>
                        m.id === action.messageId ? { ...m, role: action.role } : m
                    ),
                },
            };
        case 'ADD_CONTENT_BLOCK':
            if (!state.currentProject) return state;
            return {
                ...state,
                currentProject: {
                    ...state.currentProject,
                    messages: state.currentProject.messages.map((m) => {
                        if (m.id !== action.messageId) return m;
                        let newBlock: ContentBlock;
                        switch (action.blockType) {
                            case 'text':
                                newBlock = { type: 'text', text: '' };
                                break;
                            case 'thinking':
                                newBlock = { type: 'thinking', thinking: '', signature: '' };
                                break;
                            case 'redacted_thinking':
                                newBlock = { type: 'redacted_thinking', data: '' };
                                break;
                            case 'tool_use':
                                newBlock = { type: 'tool_use', id: generateId(), name: '', input: {} };
                                break;
                            case 'tool_result':
                                newBlock = { type: 'tool_result', tool_use_id: '', content: '' };
                                break;
                            case 'image':
                                newBlock = { type: 'image', source: { type: 'url', url: '' } };
                                break;
                            case 'document':
                                newBlock = { type: 'document', source: { type: 'text', media_type: 'text/plain', data: '' } };
                                break;
                            case 'search_result':
                                newBlock = { type: 'search_result', source: '', title: '', content: '' };
                                break;
                            case 'server_tool_use':
                                newBlock = { type: 'server_tool_use', id: generateId(), name: 'web_search', input: {} };
                                break;
                            case 'web_search_tool_result':
                                newBlock = { type: 'web_search_tool_result', tool_use_id: '', content: [] };
                                break;
                            case 'web_fetch_tool_result':
                                newBlock = { type: 'web_fetch_tool_result', tool_use_id: '', url: '', content: '' };
                                break;
                            case 'code_execution_tool_result':
                                newBlock = { type: 'code_execution_tool_result', tool_use_id: '', stdout: '', stderr: '', return_code: 0 };
                                break;
                            case 'container_upload':
                                newBlock = { type: 'container_upload', file_id: '' };
                                break;
                            default:
                                newBlock = { type: 'text', text: '' };
                        }
                        return { ...m, content: [...m.content, newBlock] };
                    }),
                },
            };
        case 'DELETE_CONTENT_BLOCK':
            if (!state.currentProject) return state;
            return {
                ...state,
                currentProject: {
                    ...state.currentProject,
                    messages: state.currentProject.messages.map((m) => {
                        if (m.id !== action.messageId) return m;
                        const newContent = [...m.content];
                        newContent.splice(action.blockIndex, 1);
                        return { ...m, content: newContent };
                    }),
                },
            };
        case 'UPDATE_CONTENT_BLOCK':
            if (!state.currentProject) return state;
            return {
                ...state,
                currentProject: {
                    ...state.currentProject,
                    messages: state.currentProject.messages.map((m) => {
                        if (m.id !== action.messageId) return m;
                        const newContent = [...m.content];
                        newContent[action.blockIndex] = action.block;
                        return { ...m, content: newContent };
                    }),
                },
            };
        case 'MOVE_MESSAGE':
            if (!state.currentProject) return state;
            const messages = [...state.currentProject.messages];
            const index = messages.findIndex((m) => m.id === action.messageId);
            if (index === -1) return state;

            if (action.direction === 'up' && index > 0) {
                const temp = messages[index];
                messages[index] = messages[index - 1];
                messages[index - 1] = temp;
            } else if (action.direction === 'down' && index < messages.length - 1) {
                const temp = messages[index];
                messages[index] = messages[index + 1];
                messages[index + 1] = temp;
            }

            return {
                ...state,
                currentProject: { ...state.currentProject, messages },
            };
        case 'SET_ASSISTANT_CONTENT':
            if (!state.currentProject) return state;
            return {
                ...state,
                currentProject: {
                    ...state.currentProject,
                    messages: state.currentProject.messages.map((m) =>
                        m.id === action.messageId
                            ? { ...m, content: action.content, isGenerating: false }
                            : m
                    ),
                },
            };
        case 'UPDATE_PROJECT_NAME':
            if (!state.currentProject) return state;
            return {
                ...state,
                projects: state.projects.map((project) =>
                    project.id === state.currentProject?.meta.id
                        ? { ...project, name: action.name }
                        : project
                ),
                currentProject: {
                    ...state.currentProject,
                    meta: {
                        ...state.currentProject.meta,
                        name: action.name,
                    },
                },
            };
        case 'APPEND_TO_CONTENT_BLOCK':
            if (!state.currentProject) return state;
            return {
                ...state,
                currentProject: {
                    ...state.currentProject,
                    messages: state.currentProject.messages.map((m) => {
                        if (m.id !== action.messageId) return m;
                        const newContent = [...m.content];
                        if (action.blockIndex < newContent.length) {
                            const block = newContent[action.blockIndex];
                            if (block.type === 'text') {
                                newContent[action.blockIndex] = {
                                    ...block,
                                    text: block.text + action.text,
                                };
                            } else if (block.type === 'thinking') {
                                newContent[action.blockIndex] = {
                                    ...block,
                                    thinking: block.thinking + action.text,
                                };
                            }
                        }
                        return { ...m, content: newContent };
                    }),
                },
            };
        case 'SET_MESSAGE_CONTENT':
            if (!state.currentProject) return state;
            return {
                ...state,
                currentProject: {
                    ...state.currentProject,
                    messages: state.currentProject.messages.map((m) =>
                        m.id === action.messageId
                            ? { ...m, content: action.content }
                            : m
                    ),
                },
            };
        case 'SET_MESSAGE_GENERATING':
            if (!state.currentProject) return state;
            return {
                ...state,
                currentProject: {
                    ...state.currentProject,
                    messages: state.currentProject.messages.map((m) =>
                        m.id === action.messageId
                            ? { ...m, isGenerating: action.isGenerating }
                            : m
                    ),
                },
            };
        case 'ADD_MESSAGES':
            if (!state.currentProject) return state;
            return {
                ...state,
                currentProject: {
                    ...state.currentProject,
                    messages: [...state.currentProject.messages, ...action.messages],
                },
            };
        case 'RESOLVE_AB_COMPARE': {
            if (!state.currentProject) return state;
            // 删除同组中不是 keepMessageId 的消息，并清除保留消息的 abGroupId 和 abLabel
            const filteredMessages = state.currentProject.messages.filter(
                (m) => {
                    // 保留不在同组的消息
                    if (m.abGroupId !== action.abGroupId) return true;
                    // 保留被选中的消息
                    if (m.id === action.keepMessageId) return true;
                    // 删除同组的其他消息
                    return false;
                }
            ).map((m) => {
                // 清除保留消息的 abGroupId 和 abLabel
                if (m.id === action.keepMessageId) {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { abGroupId, abLabel, ...rest } = m;
                    return rest;
                }
                return m;
            });
            return {
                ...state,
                currentProject: {
                    ...state.currentProject,
                    messages: filteredMessages,
                },
            };
        }
        default:
            return state;
    }
}

const EditorStateContext = createContext<EditorState | undefined>(undefined);
const EditorActionsContext = createContext<EditorActions | undefined>(undefined);

// Anthropic SSE 事件的类型定义
interface SSEEvent {
    type: string;
    index?: number;
    content_block?: {
        type: string;
        text?: string;
        thinking?: string;
        id?: string;
        name?: string;
    };
    delta?: {
        type: string;
        text?: string;
        thinking?: string;
        stop_reason?: string;
    };
    message?: {
        stop_reason: string;
        usage: { input_tokens: number; output_tokens: number };
    };
}

/**
 * 消费流式 SSE 响应，实时更新消息内容
 */
async function consumeStreamResponse(
    res: Response,
    messageId: string,
    dispatch: React.Dispatch<EditorAction>,
    signal?: AbortSignal
): Promise<void> {
    if (!res.body) {
        throw new Error('Response body is null');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentBlockIndex = -1;

    try {
        while (true) {
            // 检查是否已中断
            if (signal?.aborted) {
                break;
            }
            const { done, value } = await reader.read();
            if (done) break;
            if (signal?.aborted) {
                break;
            }

            buffer += decoder.decode(value, { stream: true });

            // 按双换行分割 SSE 事件
            const events = buffer.split('\n\n');
            buffer = events.pop() || '';

            for (const eventStr of events) {
                const lines = eventStr.split('\n');
                let eventData: string | null = null;

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine.startsWith('data: ')) {
                        eventData = trimmedLine.slice(6);
                    }
                }

                if (!eventData) continue;

                let event: SSEEvent;
                try {
                    event = JSON.parse(eventData) as SSEEvent;
                } catch {
                    continue;
                }

                switch (event.type) {
                    case 'content_block_start': {
                        if (event.content_block && event.index !== undefined) {
                            currentBlockIndex = event.index;
                            const blockType = event.content_block.type;

                            if (blockType === 'text') {
                                dispatch({
                                    type: 'ADD_CONTENT_BLOCK',
                                    messageId,
                                    blockType: 'text',
                                });
                            } else if (blockType === 'thinking') {
                                dispatch({
                                    type: 'ADD_CONTENT_BLOCK',
                                    messageId,
                                    blockType: 'thinking',
                                });
                            }
                        }
                        break;
                    }
                    case 'content_block_delta': {
                        if (event.delta && event.index !== undefined) {
                            currentBlockIndex = event.index;
                            if (event.delta.type === 'text_delta' && event.delta.text) {
                                dispatch({
                                    type: 'APPEND_TO_CONTENT_BLOCK',
                                    messageId,
                                    blockIndex: currentBlockIndex,
                                    text: event.delta.text,
                                });
                            } else if (event.delta.type === 'thinking_delta' && event.delta.thinking) {
                                dispatch({
                                    type: 'APPEND_TO_CONTENT_BLOCK',
                                    messageId,
                                    blockIndex: currentBlockIndex,
                                    text: event.delta.thinking,
                                });
                            }
                        }
                        break;
                    }
                    case 'content_block_stop': {
                        // 内容块结束，无需特殊处理
                        break;
                    }
                    case 'message_stop': {
                        // 消息结束
                        break;
                    }
                    default:
                        // 忽略其他事件类型（message_start, message_delta 等）
                        break;
                }
            }
        }
    } finally {
        reader.releaseLock();
        // 标记生成完成
        dispatch({
            type: 'SET_MESSAGE_GENERATING',
            messageId,
            isGenerating: false,
        });
    }
}

export function EditorProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(editorReducer, initialState);
    const workspaceSlug = getWorkspaceSlugFromWindow();
    // 存储 AbortController 引用，key 为 messageId
    const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

    const loadProjects = useCallback(async () => {
        dispatch({ type: 'SET_LOADING', isLoading: true });
        try {
            const res = await fetch(getProjectCollectionEndpoint(workspaceSlug));
            if (!res.ok) throw new Error('Failed to load projects');
            const payload = await res.json() as ApiEnvelope<WorkspaceProjectListResponse> | ProjectMeta[];
            const data = extractApiData<WorkspaceProjectListResponse | ProjectMeta[]>(payload);
            const projects = Array.isArray(data) ? data : data.items;
            dispatch({ type: 'SET_PROJECTS', projects });
            dispatch({ type: 'SET_ERROR', error: null });
        } catch (err) {
            dispatch({ type: 'SET_ERROR', error: err instanceof Error ? err.message : String(err) });
        } finally {
            dispatch({ type: 'SET_LOADING', isLoading: false });
        }
    }, [workspaceSlug]);

    const loadProject = useCallback(async (id: string) => {
        dispatch({ type: 'SET_LOADING', isLoading: true });
        try {
            const res = await fetch(getProjectDetailEndpoint(id, workspaceSlug));
            if (!res.ok) throw new Error('Failed to load project');
            const payload = await res.json() as ApiEnvelope<WorkspaceProjectDetail> | ProjectData;
            const data = extractApiData<WorkspaceProjectDetail | ProjectData>(payload);
            dispatch({
                type: 'SET_CURRENT_PROJECT',
                project: workspaceSlug ? mapWorkspaceProjectDetail(data as WorkspaceProjectDetail) : (data as ProjectData),
            });
            dispatch({ type: 'SET_ERROR', error: null });
        } catch (err) {
            dispatch({ type: 'SET_ERROR', error: err instanceof Error ? err.message : String(err) });
        } finally {
            dispatch({ type: 'SET_LOADING', isLoading: false });
        }
    }, [workspaceSlug]);

    const saveProject = useCallback(async () => {
        if (!state.currentProject) return;
        dispatch({ type: 'SET_SAVING', isSaving: true });
        try {
            const request = workspaceSlug
                ? {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                          name: state.currentProject.meta.name,
                          systemPrompt: state.currentProject.systemPrompt,
                          messages: state.currentProject.messages,
                          apiConfig: state.currentProject.apiConfig,
                          defaultCredentialId: state.currentProject.defaultCredentialId ?? null,
                          expectedRevisionId: state.currentProject.currentRevisionId ?? null,
                      }),
                  }
                : {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(state.currentProject),
                  };
            const res = await fetch(getProjectDetailEndpoint(state.currentProject.meta.id, workspaceSlug), request);
            if (!res.ok) throw new Error('Failed to save project');
            if (workspaceSlug) {
                const payload = await res.json() as ApiEnvelope<WorkspaceProjectDetail>;
                dispatch({
                    type: 'SET_CURRENT_PROJECT',
                    project: mapWorkspaceProjectDetail(extractApiData(payload)),
                });
            }
            dispatch({ type: 'SET_ERROR', error: null });
            await loadProjects();
        } catch (err) {
            dispatch({ type: 'SET_ERROR', error: err instanceof Error ? err.message : String(err) });
        } finally {
            dispatch({ type: 'SET_SAVING', isSaving: false });
        }
    }, [loadProjects, state.currentProject, workspaceSlug]);

    const createProject = useCallback(async (name: string) => {
        dispatch({ type: 'SET_LOADING', isLoading: true });
        try {
            let defaultApiConfig = createDefaultApiConfig();
            try {
                const storedConfig = localStorage.getItem('aicontext_api_config');
                if (storedConfig) {
                    defaultApiConfig = sanitizeApiConfig(JSON.parse(storedConfig));
                }
            } catch (e) {
                console.error('Failed to load API config from localStorage', e);
            }

            const res = await fetch(getProjectCollectionEndpoint(workspaceSlug), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    systemPrompt: 'You are a helpful assistant.',
                    messages: [],
                    apiConfig: defaultApiConfig,
                }),
            });
            if (!res.ok) throw new Error('Failed to create project');
            const payload = await res.json() as ApiEnvelope<WorkspaceProjectDetail> | ProjectData;
            const responseData = extractApiData<WorkspaceProjectDetail | ProjectData>(payload);
            const project = workspaceSlug
                ? mapWorkspaceProjectDetail(responseData as WorkspaceProjectDetail)
                : (responseData as ProjectData);
            dispatch({ type: 'SET_CURRENT_PROJECT', project });
            dispatch({ type: 'SET_ERROR', error: null });
            await loadProjects();
            return project;
        } catch (err) {
            dispatch({ type: 'SET_ERROR', error: err instanceof Error ? err.message : String(err) });
            throw err;
        } finally {
            dispatch({ type: 'SET_LOADING', isLoading: false });
        }
    }, [loadProjects, workspaceSlug]);

    const deleteProject = useCallback(async (id: string) => {
        dispatch({ type: 'SET_LOADING', isLoading: true });
        try {
            const res = await fetch(getProjectDetailEndpoint(id, workspaceSlug), { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete project');
            if (state.currentProject?.meta.id === id) {
                dispatch({ type: 'SET_CURRENT_PROJECT', project: null });
            }
            dispatch({ type: 'SET_ERROR', error: null });
            await loadProjects();
        } catch (err) {
            dispatch({ type: 'SET_ERROR', error: err instanceof Error ? err.message : String(err) });
        } finally {
            dispatch({ type: 'SET_LOADING', isLoading: false });
        }
    }, [loadProjects, state.currentProject, workspaceSlug]);

    const generateForMessage = useCallback(async (messageId: string) => {
        if (!state.currentProject) return;

        dispatch({ type: 'SET_GENERATING', isGenerating: true });

        const messageIndex = state.currentProject.messages.findIndex((m) => m.id === messageId);
        if (messageIndex === -1) {
            dispatch({ type: 'SET_GENERATING', isGenerating: false });
            return;
        }

        const updatedProject = {
            ...state.currentProject,
            messages: state.currentProject.messages.map((m) =>
                m.id === messageId ? { ...m, isGenerating: true, content: [] } : m
            ),
        };

        dispatch({ type: 'SET_CURRENT_PROJECT', project: updatedProject });
        dispatch({ type: 'SET_ERROR', error: null });

        // 创建 AbortController
        const controller = new AbortController();
        abortControllersRef.current.set(messageId, controller);

        try {
            const previousMessages = state.currentProject.messages.slice(0, messageIndex);

            const apiConfig = state.currentProject.apiConfig;
            const request: GenerateRequest = {
                systemPrompt: state.currentProject.systemPrompt,
                messages: previousMessages.map((m) => ({
                    role: m.role,
                    content: m.content,
                })),
                temperature: apiConfig.temperature,
                topP: apiConfig.topP,
                topK: apiConfig.topK,
                maxTokens: apiConfig.maxTokens,
                stopSequences: apiConfig.stopSequences,
                stream: apiConfig.stream,
                thinking: apiConfig.thinking,
                thinkingBudget: apiConfig.thinkingBudget,
            };

            const res = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request),
                signal: controller.signal,
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(errorData.error || 'Failed to generate message');
            }

            if (apiConfig.stream) {
                await consumeStreamResponse(res, messageId, dispatch, controller.signal);
            } else {
                const data: GenerateResponse = await res.json();
                dispatch({
                    type: 'SET_ASSISTANT_CONTENT',
                    messageId,
                    content: data.content,
                });
            }
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                // 用户主动中断，不视为错误
            } else {
                dispatch({ type: 'SET_ERROR', error: err instanceof Error ? err.message : String(err) });
            }
            dispatch({
                type: 'SET_MESSAGE_GENERATING',
                messageId,
                isGenerating: false,
            });
        } finally {
            abortControllersRef.current.delete(messageId);
            dispatch({ type: 'SET_GENERATING', isGenerating: false });
        }
    }, [state.currentProject]);

    const generateABCompare = useCallback(async (messageId: string) => {
        if (!state.currentProject) return;

        const apiConfig = state.currentProject.apiConfig;

        // 校验：对比模型必须已配置
        if (!apiConfig.hasCompareModel) {
            dispatch({ type: 'SET_ERROR', error: '请先在服务端环境变量中配置对比模型' });
            return;
        }

        dispatch({ type: 'SET_GENERATING', isGenerating: true });

        const messageIndex = state.currentProject.messages.findIndex(
            (m) => m.id === messageId
        );
        if (messageIndex === -1) {
            dispatch({ type: 'SET_GENERATING', isGenerating: false });
            return;
        }

        // 清空目标 assistant 消息内容
        const clearedMessages = state.currentProject.messages.map((m) =>
            m.id === messageId ? { ...m, isGenerating: true, content: [] } : m
        );

        // 创建对比消息 B
        const groupId = generateId();
        const messageB: EditorMessage = {
            id: generateId(),
            role: 'assistant',
            content: [],
            isGenerating: true,
            abGroupId: groupId,
            abLabel: 'B',
        };

        // 标记目标消息为 A
        const updatedMessages = clearedMessages.map((m) =>
            m.id === messageId
                ? { ...m, abGroupId: groupId, abLabel: 'A' }
                : m
        );

        // 在目标消息之后插入消息 B
        const targetIdx = updatedMessages.findIndex((m) => m.id === messageId);
        const newMessages = [...updatedMessages];
        newMessages.splice(targetIdx + 1, 0, messageB);

        const updatedProject = {
            ...state.currentProject,
            messages: newMessages,
        };

        dispatch({ type: 'SET_CURRENT_PROJECT', project: updatedProject });
        dispatch({ type: 'SET_ERROR', error: null });

        // 创建 AbortController（A/B 对比共享一个 controller）
        const controller = new AbortController();
        abortControllersRef.current.set(messageId, controller);
        abortControllersRef.current.set(messageB.id, controller);

        // 构建上下文消息（目标消息之前的所有消息）
        const previousMessages = state.currentProject.messages.slice(0, messageIndex);
        const contextMessages = previousMessages.map((m) => ({
            role: m.role,
            content: m.content,
        }));

        // 构建两个请求
        const baseRequest = {
            systemPrompt: state.currentProject.systemPrompt,
            messages: contextMessages,
            temperature: apiConfig.temperature,
            topP: apiConfig.topP,
            topK: apiConfig.topK,
            maxTokens: apiConfig.maxTokens,
            stopSequences: apiConfig.stopSequences,
            stream: apiConfig.stream,
            thinking: apiConfig.thinking,
            thinkingBudget: apiConfig.thinkingBudget,
        };

        const requestA: GenerateRequest = {
            ...baseRequest,
            targetModel: 'primary',
        };

        const requestB: GenerateRequest = {
            ...baseRequest,
            targetModel: 'compare',
        };

        try {
            // 并行发起两个请求
            const [resA, resB] = await Promise.all([
                fetch('/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestA),
                    signal: controller.signal,
                }),
                fetch('/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestB),
                    signal: controller.signal,
                }),
            ]);

            // 检查响应状态
            if (!resA.ok) {
                const errData = await resA.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(`模型A生成失败: ${errData.error || 'Unknown error'}`);
            }
            if (!resB.ok) {
                const errData = await resB.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(`模型B生成失败: ${errData.error || 'Unknown error'}`);
            }

            if (apiConfig.stream) {
                // 并行消费两个流
                await Promise.all([
                    consumeStreamResponse(resA, messageId, dispatch, controller.signal),
                    consumeStreamResponse(resB, messageB.id, dispatch, controller.signal),
                ]);
            } else {
                // 并行解析两个非流式响应
                const [dataA, dataB]: [GenerateResponse, GenerateResponse] = await Promise.all([
                    resA.json() as Promise<GenerateResponse>,
                    resB.json() as Promise<GenerateResponse>,
                ]);

                dispatch({ type: 'SET_ASSISTANT_CONTENT', messageId, content: dataA.content });
                dispatch({ type: 'SET_ASSISTANT_CONTENT', messageId: messageB.id, content: dataB.content });
            }
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                // 用户主动中断，不视为错误
            } else {
                dispatch({
                    type: 'SET_ERROR',
                    error: err instanceof Error ? err.message : String(err),
                });
            }
            // 标记两个消息都停止生成
            dispatch({ type: 'SET_MESSAGE_GENERATING', messageId, isGenerating: false });
            dispatch({ type: 'SET_MESSAGE_GENERATING', messageId: messageB.id, isGenerating: false });
        } finally {
            abortControllersRef.current.delete(messageId);
            abortControllersRef.current.delete(messageB.id);
            dispatch({ type: 'SET_GENERATING', isGenerating: false });
        }
    }, [state.currentProject]);

    const stopGeneration = useCallback((messageId: string) => {
        const controller = abortControllersRef.current.get(messageId);
        if (controller) {
            controller.abort();
            abortControllersRef.current.delete(messageId);
        }
        dispatch({ type: 'SET_MESSAGE_GENERATING', messageId, isGenerating: false });
    }, []);

    const resolveABCompare = useCallback((keepMessageId: string, abGroupId: string) => {
        dispatch({ type: 'RESOLVE_AB_COMPARE', keepMessageId, abGroupId });
    }, []);

    const toggleApiConfig = useCallback(() => dispatch({ type: 'TOGGLE_API_CONFIG' }), []);
    const toggleProjectList = useCallback(() => dispatch({ type: 'TOGGLE_PROJECT_LIST' }), []);
    const openPromptAssets = useCallback((entry: PromptAssetDrawerEntry = 'browse') => {
        dispatch({ type: 'OPEN_PROMPT_ASSETS', entry });
    }, []);
    const togglePromptAssets = useCallback((entry: PromptAssetDrawerEntry = 'browse') => {
        dispatch({ type: 'TOGGLE_PROMPT_ASSETS', entry });
    }, []);
    const closePromptAssets = useCallback(() => dispatch({ type: 'CLOSE_PROMPT_ASSETS' }), []);
    const updateSystemPrompt = useCallback((systemPrompt: string) => dispatch({ type: 'UPDATE_SYSTEM_PROMPT', systemPrompt }), []);
    const updateApiConfig = useCallback((apiConfig: Partial<ApiConfig>) => dispatch({ type: 'UPDATE_API_CONFIG', apiConfig }), []);
    const addMessage = useCallback((role: MessageRole) => dispatch({ type: 'ADD_MESSAGE', role }), []);
    const deleteMessage = useCallback((messageId: string) => dispatch({ type: 'DELETE_MESSAGE', messageId }), []);
    const updateMessageRole = useCallback((messageId: string, role: MessageRole) => dispatch({ type: 'UPDATE_MESSAGE_ROLE', messageId, role }), []);
    const addContentBlock = useCallback((messageId: string, blockType: ContentBlock['type']) => dispatch({ type: 'ADD_CONTENT_BLOCK', messageId, blockType }), []);
    const deleteContentBlock = useCallback((messageId: string, blockIndex: number) => dispatch({ type: 'DELETE_CONTENT_BLOCK', messageId, blockIndex }), []);
    const updateContentBlock = useCallback((messageId: string, blockIndex: number, block: ContentBlock) => dispatch({ type: 'UPDATE_CONTENT_BLOCK', messageId, blockIndex, block }), []);
    const moveMessage = useCallback((messageId: string, direction: 'up' | 'down') => dispatch({ type: 'MOVE_MESSAGE', messageId, direction }), []);
    const setAssistantContent = useCallback((messageId: string, content: ContentBlock[]) => dispatch({ type: 'SET_ASSISTANT_CONTENT', messageId, content }), []);
    const updateProjectName = useCallback((name: string) => dispatch({ type: 'UPDATE_PROJECT_NAME', name }), []);
    const setError = useCallback((error: string | null) => dispatch({ type: 'SET_ERROR', error }), []);
    const setPromptAssetNotice = useCallback((notice: PromptAssetNotice | null) => {
        dispatch({ type: 'SET_PROMPT_ASSET_NOTICE', notice });
    }, []);

    const renameProject = useCallback(async (name: string) => {
        const normalizedName = name.trim();
        if (!state.currentProject || !normalizedName || normalizedName === state.currentProject.meta.name) {
            return;
        }

        const previousName = state.currentProject.meta.name;
            const updatedProject: ProjectData = {
            ...state.currentProject,
            meta: {
                ...state.currentProject.meta,
                name: normalizedName,
            },
        };

        dispatch({ type: 'UPDATE_PROJECT_NAME', name: normalizedName });
        dispatch({ type: 'SET_SAVING', isSaving: true });

        try {
            const response = await fetch(getProjectDetailEndpoint(state.currentProject.meta.id, workspaceSlug), workspaceSlug
                ? {
                      method: 'PATCH',
                      headers: {
                          'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                          name: normalizedName,
                          expectedRevisionId: state.currentProject.currentRevisionId ?? null,
                      }),
                  }
                : {
                      method: 'PUT',
                      headers: {
                          'Content-Type': 'application/json',
                      },
                      body: JSON.stringify(updatedProject),
                  });

            if (!response.ok) {
                throw new Error('Failed to update project name');
            }

            if (workspaceSlug) {
                const payload = await response.json() as ApiEnvelope<WorkspaceProjectDetail>;
                dispatch({
                    type: 'SET_CURRENT_PROJECT',
                    project: mapWorkspaceProjectDetail(extractApiData(payload)),
                });
            }

            dispatch({ type: 'SET_ERROR', error: null });
            await loadProjects();
        } catch (err) {
            dispatch({ type: 'UPDATE_PROJECT_NAME', name: previousName });
            dispatch({ type: 'SET_ERROR', error: err instanceof Error ? err.message : String(err) });
            throw err;
        } finally {
            dispatch({ type: 'SET_SAVING', isSaving: false });
        }
    }, [loadProjects, state.currentProject, workspaceSlug]);

    const actions = useMemo<EditorActions>(() => ({
        dispatch,
        loadProjects,
        loadProject,
        saveProject,
        createProject,
        deleteProject,
        generateForMessage,
        generateABCompare,
        stopGeneration,
        resolveABCompare,
        renameProject,
        toggleApiConfig,
        toggleProjectList,
        openPromptAssets,
        togglePromptAssets,
        closePromptAssets,
        updateSystemPrompt,
        updateApiConfig,
        addMessage,
        deleteMessage,
        updateMessageRole,
        addContentBlock,
        deleteContentBlock,
        updateContentBlock,
        moveMessage,
        setAssistantContent,
        updateProjectName,
        setError,
        setPromptAssetNotice,
    }), [
        loadProjects,
        loadProject,
        saveProject,
        createProject,
        deleteProject,
        generateForMessage,
        generateABCompare,
        stopGeneration,
        resolveABCompare,
        renameProject,
        toggleApiConfig,
        toggleProjectList,
        openPromptAssets,
        togglePromptAssets,
        closePromptAssets,
        updateSystemPrompt,
        updateApiConfig,
        addMessage,
        deleteMessage,
        updateMessageRole,
        addContentBlock,
        deleteContentBlock,
        updateContentBlock,
        moveMessage,
        setAssistantContent,
        updateProjectName,
        setError,
        setPromptAssetNotice,
    ]);

    return (
        <EditorStateContext.Provider value={state}>
            <EditorActionsContext.Provider value={actions}>
                {children}
            </EditorActionsContext.Provider>
        </EditorStateContext.Provider>
    );
}

export function useEditorState() {
    const state = useContext(EditorStateContext);
    if (!state) {
        throw new Error('useEditorState must be used within an EditorProvider');
    }

    return state;
}

export function useEditorActions() {
    const actions = useContext(EditorActionsContext);
    if (!actions) {
        throw new Error('useEditorActions must be used within an EditorProvider');
    }

    return actions;
}

export function useEditor() {
    const state = useEditorState();
    const actions = useEditorActions();

    return {
        state,
        ...actions,
    };
}
