'use client';

import React from 'react';
import { ToolResultBlock } from '../../types';
import AutoResizeTextarea from '../ui/AutoResizeTextarea';

interface ToolResultBlockEditorProps {
    block: ToolResultBlock;
    onUpdate: (block: ToolResultBlock) => void;
    messageId: string;
    blockIndex: number;
}

const inputClass = "p-2 border border-[var(--input-border)] rounded-[var(--radius-sm)] text-sm bg-[var(--input-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-green-400/20 focus:border-green-400 transition-all duration-[var(--transition-fast)]";
const textareaClass = "w-full p-2.5 border border-[var(--input-border)] rounded-[var(--radius-sm)] text-sm font-mono bg-[var(--input-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-green-400/20 focus:border-green-400 transition-all duration-[var(--transition-fast)]";
const labelClass = "text-[11px] font-medium text-[var(--muted-foreground)]";

export default function ToolResultBlockEditor({ block, onUpdate, messageId, blockIndex }: ToolResultBlockEditorProps) {
    return (
        <div className="flex flex-col gap-3 bg-green-50/40 dark:bg-green-900/10 p-3 rounded-[var(--radius-md)] border border-green-200/60 dark:border-green-800/30">
            <span className="text-[11px] font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider">Tool Result</span>
            <div className="flex items-center gap-3">
                <div className="flex-1 flex flex-col gap-1.5">
                    <label className={labelClass}>Tool Use ID</label>
                    <input
                        type="text"
                        className={inputClass}
                        value={block.tool_use_id}
                        onChange={(e) => onUpdate({ ...block, tool_use_id: e.target.value })}
                        placeholder="对应的工具调用ID"
                    />
                </div>
                <div className="flex items-center gap-2 mt-5">
                    <input
                        type="checkbox"
                        id={`error-${messageId}-${blockIndex}`}
                        checked={!!block.is_error}
                        onChange={(e) => onUpdate({ ...block, is_error: e.target.checked })}
                        className="rounded text-[var(--destructive)] focus:ring-[var(--destructive)]"
                    />
                    <label htmlFor={`error-${messageId}-${blockIndex}`} className="text-xs text-[var(--destructive)] font-medium">
                        Is Error
                    </label>
                </div>
            </div>
            <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Content</label>
                <AutoResizeTextarea
                    className={textareaClass}
                    value={block.content}
                    onChange={(e) => onUpdate({ ...block, content: e.target.value })}
                    placeholder="工具返回结果..."
                    minHeight={100}
                />
            </div>
        </div>
    );
}
