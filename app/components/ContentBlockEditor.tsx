'use client';

import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useEditor } from '../contexts/EditorContext';
import { ContentBlock, TextBlock, ThinkingBlock, ToolUseBlock, ToolResultBlock } from '../types';

interface ContentBlockEditorProps {
    block: ContentBlock;
    messageId: string;
    blockIndex: number;
    totalBlocks: number;
}

export default function ContentBlockEditor({
    block,
    messageId,
    blockIndex,
    totalBlocks,
}: ContentBlockEditorProps) {
    const { updateContentBlock, deleteContentBlock } = useEditor();
    const [isHovered, setIsHovered] = useState(false);

    const handleUpdate = (updatedBlock: ContentBlock) => {
        updateContentBlock(messageId, blockIndex, updatedBlock);
    };

    const renderEditor = () => {
        switch (block.type) {
            case 'text':
                return (
                    <div className="flex flex-col gap-2">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Text</span>
                        <textarea
                            className="w-full p-2 border rounded-md resize-y min-h-[80px] text-sm focus:outline-none focus:ring-1 focus:ring-primary dark:bg-gray-800 dark:border-gray-700"
                            value={block.text}
                            onChange={(e) => handleUpdate({ ...block, text: e.target.value } as TextBlock)}
                            placeholder="输入文本内容..."
                        />
                    </div>
                );
            case 'thinking':
                return (
                    <div className="flex flex-col gap-2 bg-purple-50/50 dark:bg-purple-900/10 p-3 rounded-md border border-purple-100 dark:border-purple-900/30">
                        <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Thinking</span>
                        <textarea
                            className="w-full p-2 border border-purple-200 dark:border-purple-800 rounded-md resize-y min-h-[80px] text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-purple-400"
                            value={block.thinking}
                            onChange={(e) => handleUpdate({ ...block, thinking: e.target.value } as ThinkingBlock)}
                            placeholder="思维过程..."
                        />
                    </div>
                );
            case 'tool_use':
                return (
                    <div className="flex flex-col gap-3 bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-md border border-blue-100 dark:border-blue-900/30">
                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Tool Use</span>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-gray-500">ID</label>
                                <input
                                    type="text"
                                    className="p-1.5 border rounded-md text-sm dark:bg-gray-800 dark:border-gray-700"
                                    value={block.id}
                                    onChange={(e) => handleUpdate({ ...block, id: e.target.value } as ToolUseBlock)}
                                    placeholder="工具调用ID"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-gray-500">Name</label>
                                <input
                                    type="text"
                                    className="p-1.5 border rounded-md text-sm dark:bg-gray-800 dark:border-gray-700"
                                    value={block.name}
                                    onChange={(e) => handleUpdate({ ...block, name: e.target.value } as ToolUseBlock)}
                                    placeholder="工具名称"
                                />
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-gray-500">Input (JSON)</label>
                            <textarea
                                className="w-full p-2 border rounded-md resize-y min-h-[100px] text-sm font-mono dark:bg-gray-800 dark:border-gray-700"
                                value={JSON.stringify(block.input, null, 2)}
                                onChange={(e) => {
                                    try {
                                        const parsed = JSON.parse(e.target.value);
                                        handleUpdate({ ...block, input: parsed } as ToolUseBlock);
                                    } catch (error) {
                                        // Ignore parse errors while typing, but this might be improved in a real app
                                        // For now we just update if it's valid JSON
                                    }
                                }}
                                onBlur={(e) => {
                                    try {
                                        const parsed = JSON.parse(e.target.value);
                                        handleUpdate({ ...block, input: parsed } as ToolUseBlock);
                                    } catch (error) {
                                        // Could show an error indicator here
                                    }
                                }}
                                placeholder="{}"
                            />
                        </div>
                    </div>
                );
            case 'tool_result':
                const contentStr = typeof block.content === 'string'
                    ? block.content
                    : JSON.stringify(block.content, null, 2);

                return (
                    <div className="flex flex-col gap-3 bg-green-50/50 dark:bg-green-900/10 p-3 rounded-md border border-green-100 dark:border-green-900/30">
                        <span className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider">Tool Result</span>
                        <div className="flex items-center gap-3">
                            <div className="flex-1 flex flex-col gap-1">
                                <label className="text-xs text-gray-500">Tool Use ID</label>
                                <input
                                    type="text"
                                    className="p-1.5 border rounded-md text-sm dark:bg-gray-800 dark:border-gray-700"
                                    value={block.tool_use_id}
                                    onChange={(e) => handleUpdate({ ...block, tool_use_id: e.target.value } as ToolResultBlock)}
                                    placeholder="对应的工具调用ID"
                                />
                            </div>
                            <div className="flex items-center gap-2 mt-4">
                                <input
                                    type="checkbox"
                                    id={`error-${messageId}-${blockIndex}`}
                                    checked={!!block.is_error}
                                    onChange={(e) => handleUpdate({ ...block, is_error: e.target.checked } as ToolResultBlock)}
                                    className="rounded text-red-500 focus:ring-red-500"
                                />
                                <label htmlFor={`error-${messageId}-${blockIndex}`} className="text-sm text-red-600 dark:text-red-400">
                                    Is Error
                                </label>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-gray-500">Content</label>
                            <textarea
                                className="w-full p-2 border rounded-md resize-y min-h-[100px] text-sm font-mono dark:bg-gray-800 dark:border-gray-700"
                                value={contentStr}
                                onChange={(e) => {
                                    if (typeof block.content === 'string') {
                                        handleUpdate({ ...block, content: e.target.value } as ToolResultBlock);
                                    } else {
                                        try {
                                            const parsed = JSON.parse(e.target.value);
                                            handleUpdate({ ...block, content: parsed } as ToolResultBlock);
                                        } catch (error) {
                                            // Handle parsing error silently during typing
                                        }
                                    }
                                }}
                                placeholder="工具返回结果..."
                            />
                        </div>
                    </div>
                );
            default:
                return <div>Unknown block type</div>;
        }
    };

    return (
        <div
            className="relative group border border-transparent hover:border-gray-200 dark:hover:border-gray-700 rounded-lg p-2 transition-colors duration-200"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="flex items-start gap-2">
                <div className="flex-1">
                    {renderEditor()}
                </div>

                <div className={`flex flex-col gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200`}>
                    <button
                        onClick={() => deleteContentBlock(messageId, blockIndex)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                        title="删除块"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
