'use client';

import React from 'react';
import { ServerToolUseBlock, ServerToolName } from '../../types';
import AutoResizeTextarea from '../ui/AutoResizeTextarea';

interface ServerToolUseBlockEditorProps {
    block: ServerToolUseBlock;
    onUpdate: (block: ServerToolUseBlock) => void;
}

const SERVER_TOOL_NAMES: ServerToolName[] = ['web_search', 'web_fetch', 'code_execution'];

const inputClass = "p-2 border border-[var(--input-border)] rounded-[var(--radius-sm)] text-sm bg-[var(--input-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-cyan-400/20 focus:border-cyan-400 transition-all duration-[var(--transition-fast)]";
const selectClass = "p-2 border border-[var(--input-border)] rounded-[var(--radius-sm)] text-sm bg-[var(--input-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-cyan-400/20 focus:border-cyan-400 transition-all duration-[var(--transition-fast)]";
const textareaClass = "w-full p-2.5 border border-[var(--input-border)] rounded-[var(--radius-sm)] text-sm font-mono bg-[var(--input-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-cyan-400/20 focus:border-cyan-400 transition-all duration-[var(--transition-fast)]";
const labelClass = "text-[11px] font-medium text-[var(--muted-foreground)]";

export default function ServerToolUseBlockEditor({ block, onUpdate }: ServerToolUseBlockEditorProps) {
    return (
        <div className="flex flex-col gap-3 bg-cyan-50/40 dark:bg-cyan-900/10 p-3 rounded-[var(--radius-md)] border border-cyan-200/60 dark:border-cyan-800/30">
            <span className="text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">Server Tool Use</span>

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
                    <select
                        className={selectClass}
                        value={block.name}
                        onChange={(e) => onUpdate({ ...block, name: e.target.value as ServerToolName })}
                    >
                        {SERVER_TOOL_NAMES.map((name) => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </select>
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
