'use client';

import React from 'react';
import { Plus, X } from 'lucide-react';
import { WebSearchToolResultBlock, WebSearchResultItem } from '../../types';

interface WebSearchToolResultBlockEditorProps {
    block: WebSearchToolResultBlock;
    onUpdate: (block: WebSearchToolResultBlock) => void;
}

function createEmptySearchResultItem(): WebSearchResultItem {
    return { url: '', title: '', snippet: '' };
}

const inputClass = "p-2 border border-[var(--input-border)] rounded-[var(--radius-sm)] text-sm bg-[var(--input-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-teal-400/20 focus:border-teal-400 transition-all duration-[var(--transition-fast)]";
const textareaClass = "w-full p-2 border border-[var(--input-border)] rounded-[var(--radius-sm)] resize-y min-h-[50px] text-sm bg-[var(--input-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-teal-400/20 focus:border-teal-400 transition-all duration-[var(--transition-fast)]";
const labelClass = "text-[11px] font-medium text-[var(--muted-foreground)]";

export default function WebSearchToolResultBlockEditor({ block, onUpdate }: WebSearchToolResultBlockEditorProps) {
    const handleAddItem = () => {
        onUpdate({
            ...block,
            content: [...block.content, createEmptySearchResultItem()],
        });
    };

    const handleRemoveItem = (index: number) => {
        const newContent = block.content.filter((_, i) => i !== index);
        onUpdate({ ...block, content: newContent });
    };

    const handleItemUpdate = (index: number, field: keyof WebSearchResultItem, value: string) => {
        const newContent = block.content.map((item, i) =>
            i === index ? { ...item, [field]: value } : item
        );
        onUpdate({ ...block, content: newContent });
    };

    return (
        <div className="flex flex-col gap-3 bg-teal-50/40 dark:bg-teal-900/10 p-3 rounded-[var(--radius-md)] border border-teal-200/60 dark:border-teal-800/30">
            <span className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider">Web Search Tool Result</span>

            <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Tool Use ID</label>
                <input
                    type="text"
                    className={inputClass}
                    value={block.tool_use_id}
                    onChange={(e) => onUpdate({ ...block, tool_use_id: e.target.value })}
                    placeholder="对应的工具调用ID"
                />
            </div>

            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <label className={labelClass}>Search Results ({block.content.length})</label>
                    <button
                        onClick={handleAddItem}
                        className="flex items-center gap-1 text-xs text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 transition-colors duration-[var(--transition-fast)] font-medium"
                    >
                        <Plus size={14} />
                        添加结果
                    </button>
                </div>

                {block.content.length === 0 && (
                    <div className="text-xs text-[var(--muted-foreground)] italic p-3 text-center">暂无搜索结果，点击上方按钮添加</div>
                )}

                {block.content.map((item, index) => (
                    <div key={index} className="flex flex-col gap-2 p-3 bg-[var(--card-bg)] rounded-[var(--radius-sm)] border border-[var(--border)]">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-medium text-[var(--muted-foreground)]">#{index + 1}</span>
                            <button
                                onClick={() => handleRemoveItem(index)}
                                className="p-1 text-[var(--muted-foreground)] hover:text-[var(--destructive)] transition-colors duration-[var(--transition-fast)]"
                                title="删除此项"
                            >
                                <X size={14} />
                            </button>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className={labelClass}>URL</label>
                            <input
                                type="text"
                                className={inputClass}
                                value={item.url}
                                onChange={(e) => handleItemUpdate(index, 'url', e.target.value)}
                                placeholder="https://example.com"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className={labelClass}>Title</label>
                            <input
                                type="text"
                                className={inputClass}
                                value={item.title}
                                onChange={(e) => handleItemUpdate(index, 'title', e.target.value)}
                                placeholder="搜索结果标题"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className={labelClass}>Snippet</label>
                            <textarea
                                className={textareaClass}
                                value={item.snippet}
                                onChange={(e) => handleItemUpdate(index, 'snippet', e.target.value)}
                                placeholder="搜索结果摘要..."
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
