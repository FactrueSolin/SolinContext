'use client';

import React from 'react';
import { RedactedThinkingBlock } from '../../types';

interface RedactedThinkingBlockEditorProps {
    block: RedactedThinkingBlock;
    onUpdate: (block: RedactedThinkingBlock) => void;
}

export default function RedactedThinkingBlockEditor({ block, onUpdate }: RedactedThinkingBlockEditorProps) {
    return (
        <div className="flex flex-col gap-3 bg-gray-100/40 dark:bg-gray-800/20 p-3 rounded-[var(--radius-md)] border border-gray-200/60 dark:border-gray-700/40">
            <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Redacted Thinking</span>
            <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-[var(--muted-foreground)]">Data</label>
                <textarea
                    className="w-full p-2.5 border border-[var(--input-border)] rounded-[var(--radius-sm)] resize-y min-h-[80px] text-sm font-mono bg-[var(--input-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-gray-400/20 focus:border-gray-400 transition-all duration-[var(--transition-fast)]"
                    value={block.data}
                    onChange={(e) => onUpdate({ ...block, data: e.target.value })}
                    placeholder="已编辑的思维数据..."
                />
            </div>
        </div>
    );
}
