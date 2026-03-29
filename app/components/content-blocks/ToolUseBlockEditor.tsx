'use client';

import React from 'react';
import { ToolUseBlock } from '../../types';
import AutoResizeTextarea from '../ui/AutoResizeTextarea';

interface ToolUseBlockEditorProps {
    block: ToolUseBlock;
    onUpdate: (block: ToolUseBlock) => void;
}

const inputClass = "p-2 border border-[var(--input-border)] rounded-[var(--radius-sm)] text-sm bg-[var(--input-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400 transition-all duration-[var(--transition-fast)]";
const textareaClass = "w-full p-2.5 border border-[var(--input-border)] rounded-[var(--radius-sm)] text-sm font-mono bg-[var(--input-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400 transition-all duration-[var(--transition-fast)]";
const labelClass = "text-[11px] font-medium text-[var(--muted-foreground)]";

export default function ToolUseBlockEditor({ block, onUpdate }: ToolUseBlockEditorProps) {
    return (
        <div className="flex flex-col gap-3 bg-blue-50/40 dark:bg-blue-900/10 p-3 rounded-[var(--radius-md)] border border-blue-200/60 dark:border-blue-800/30">
            <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Tool Use</span>
            <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                    <label className={labelClass}>ID</label>
                    <input
                        type="text"
                        className={inputClass}
                        value={block.id}
                        onChange={(e) => onUpdate({ ...block, id: e.target.value })}
                        placeholder="工具调用ID"
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className={labelClass}>Name</label>
                    <input
                        type="text"
                        className={inputClass}
                        value={block.name}
                        onChange={(e) => onUpdate({ ...block, name: e.target.value })}
                        placeholder="工具名称"
                    />
                </div>
            </div>
            <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Input (JSON)</label>
                <AutoResizeTextarea
                    className={textareaClass}
                    value={JSON.stringify(block.input, null, 2)}
                    onChange={(e) => {
                        try {
                            const parsed = JSON.parse(e.target.value);
                            onUpdate({ ...block, input: parsed });
                        } catch {
                            // 忽略输入过程中的解析错误
                        }
                    }}
                    onBlur={(e) => {
                        try {
                            const parsed = JSON.parse(e.target.value);
                            onUpdate({ ...block, input: parsed });
                        } catch {
                            // 可以在此处显示错误提示
                        }
                    }}
                    placeholder="{}"
                    minHeight={100}
                />
            </div>
        </div>
    );
}
