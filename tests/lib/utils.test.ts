import { describe, it, expect } from 'vitest';
import { generateId, createDefaultApiConfig, createEmptyMessage, createNewProject, exportToXmlPrompt } from '../../app/lib/utils';
import { EditorMessage } from '../../app/types';

describe('Utils', () => {
    describe('generateId', () => {
        it('should generate a string', () => {
            const id = generateId();
            expect(typeof id).toBe('string');
            expect(id.length).toBeGreaterThan(5);
        });

        it('should generate unique ids', () => {
            const id1 = generateId();
            const id2 = generateId();
            expect(id1).not.toBe(id2);
        });
    });

    describe('createDefaultApiConfig', () => {
        it('should return default api config', () => {
            const config = createDefaultApiConfig();
            expect(config).toEqual({
                baseUrl: 'https://api.anthropic.com',
                apiKey: '',
                model: 'claude-sonnet-4-20250514',
                maxTokens: undefined
            });
        });
    });

    describe('createEmptyMessage', () => {
        it('should create an empty user message', () => {
            const msg = createEmptyMessage('user');
            expect(msg.role).toBe('user');
            expect(msg.content).toEqual([{ type: 'text', text: '' }]);
            expect(typeof msg.id).toBe('string');
        });

        it('should create an empty assistant message', () => {
            const msg = createEmptyMessage('assistant');
            expect(msg.role).toBe('assistant');
            expect(msg.content).toEqual([{ type: 'text', text: '' }]);
            expect(typeof msg.id).toBe('string');
        });
    });

    describe('exportToXmlPrompt', () => {
        it('should format basic system prompt and messages correctly', () => {
            const systemPrompt = 'You are a helpful assistant.';
            const messages: EditorMessage[] = [
                { id: '1', role: 'user', content: [{ type: 'text', text: 'Hello' }] },
                { id: '2', role: 'assistant', content: [{ type: 'text', text: 'Hi there!' }] }
            ];

            const expected = `<system>
  You are a helpful assistant.
</system>
<user>
  Hello
</user>
<assistant>
  Hi there!
</assistant>`;

            expect(exportToXmlPrompt(systemPrompt, messages)).toBe(expected);
        });

        it('should omit system tag when system prompt is empty', () => {
            const systemPrompt = '';
            const messages: EditorMessage[] = [
                { id: '1', role: 'user', content: [{ type: 'text', text: 'Hello' }] }
            ];

            const expected = `<user>
  Hello
</user>`;

            expect(exportToXmlPrompt(systemPrompt, messages)).toBe(expected);
        });

        it('should handle thinking blocks', () => {
            const systemPrompt = 'System';
            const messages: EditorMessage[] = [
                { id: '1', role: 'assistant', content: [
                    { type: 'thinking', thinking: 'Let me think...' },
                    { type: 'text', text: 'Final answer' }
                ] }
            ];

            const expected = `<system>
  System
</system>
<assistant>
  <thinking>
    Let me think...
  </thinking>
  Final answer
</assistant>`;

            expect(exportToXmlPrompt(systemPrompt, messages)).toBe(expected);
        });

        it('should handle multiple text blocks in one message', () => {
            const systemPrompt = '';
            const messages: EditorMessage[] = [
                { id: '1', role: 'user', content: [
                    { type: 'text', text: 'First block' },
                    { type: 'text', text: 'Second block' }
                ] }
            ];

            const expected = `<user>
  First block
  Second block
</user>`;

            expect(exportToXmlPrompt(systemPrompt, messages)).toBe(expected);
        });

        it('should handle empty message list', () => {
            const systemPrompt = 'System';
            const messages: EditorMessage[] = [];

            const expected = `<system>\n  System\n</system>`;

            expect(exportToXmlPrompt(systemPrompt, messages)).toBe(expected);
        });
    });

    describe('createNewProject', () => {
        it('should create a new project with default values', () => {
            const name = 'Test Project';
            const project = createNewProject(name);

            expect(project.meta.name).toBe(name);
            expect(typeof project.meta.id).toBe('string');
            expect(project.meta.createdAt).toBeDefined();
            expect(project.meta.updatedAt).toBeDefined();

            expect(project.systemPrompt).toBe('You are a helpful assistant.');
            expect(project.messages).toHaveLength(2);
            expect(project.messages[0].role).toBe('user');
            expect(project.messages[0].content).toEqual([{ type: 'text', text: 'Hello, how can you help me?' }]);
            expect(project.messages[1].role).toBe('assistant');
            expect(project.messages[1].content).toEqual([{ type: 'text', text: 'Hello! I\'m a helpful assistant. I can help you with various tasks. How can I assist you today?' }]);
            expect(project.apiConfig).toEqual({
                baseUrl: 'https://api.anthropic.com',
                apiKey: '',
                model: 'claude-sonnet-4-20250514',
                maxTokens: undefined
            });
        });
    });
});
