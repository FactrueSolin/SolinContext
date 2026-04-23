'use client';

import React, { useState } from 'react';
import { ChevronUp, ChevronDown, Trash2, Plus, Sparkles, User, Bot, GitCompare, CheckCircle, Square } from 'lucide-react';
import { useEditorActions, useEditorState } from '../contexts/EditorContext';
import { EditorMessage, ContentBlock } from '../types';
import ContentBlockEditor from './content-blocks';

interface MessageCardProps {
    message: EditorMessage;
    index: number;
    totalCount: number;
}

function MessageCard({ message, index, totalCount }: MessageCardProps) {
    const { deleteMessage, updateMessageRole, addContentBlock, moveMessage, generateForMessage, generateABCompare, stopGeneration, resolveABCompare } = useEditorActions();
    const { currentProject } = useEditorState();
    const hasCompareModel = currentProject?.apiConfig.hasCompareModel === true;
    const primaryModelLabel = currentProject?.apiConfig.primaryModelLabel?.trim() || '模型 A';
    const compareModelLabel = currentProject?.apiConfig.compareModelLabel?.trim() || '模型 B';
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [showConfirmDelete, setShowConfirmDelete] = useState(false);

    const isUser = message.role === 'user';

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
        <div
            className={`relative flex flex-col rounded-[var(--radius-lg)] border shadow-sm overflow-visible transition-all duration-[var(--transition-normal)] ${
                isUser
                    ? 'border-[var(--user-border)] bg-[var(--user-bg)]'
                    : 'border-[var(--assistant-border)] bg-[var(--assistant-bg)]'
            }`}
            style={{ boxShadow: 'var(--card-shadow)' }}
        >
            {/* Header / Toolbar */}
            <div
                className={`flex items-center justify-between px-4 py-2.5 border-b transition-colors duration-[var(--transition-fast)] ${
                    isUser
                        ? 'border-[var(--user-border)] bg-[var(--user-header)]/60'
                        : 'border-[var(--assistant-border)] bg-[var(--assistant-header)]/60'
                }`}
            >
                <div className="flex items-center gap-2.5">
                    {/* Role Icon */}
                    <div
                        className={`flex items-center justify-center w-6 h-6 rounded-full ${
                            isUser
                                ? 'bg-blue-200/80 dark:bg-blue-800/40'
                                : 'bg-green-200/80 dark:bg-green-800/40'
                        }`}
                    >
                        {isUser ? (
                            <User size={13} className="text-blue-700 dark:text-blue-300" />
                        ) : (
                            <Bot size={13} className="text-green-700 dark:text-green-300" />
                        )}
                    </div>

                    {/* Role Label */}
                    <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                            isUser
                                ? 'bg-blue-200/60 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
                                : 'bg-green-200/60 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                        }`}
                    >
                        {message.role}
                    </span>

                    {/* A/B 对比标签 — 显示实际模型名 */}
                    {message.abLabel && (
                        <span
                            className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 max-w-[160px] truncate"
                            title={message.abLabel === 'A'
                                ? primaryModelLabel
                                : compareModelLabel
                            }
                        >
                            {message.abLabel === 'A'
                                ? primaryModelLabel
                                : compareModelLabel
                            }
                        </span>
                    )}

                    {/* 保留此条按钮（仅 A/B 对比且非生成中显示） */}
                    {message.abGroupId && !message.isGenerating && (
                        <button
                            onClick={() => resolveABCompare(message.id, message.abGroupId!)}
                            className="p-0.5 flex items-center gap-1 rounded-[var(--radius-sm)] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100/80 dark:text-emerald-400 dark:hover:text-emerald-300 dark:hover:bg-emerald-900/30 transition-all duration-[var(--transition-fast)] active:scale-95"
                            title="保留此条，删除另一条"
                        >
                            <CheckCircle size={14} />
                            <span className="text-[10px] font-medium">保留</span>
                        </button>
                    )}

                    <select
                        value={message.role}
                        onChange={(e) => updateMessageRole(message.id, e.target.value as 'user' | 'assistant')}
                        className="text-xs bg-transparent border-none text-[var(--muted-foreground)] focus:ring-0 cursor-pointer hover:text-[var(--foreground)] transition-colors"
                    >
                        <option value="user">User</option>
                        <option value="assistant">Assistant</option>
                    </select>

                    {message.isGenerating && (
                        <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)] bg-[var(--card-bg)] dark:bg-[var(--muted)] px-2.5 py-1 rounded-full border border-[var(--border)]">
                            <div className="w-3 h-3 border-2 border-[var(--primary)]/30 border-t-[var(--primary)] rounded-full animate-spin" />
                            生成中...
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-0.5">
                    {!isUser && message.isGenerating && (
                        <button
                            onClick={() => stopGeneration(message.id)}
                            className="p-1.5 flex items-center gap-1 rounded-[var(--radius-sm)] text-red-500 hover:text-red-600 hover:bg-red-100/80 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/30 transition-all duration-[var(--transition-fast)] active:scale-95"
                            title="停止生成"
                        >
                            <Square size={15} />
                        </button>
                    )}
                    {!isUser && !message.isGenerating && (
                        <button
                            onClick={() => generateForMessage(message.id)}
                            className="p-1.5 flex items-center gap-1 rounded-[var(--radius-sm)] text-purple-600 hover:text-purple-700 hover:bg-purple-100/80 dark:text-purple-400 dark:hover:text-purple-300 dark:hover:bg-purple-900/30 transition-all duration-[var(--transition-fast)] active:scale-95"
                            title="生成回复"
                        >
                            <Sparkles size={15} />
                        </button>
                    )}

                    {/* A/B 对比生成按钮 */}
                    {!isUser && hasCompareModel && (
                        <button
                            onClick={() => generateABCompare(message.id)}
                            disabled={message.isGenerating}
                            className={`p-1.5 flex items-center gap-1 rounded-[var(--radius-sm)] transition-all duration-[var(--transition-fast)] ${
                                message.isGenerating
                                    ? 'text-[var(--muted-foreground)] cursor-not-allowed opacity-40'
                                    : 'text-orange-600 hover:text-orange-700 hover:bg-orange-100/80 dark:text-orange-400 dark:hover:text-orange-300 dark:hover:bg-orange-900/30 active:scale-95'
                            }`}
                            title="A/B 对比生成"
                        >
                            <GitCompare size={15} />
                        </button>
                    )}

                    {!isUser && <div className="w-px h-4 bg-[var(--border)] mx-1" />}

                    <button
                        onClick={() => moveMessage(message.id, 'up')}
                        disabled={index === 0}
                        className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-25 disabled:cursor-not-allowed rounded-[var(--radius-sm)] hover:bg-[var(--muted)] transition-all duration-[var(--transition-fast)] active:scale-95"
                        title="上移"
                    >
                        <ChevronUp size={15} />
                    </button>

                    <button
                        onClick={() => moveMessage(message.id, 'down')}
                        disabled={index === totalCount - 1}
                        className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-25 disabled:cursor-not-allowed rounded-[var(--radius-sm)] hover:bg-[var(--muted)] transition-all duration-[var(--transition-fast)] active:scale-95"
                        title="下移"
                    >
                        <ChevronDown size={15} />
                    </button>

                    <div className="w-px h-4 bg-[var(--border)] mx-1" />

                    <div className="relative">
                        <button
                            onClick={() => setShowAddMenu(!showAddMenu)}
                            className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--primary)] rounded-[var(--radius-sm)] hover:bg-[var(--primary-light)] transition-all duration-[var(--transition-fast)] flex items-center gap-1 active:scale-95"
                            title="添加内容块"
                        >
                            <Plus size={15} />
                        </button>

                        {showAddMenu && (
                            <>
                                {/* 背景遮罩 */}
                                <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setShowAddMenu(false)}
                                />
                                <div className="absolute right-0 top-full mt-1.5 z-20 w-56 max-h-80 overflow-y-auto bg-[var(--card-bg)] border border-[var(--border)] rounded-[var(--radius-md)] shadow-lg py-1">
                                    <div className="px-3 py-1.5 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                                        添加内容块
                                    </div>
                                    <button onClick={() => handleAddBlock('text')} className="w-full text-left px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors duration-[var(--transition-fast)] flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" /> Text
                                    </button>
                                    {isUser ? (
                                        <>
                                            <button onClick={() => handleAddBlock('image')} className="w-full text-left px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors duration-[var(--transition-fast)] flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-orange-400" /> Image
                                            </button>
                                            <button onClick={() => handleAddBlock('document')} className="w-full text-left px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors duration-[var(--transition-fast)] flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" /> Document
                                            </button>
                                            <button onClick={() => handleAddBlock('search_result')} className="w-full text-left px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors duration-[var(--transition-fast)] flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" /> Search Result
                                            </button>
                                            <button onClick={() => handleAddBlock('tool_result')} className="w-full text-left px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors duration-[var(--transition-fast)] flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Tool Result
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={() => handleAddBlock('thinking')} className="w-full text-left px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors duration-[var(--transition-fast)] flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" /> Thinking
                                            </button>
                                            <button onClick={() => handleAddBlock('redacted_thinking')} className="w-full text-left px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors duration-[var(--transition-fast)] flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" /> Redacted Thinking
                                            </button>
                                            <button onClick={() => handleAddBlock('tool_use')} className="w-full text-left px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors duration-[var(--transition-fast)] flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Tool Use
                                            </button>
                                            <button onClick={() => handleAddBlock('server_tool_use')} className="w-full text-left px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors duration-[var(--transition-fast)] flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> Server Tool Use
                                            </button>
                                            <button onClick={() => handleAddBlock('web_search_tool_result')} className="w-full text-left px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors duration-[var(--transition-fast)] flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-teal-400" /> Web Search Result
                                            </button>
                                            <button onClick={() => handleAddBlock('web_fetch_tool_result')} className="w-full text-left px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors duration-[var(--transition-fast)] flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Web Fetch Result
                                            </button>
                                            <button onClick={() => handleAddBlock('code_execution_tool_result')} className="w-full text-left px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors duration-[var(--transition-fast)] flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Code Execution Result
                                            </button>
                                            <button onClick={() => handleAddBlock('container_upload')} className="w-full text-left px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors duration-[var(--transition-fast)] flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Container Upload
                                            </button>
                                        </>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="w-px h-4 bg-[var(--border)] mx-1" />

                    <button
                        onClick={handleDelete}
                        className={`p-1.5 rounded-[var(--radius-sm)] transition-all duration-[var(--transition-fast)] active:scale-95 ${
                            showConfirmDelete
                                ? 'bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:opacity-90'
                                : 'text-[var(--muted-foreground)] hover:text-[var(--destructive)] hover:bg-red-50 dark:hover:bg-red-900/20'
                        }`}
                        title={showConfirmDelete ? "点击确认删除" : "删除消息"}
                    >
                        <Trash2 size={15} />
                    </button>
                </div>
            </div>

            {/* Content Blocks */}
            <div className="p-4 flex flex-col gap-3">
                {message.content.length === 0 ? (
                    <div className="text-center py-6 text-sm text-[var(--muted-foreground)] italic">
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

export default React.memo(MessageCard);
