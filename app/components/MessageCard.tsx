'use client';

import React, { useState } from 'react';
import { ChevronUp, ChevronDown, Trash2, Plus, Sparkles } from 'lucide-react';
import { useEditor } from '../contexts/EditorContext';
import { EditorMessage, ContentBlock } from '../types';
import ContentBlockEditor from './ContentBlockEditor';

interface MessageCardProps {
    message: EditorMessage;
    index: number;
    totalCount: number;
}

export default function MessageCard({ message, index, totalCount }: MessageCardProps) {
    const { deleteMessage, updateMessageRole, addContentBlock, moveMessage, generateForMessage } = useEditor();
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [showConfirmDelete, setShowConfirmDelete] = useState(false);

    const isUser = message.role === 'user';
    const bgColorClass = isUser
        ? 'bg-blue-50 dark:bg-blue-900/10'
        : 'bg-green-50 dark:bg-green-900/10';

    const borderColorClass = isUser
        ? 'border-blue-200 dark:border-blue-900/30'
        : 'border-green-200 dark:border-green-900/30';

    const labelClass = isUser
        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
        : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';

    const handleAddBlock = (type: ContentBlock['type']) => {
        addContentBlock(message.id, type);
        setShowAddMenu(false);
    };

    const handleDelete = () => {
        if (showConfirmDelete) {
            deleteMessage(message.id);
        } else {
            setShowConfirmDelete(true);
            // Auto-hide confirm after 3 seconds
            setTimeout(() => setShowConfirmDelete(false), 3000);
        }
    };

    return (
        <div className={`relative flex flex-col rounded-lg border ${borderColorClass} ${bgColorClass} shadow-sm overflow-visible transition-colors duration-200`}>
            {/* Header / Toolbar */}
            <div className={`flex items-center justify-between px-4 py-2 border-b ${borderColorClass} bg-white/50 dark:bg-black/20`}>
                <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wider ${labelClass}`}>
                        {message.role}
                    </span>

                    <select
                        value={message.role}
                        onChange={(e) => updateMessageRole(message.id, e.target.value as 'user' | 'assistant')}
                        className="text-sm bg-transparent border-none text-gray-600 dark:text-gray-300 focus:ring-0 cursor-pointer"
                    >
                        <option value="user">User</option>
                        <option value="assistant">Assistant</option>
                    </select>

                    {message.isGenerating && (
                        <div className="flex items-center gap-2 text-xs text-gray-500 bg-white dark:bg-gray-800 px-2 py-1 rounded-full border dark:border-gray-700">
                            <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                            生成中...
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    {!isUser && (
                        <button
                            onClick={() => generateForMessage(message.id)}
                            disabled={message.isGenerating}
                            className={`p-1.5 flex items-center gap-1 rounded transition-colors ${message.isGenerating
                                    ? 'text-gray-400 cursor-not-allowed'
                                    : 'text-purple-600 hover:text-purple-700 hover:bg-purple-100 dark:text-purple-400 dark:hover:text-purple-300 dark:hover:bg-purple-900/30'
                                }`}
                            title="生成回复"
                        >
                            <Sparkles size={16} />
                        </button>
                    )}

                    {!isUser && <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />}

                    <button
                        onClick={() => moveMessage(message.id, 'up')}
                        disabled={index === 0}
                        className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed rounded"
                        title="上移"
                    >
                        <ChevronUp size={16} />
                    </button>

                    <button
                        onClick={() => moveMessage(message.id, 'down')}
                        disabled={index === totalCount - 1}
                        className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed rounded"
                        title="下移"
                    >
                        <ChevronDown size={16} />
                    </button>

                    <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />

                    <div className="relative">
                        <button
                            onClick={() => setShowAddMenu(!showAddMenu)}
                            className="p-1.5 text-gray-400 hover:text-blue-500 rounded transition-colors flex items-center gap-1"
                            title="添加内容块"
                        >
                            <Plus size={16} />
                        </button>

                        {showAddMenu && (
                            <div className="absolute right-0 top-full mt-1 z-10 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg overflow-hidden">
                                <div className="py-1">
                                    <button onClick={() => handleAddBlock('text')} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">添加 Text</button>
                                    {isUser ? (
                                        <button onClick={() => handleAddBlock('tool_result')} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">添加 Tool Result</button>
                                    ) : (
                                        <>
                                            <button onClick={() => handleAddBlock('thinking')} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">添加 Thinking</button>
                                            <button onClick={() => handleAddBlock('tool_use')} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">添加 Tool Use</button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />

                    <button
                        onClick={handleDelete}
                        className={`p-1.5 rounded transition-colors ${showConfirmDelete
                            ? 'bg-red-500 text-white hover:bg-red-600'
                            : 'text-gray-400 hover:text-red-500'
                            }`}
                        title={showConfirmDelete ? "点击确认删除" : "删除消息"}
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {/* Content Blocks */}
            <div className="p-4 flex flex-col gap-3">
                {message.content.length === 0 ? (
                    <div className="text-center py-4 text-sm text-gray-400 italic">
                        空消息，请点击右上角 + 添加内容块
                    </div>
                ) : (
                    message.content.map((block, i) => (
                        <ContentBlockEditor
                            key={`${message.id}-block-${i}`}
                            block={block}
                            messageId={message.id}
                            blockIndex={i}
                            totalBlocks={message.content.length}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
