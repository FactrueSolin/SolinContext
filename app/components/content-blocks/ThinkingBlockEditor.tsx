'use client';

import React from 'react';
import { ThinkingBlock } from '../../types';
import AutoResizeTextarea from '../ui/AutoResizeTextarea';

interface ThinkingBlockEditorProps {
    block: ThinkingBlock;
    onUpdate: (block: ThinkingBlock) => void;
}

function ThinkingBlockEditor({ block, onUpdate }: ThinkingBlockEditorProps) {
    return (
        <div className="flex flex-col gap-3 bg-purple-50/40 dark:bg-purple-900/10 p-3 rounded-[var(--radius-md)] border border-purple-200/60 dark:border-purple-800/30">
            <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Thinking</span>
            <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-[var(--muted-foreground)]">Thinking</label>
                <AutoResizeTextarea
                    className="w-full p-2.5 border border-purple-200/60 dark:border-purple-800/40 rounded-[var(--radius-sm)] text-sm bg-[var(--input-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-purple-400/20 focus:border-purple-400 transition-all duration-[var(--transition-fast)]"
                    value={block.thinking}
                    onChange={(e) => onUpdate({ ...block, thinking: e.target.value })}
                    placeholder="思维过程..."
                    minHeight={80}
                />
            </div>
            <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-[var(--muted-foreground)]">Signature</label>
                <input
                    type="text"
                    className="p-2 border border-purple-200/60 dark:border-purple-800/40 rounded-[var(--radius-sm)] text-sm bg-[var(--input-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-purple-400/20 focus:border-purple-400 transition-all duration-[var(--transition-fast)]"
                    value={block.signature}
                    onChange={(e) => onUpdate({ ...block, signature: e.target.value })}
                    placeholder="签名..."
                />
            </div>
        </div>
    );
}

export default React.memo(ThinkingBlockEditor);
