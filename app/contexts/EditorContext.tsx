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
    | { type: 'UPDATE_PROJECT_NAME'; name: string };

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
        default:
            return state;
    }
}

interface EditorContextType {
    state: EditorState;
    dispatch: React.Dispatch<EditorAction>;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

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

            const request: GenerateRequest = {
                baseUrl: state.currentProject.apiConfig.baseUrl,
                apiKey: state.currentProject.apiConfig.apiKey,
                model: state.currentProject.apiConfig.model,
                systemPrompt: state.currentProject.systemPrompt,
                messages: previousMessages.map((m) => ({
                    role: m.role,
                    content: m.content,
                })),
            };

            const res = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to generate message');
            }

            const data: GenerateResponse = await res.json();

            dispatch({
                type: 'SET_ASSISTANT_CONTENT',
                messageId: messageId,
                content: data.content
            });
        } catch (err) {
            dispatch({ type: 'SET_ERROR', error: err instanceof Error ? err.message : String(err) });
            dispatch({
                type: 'SET_CURRENT_PROJECT',
                project: {
                    ...state.currentProject,
                    messages: state.currentProject.messages.map((m) =>
                        m.id === messageId ? { ...m, isGenerating: false } : m
                    ),
                },
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
