'use client';

import React from 'react';
import { CodeExecutionToolResultBlock } from '../../types';
import AutoResizeTextarea from '../ui/AutoResizeTextarea';

interface CodeExecutionToolResultBlockEditorProps {
    block: CodeExecutionToolResultBlock;
    onUpdate: (block: CodeExecutionToolResultBlock) => void;
}

const inputClass = "p-2 border border-[var(--input-border)] rounded-[var(--radius-sm)] text-sm bg-[var(--input-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-rose-400/20 focus:border-rose-400 transition-all duration-[var(--transition-fast)]";
const textareaClass = "w-full p-2.5 border border-[var(--input-border)] rounded-[var(--radius-sm)] text-sm font-mono bg-[var(--input-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-rose-400/20 focus:border-rose-400 transition-all duration-[var(--transition-fast)]";
const labelClass = "text-[11px] font-medium text-[var(--muted-foreground)]";

export default function CodeExecutionToolResultBlockEditor({ block, onUpdate }: CodeExecutionToolResultBlockEditorProps) {
    return (
        <div className="flex flex-col gap-3 bg-rose-50/40 dark:bg-rose-900/10 p-3 rounded-[var(--radius-md)] border border-rose-200/60 dark:border-rose-800/30">
            <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Code Execution Tool Result</span>

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
                <label className={labelClass}>Stdout</label>
                <AutoResizeTextarea
                    className={textareaClass}
                    value={block.stdout}
                    onChange={(e) => onUpdate({ ...block, stdout: e.target.value })}
                    placeholder="标准输出..."
                    minHeight={80}
                />
            </div>

            <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Stderr</label>
                <AutoResizeTextarea
                    className={textareaClass}
                    value={block.stderr}
                    onChange={(e) => onUpdate({ ...block, stderr: e.target.value })}
                    placeholder="标准错误..."
                    minHeight={80}
                />
            </div>

            <div className="flex flex-col gap-1.5 w-32">
                <label className={labelClass}>Return Code</label>
                <input
                    type="number"
                    className={inputClass}
                    value={block.return_code}
                    onChange={(e) => onUpdate({ ...block, return_code: parseInt(e.target.value, 10) || 0 })}
                    placeholder="0"
                />
            </div>
        </div>
    );
}
