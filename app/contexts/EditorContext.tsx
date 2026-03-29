'use client';

import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import type {
    ProjectMeta,
    ProjectData,
    ApiConfig,
    MessageRole,
    ContentBlock,
    EditorMessage,
    GenerateRequest,
    GenerateResponse
} from '../types';
import { createDefaultApiConfig, createEmptyMessage, generateId } from '../lib/utils';

export interface EditorState {
    projects: ProjectMeta[];
    currentProject: ProjectData | null;
    isLoading: boolean;
    isSaving: boolean;
    isGenerating: boolean;
    error: string | null;
    showApiConfig: boolean;
    showProjectList: boolean;
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
    | { type: 'SET_MESSAGE_GENERATING'; messageId: string; isGenerating: boolean };

export const initialState: EditorState = {
    projects: [],
    currentProject: null,
    isLoading: false,
    isSaving: false,
    isGenerating: false,
    error: null,
    showApiConfig: false,
    showProjectList: true,
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
            return { ...state, showApiConfig: !state.showApiConfig };
        case 'TOGGLE_PROJECT_LIST':
            return { ...state, showProjectList: !state.showProjectList };
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
            const newApiConfig = { ...state.currentProject.apiConfig, ...action.apiConfig };
            try {
                localStorage.setItem('aicontext_api_config', JSON.stringify(newApiConfig));
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
        default:
            return state;
    }
}

interface EditorContextType {
    state: EditorState;
    dispatch: React.Dispatch<EditorAction>;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

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
    dispatch: React.Dispatch<EditorAction>
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
            const { done, value } = await reader.read();
            if (done) break;

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

    return (
        <EditorContext.Provider value={{ state, dispatch }}>
            {children}
        </EditorContext.Provider>
    );
}

export function useEditor() {
    const context = useContext(EditorContext);
    if (!context) {
        throw new Error('useEditor must be used within an EditorProvider');
    }

    const { state, dispatch } = context;

    const loadProjects = useCallback(async () => {
        dispatch({ type: 'SET_LOADING', isLoading: true });
        try {
            const res = await fetch('/api/projects');
            if (!res.ok) throw new Error('Failed to load projects');
            const data = await res.json();
            dispatch({ type: 'SET_PROJECTS', projects: data });
            dispatch({ type: 'SET_ERROR', error: null });
        } catch (err) {
            dispatch({ type: 'SET_ERROR', error: err instanceof Error ? err.message : String(err) });
        } finally {
            dispatch({ type: 'SET_LOADING', isLoading: false });
        }
    }, [dispatch]);

    const loadProject = useCallback(async (id: string) => {
        dispatch({ type: 'SET_LOADING', isLoading: true });
        try {
            const res = await fetch(`/api/projects/${id}`);
            if (!res.ok) throw new Error('Failed to load project');
            const data = await res.json();
            dispatch({ type: 'SET_CURRENT_PROJECT', project: data });
            dispatch({ type: 'SET_ERROR', error: null });
        } catch (err) {
            dispatch({ type: 'SET_ERROR', error: err instanceof Error ? err.message : String(err) });
        } finally {
            dispatch({ type: 'SET_LOADING', isLoading: false });
        }
    }, [dispatch]);

    const saveProject = useCallback(async () => {
        if (!state.currentProject) return;
        dispatch({ type: 'SET_SAVING', isSaving: true });
        try {
            const res = await fetch(`/api/projects/${state.currentProject.meta.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(state.currentProject),
            });
            if (!res.ok) throw new Error('Failed to save project');
            dispatch({ type: 'SET_ERROR', error: null });
            await loadProjects();
        } catch (err) {
            dispatch({ type: 'SET_ERROR', error: err instanceof Error ? err.message : String(err) });
        } finally {
            dispatch({ type: 'SET_SAVING', isSaving: false });
        }
    }, [state.currentProject, loadProjects, dispatch]);

    const createProject = useCallback(async (name: string) => {
        dispatch({ type: 'SET_LOADING', isLoading: true });
        try {
            let defaultApiConfig = createDefaultApiConfig();
            try {
                const storedConfig = localStorage.getItem('aicontext_api_config');
                if (storedConfig) {
                    defaultApiConfig = { ...defaultApiConfig, ...JSON.parse(storedConfig) };
                }
            } catch (e) {
                console.error('Failed to load API config from localStorage', e);
            }

            const res = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, apiConfig: defaultApiConfig }),
            });
            if (!res.ok) throw new Error('Failed to create project');
            const data = await res.json();
            dispatch({ type: 'SET_CURRENT_PROJECT', project: data });
            dispatch({ type: 'SET_ERROR', error: null });
            await loadProjects();
            return data;
        } catch (err) {
            dispatch({ type: 'SET_ERROR', error: err instanceof Error ? err.message : String(err) });
            throw err;
        } finally {
            dispatch({ type: 'SET_LOADING', isLoading: false });
        }
    }, [loadProjects, dispatch]);

    const deleteProject = useCallback(async (id: string) => {
        dispatch({ type: 'SET_LOADING', isLoading: true });
        try {
            const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
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
    }, [state.currentProject, loadProjects, dispatch]);

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

        try {
            const previousMessages = state.currentProject.messages.slice(0, messageIndex);

            const apiConfig = state.currentProject.apiConfig;
            const request: GenerateRequest = {
                baseUrl: apiConfig.baseUrl,
                apiKey: apiConfig.apiKey,
                model: apiConfig.model,
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
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(errorData.error || 'Failed to generate message');
            }

            if (apiConfig.stream) {
                // 流式模式：读取 SSE 事件并实时更新
                await consumeStreamResponse(res, messageId, dispatch);
            } else {
                // 非流式模式：一次性获取完整响应
                const data: GenerateResponse = await res.json();
                dispatch({
                    type: 'SET_ASSISTANT_CONTENT',
                    messageId: messageId,
                    content: data.content
                });
            }
        } catch (err) {
            dispatch({ type: 'SET_ERROR', error: err instanceof Error ? err.message : String(err) });
            dispatch({
                type: 'SET_MESSAGE_GENERATING',
                messageId: messageId,
                isGenerating: false,
            });
        } finally {
            dispatch({ type: 'SET_GENERATING', isGenerating: false });
        }
    }, [state.currentProject, dispatch]);

    const toggleApiConfig = useCallback(() => dispatch({ type: 'TOGGLE_API_CONFIG' }), [dispatch]);
    const toggleProjectList = useCallback(() => dispatch({ type: 'TOGGLE_PROJECT_LIST' }), [dispatch]);
    const updateSystemPrompt = useCallback((systemPrompt: string) => dispatch({ type: 'UPDATE_SYSTEM_PROMPT', systemPrompt }), [dispatch]);
    const updateApiConfig = useCallback((apiConfig: Partial<ApiConfig>) => dispatch({ type: 'UPDATE_API_CONFIG', apiConfig }), [dispatch]);
    const addMessage = useCallback((role: MessageRole) => dispatch({ type: 'ADD_MESSAGE', role }), [dispatch]);
    const deleteMessage = useCallback((messageId: string) => dispatch({ type: 'DELETE_MESSAGE', messageId }), [dispatch]);
    const updateMessageRole = useCallback((messageId: string, role: MessageRole) => dispatch({ type: 'UPDATE_MESSAGE_ROLE', messageId, role }), [dispatch]);
    const addContentBlock = useCallback((messageId: string, blockType: ContentBlock['type']) => dispatch({ type: 'ADD_CONTENT_BLOCK', messageId, blockType }), [dispatch]);
    const deleteContentBlock = useCallback((messageId: string, blockIndex: number) => dispatch({ type: 'DELETE_CONTENT_BLOCK', messageId, blockIndex }), [dispatch]);
    const updateContentBlock = useCallback((messageId: string, blockIndex: number, block: ContentBlock) => dispatch({ type: 'UPDATE_CONTENT_BLOCK', messageId, blockIndex, block }), [dispatch]);
    const moveMessage = useCallback((messageId: string, direction: 'up' | 'down') => dispatch({ type: 'MOVE_MESSAGE', messageId, direction }), [dispatch]);
    const setAssistantContent = useCallback((messageId: string, content: ContentBlock[]) => dispatch({ type: 'SET_ASSISTANT_CONTENT', messageId, content }), [dispatch]);
    const updateProjectName = useCallback((name: string) => dispatch({ type: 'UPDATE_PROJECT_NAME', name }), [dispatch]);
    const setError = useCallback((error: string | null) => dispatch({ type: 'SET_ERROR', error }), [dispatch]);

    return {
        state,
        dispatch,
        loadProjects,
        loadProject,
        saveProject,
        createProject,
        deleteProject,
        generateForMessage,
        toggleApiConfig,
        toggleProjectList,
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
    };
}
