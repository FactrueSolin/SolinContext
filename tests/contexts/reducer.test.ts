import { describe, it, expect } from 'vitest';
import { editorReducer, initialState, EditorState, EditorAction } from '../../app/contexts/EditorContext';
import { ProjectData } from '../../app/types';

describe('editorReducer', () => {
    const mockProject: ProjectData = {
        meta: {
            id: 'p1',
            name: 'Test Project',
            createdAt: '2023-01-01T00:00:00.000Z',
            updatedAt: '2023-01-01T00:00:00.000Z'
        },
        systemPrompt: 'You are a helpful assistant.',
        messages: [
            { id: 'm1', role: 'user', content: [{ type: 'text', text: 'Hello' }] }
        ],
        apiConfig: {
            baseUrl: 'https://api.anthropic.com',
            apiKey: 'test-key',
            model: 'claude-3',
        }
    };

    const stateWithProject: EditorState = {
        ...initialState,
        currentProject: mockProject
    };

    it('should handle SET_PROJECTS', () => {
        const projects = [mockProject.meta];
        const action: EditorAction = { type: 'SET_PROJECTS', projects };
        const state = editorReducer(initialState, action);
        expect(state.projects).toEqual(projects);
    });

    it('should handle SET_CURRENT_PROJECT', () => {
        const action: EditorAction = { type: 'SET_CURRENT_PROJECT', project: mockProject };
        const state = editorReducer(initialState, action);
        expect(state.currentProject).toEqual(mockProject);
    });

    it('should handle SET_LOADING', () => {
        const action: EditorAction = { type: 'SET_LOADING', isLoading: true };
        const state = editorReducer(initialState, action);
        expect(state.isLoading).toBe(true);
    });

    it('should handle SET_SAVING', () => {
        const action: EditorAction = { type: 'SET_SAVING', isSaving: true };
        const state = editorReducer(initialState, action);
        expect(state.isSaving).toBe(true);
    });

    it('should handle SET_GENERATING', () => {
        const action: EditorAction = { type: 'SET_GENERATING', isGenerating: true };
        const state = editorReducer(initialState, action);
        expect(state.isGenerating).toBe(true);
    });

    it('should handle SET_ERROR', () => {
        const action: EditorAction = { type: 'SET_ERROR', error: 'Test error' };
        const state = editorReducer(initialState, action);
        expect(state.error).toBe('Test error');
    });

    it('should handle TOGGLE_API_CONFIG', () => {
        const action: EditorAction = { type: 'TOGGLE_API_CONFIG' };
        const state = editorReducer(initialState, action);
        expect(state.showApiConfig).toBe(true);
    });

    it('should handle TOGGLE_PROJECT_LIST', () => {
        const action: EditorAction = { type: 'TOGGLE_PROJECT_LIST' };
        const state = editorReducer({ ...initialState, showProjectList: true }, action);
        expect(state.showProjectList).toBe(false);
    });

    it('should handle UPDATE_SYSTEM_PROMPT', () => {
        const action: EditorAction = { type: 'UPDATE_SYSTEM_PROMPT', systemPrompt: 'New prompt' };
        const state = editorReducer(stateWithProject, action);
        expect(state.currentProject?.systemPrompt).toBe('New prompt');
    });

    it('should handle UPDATE_API_CONFIG', () => {
        const action: EditorAction = { type: 'UPDATE_API_CONFIG', apiConfig: { model: 'new-model' } };
        const state = editorReducer(stateWithProject, action);
        expect(state.currentProject?.apiConfig.model).toBe('new-model');
        expect(state.currentProject?.apiConfig.apiKey).toBe('test-key');
    });

    it('should handle ADD_MESSAGE', () => {
        const action: EditorAction = { type: 'ADD_MESSAGE', role: 'assistant' };
        const state = editorReducer(stateWithProject, action);
        expect(state.currentProject?.messages.length).toBe(2);
        expect(state.currentProject?.messages[1].role).toBe('assistant');
    });

    it('should handle DELETE_MESSAGE', () => {
        const action: EditorAction = { type: 'DELETE_MESSAGE', messageId: 'm1' };
        const state = editorReducer(stateWithProject, action);
        expect(state.currentProject?.messages.length).toBe(0);
    });

    it('should handle UPDATE_MESSAGE_ROLE', () => {
        const action: EditorAction = { type: 'UPDATE_MESSAGE_ROLE', messageId: 'm1', role: 'assistant' };
        const state = editorReducer(stateWithProject, action);
        expect(state.currentProject?.messages[0].role).toBe('assistant');
    });

    it('should handle ADD_CONTENT_BLOCK', () => {
        const action: EditorAction = { type: 'ADD_CONTENT_BLOCK', messageId: 'm1', blockType: 'thinking' };
        const state = editorReducer(stateWithProject, action);
        expect(state.currentProject?.messages[0].content.length).toBe(2);
        expect(state.currentProject?.messages[0].content[1].type).toBe('thinking');
    });

    it('should handle DELETE_CONTENT_BLOCK', () => {
        const action: EditorAction = { type: 'DELETE_CONTENT_BLOCK', messageId: 'm1', blockIndex: 0 };
        const state = editorReducer(stateWithProject, action);
        expect(state.currentProject?.messages[0].content.length).toBe(0);
    });

    it('should handle UPDATE_CONTENT_BLOCK', () => {
        const newBlock = { type: 'text' as const, text: 'Updated' };
        const action: EditorAction = { type: 'UPDATE_CONTENT_BLOCK', messageId: 'm1', blockIndex: 0, block: newBlock };
        const state = editorReducer(stateWithProject, action);
        expect(state.currentProject?.messages[0].content[0]).toEqual(newBlock);
    });

    it('should handle MOVE_MESSAGE', () => {
        const stateTwoMessages = {
            ...stateWithProject,
            currentProject: {
                ...mockProject,
                messages: [
                    { id: 'm1', role: 'user' as const, content: [] },
                    { id: 'm2', role: 'assistant' as const, content: [] }
                ]
            }
        };

        const action: EditorAction = { type: 'MOVE_MESSAGE', messageId: 'm2', direction: 'up' };
        const state = editorReducer(stateTwoMessages, action);
        expect(state.currentProject?.messages[0].id).toBe('m2');
        expect(state.currentProject?.messages[1].id).toBe('m1');
    });

    it('should handle SET_ASSISTANT_CONTENT', () => {
        const newContent = [{ type: 'text' as const, text: 'Response' }];
        const action: EditorAction = { type: 'SET_ASSISTANT_CONTENT', messageId: 'm1', content: newContent };
        const state = editorReducer(stateWithProject, action);
        expect(state.currentProject?.messages[0].content).toEqual(newContent);
        expect(state.currentProject?.messages[0].isGenerating).toBe(false);
    });

    it('should handle UPDATE_PROJECT_NAME for current project and project list', () => {
        const action: EditorAction = { type: 'UPDATE_PROJECT_NAME', name: 'Renamed Project' };
        const state = editorReducer({
            ...stateWithProject,
            projects: [mockProject.meta],
        }, action);

        expect(state.currentProject?.meta.name).toBe('Renamed Project');
        expect(state.projects[0]?.name).toBe('Renamed Project');
    });
});
