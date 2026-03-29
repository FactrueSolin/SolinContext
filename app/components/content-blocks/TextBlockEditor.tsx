'use client';

import React from 'react';
import { TextBlock } from '../../types';

interface TextBlockEditorProps {
    block: TextBlock;
    onUpdate: (block: TextBlock) => void;
}

export default function TextBlockEditor({ block, onUpdate }: TextBlockEditorProps) {
    return (
        <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Text</span>
            <textarea
                className="w-full p-2.5 border border-[var(--input-border)] rounded-[var(--radius-sm)] resize-y min-h-[80px] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] bg-[var(--input-bg)] text-[var(--foreground)] transition-all duration-[var(--transition-fast)]"
                value={block.text}
                onChange={(e) => onUpdate({ ...block, text: e.target.value })}
                placeholder="输入文本内容..."
            />
        </div>
    );
}
