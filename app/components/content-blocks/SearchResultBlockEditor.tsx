'use client';

import React from 'react';
import { SearchResultBlock } from '../../types';
import AutoResizeTextarea from '../ui/AutoResizeTextarea';

interface SearchResultBlockEditorProps {
    block: SearchResultBlock;
    onUpdate: (block: SearchResultBlock) => void;
}

const inputClass = "p-2 border border-[var(--input-border)] rounded-[var(--radius-sm)] text-sm bg-[var(--input-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all duration-[var(--transition-fast)]";
const textareaClass = "w-full p-2.5 border border-[var(--input-border)] rounded-[var(--radius-sm)] text-sm bg-[var(--input-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 transition-all duration-[var(--transition-fast)]";
const labelClass = "text-[11px] font-medium text-[var(--muted-foreground)]";

export default function SearchResultBlockEditor({ block, onUpdate }: SearchResultBlockEditorProps) {
    return (
        <div className="flex flex-col gap-3 bg-yellow-50/40 dark:bg-yellow-900/10 p-3 rounded-[var(--radius-md)] border border-yellow-200/60 dark:border-yellow-800/30">
            <span className="text-[11px] font-semibold text-yellow-600 dark:text-yellow-400 uppercase tracking-wider">Search Result</span>

            <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                    <label className={labelClass}>Source</label>
                    <input
                        type="text"
                        className={inputClass}
                        value={block.source}
                        onChange={(e) => onUpdate({ ...block, source: e.target.value })}
                        placeholder="搜索来源"
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className={labelClass}>Title</label>
                    <input
                        type="text"
                        className={inputClass}
                        value={block.title}
                        onChange={(e) => onUpdate({ ...block, title: e.target.value })}
                        placeholder="搜索结果标题"
                    />
                </div>
            </div>

            <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Content</label>
                <AutoResizeTextarea
                    className={textareaClass}
                    value={block.content}
                    onChange={(e) => onUpdate({ ...block, content: e.target.value })}
                    placeholder="搜索结果内容..."
                    minHeight={80}
                />
            </div>
        </div>
    );
}
