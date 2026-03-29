'use client';

import React from 'react';
import { WebFetchToolResultBlock } from '../../types';

interface WebFetchToolResultBlockEditorProps {
    block: WebFetchToolResultBlock;
    onUpdate: (block: WebFetchToolResultBlock) => void;
}

const inputClass = "p-2 border border-[var(--input-border)] rounded-[var(--radius-sm)] text-sm bg-[var(--input-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-400 transition-all duration-[var(--transition-fast)]";
const textareaClass = "w-full p-2.5 border border-[var(--input-border)] rounded-[var(--radius-sm)] resize-y min-h-[100px] text-sm font-mono bg-[var(--input-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-400 transition-all duration-[var(--transition-fast)]";
const labelClass = "text-[11px] font-medium text-[var(--muted-foreground)]";

export default function WebFetchToolResultBlockEditor({ block, onUpdate }: WebFetchToolResultBlockEditorProps) {
    return (
        <div className="flex flex-col gap-3 bg-emerald-50/40 dark:bg-emerald-900/10 p-3 rounded-[var(--radius-md)] border border-emerald-200/60 dark:border-emerald-800/30">
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Web Fetch Tool Result</span>

            <div className="grid grid-cols-2 gap-3">
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
                <div className="flex flex-col gap-1.5">
                    <label className={labelClass}>URL</label>
                    <input
                        type="text"
                        className={inputClass}
                        value={block.url}
                        onChange={(e) => onUpdate({ ...block, url: e.target.value })}
                        placeholder="https://example.com"
                    />
                </div>
            </div>

            <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Content</label>
                <textarea
                    className={textareaClass}
                    value={block.content}
                    onChange={(e) => onUpdate({ ...block, content: e.target.value })}
                    placeholder="抓取到的网页内容..."
                />
            </div>
        </div>
    );
}
