'use client';

import React, { useState } from 'react';
import { TextBlock } from '../../types';
import { Eye, Pencil } from 'lucide-react';
import AutoResizeTextarea from '../ui/AutoResizeTextarea';
import MarkdownPreview from '../ui/MarkdownPreview';

interface TextBlockEditorProps {
    block: TextBlock;
    onUpdate: (block: TextBlock) => void;
}

export default function TextBlockEditor({ block, onUpdate }: TextBlockEditorProps) {
    const [isPreview, setIsPreview] = useState(false);

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Text</span>
                <button
                    onClick={() => setIsPreview(!isPreview)}
                    className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-[var(--radius-sm)] border border-[var(--input-border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition-colors duration-[var(--transition-fast)]"
                    title={isPreview ? '切换到编辑模式' : '切换到预览模式'}
                >
                    {isPreview ? <Pencil size={12} /> : <Eye size={12} />}
                    {isPreview ? '编辑' : '预览'}
                </button>
            </div>
            {isPreview ? (
                <div className="p-2.5 border border-[var(--input-border)] rounded-[var(--radius-sm)] bg-[var(--input-bg)] min-h-[80px]">
                    <MarkdownPreview content={block.text} />
                </div>
            ) : (
                <AutoResizeTextarea
                    className="w-full p-2.5 border border-[var(--input-border)] rounded-[var(--radius-sm)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] bg-[var(--input-bg)] text-[var(--foreground)] transition-all duration-[var(--transition-fast)]"
                    value={block.text}
                    onChange={(e) => onUpdate({ ...block, text: e.target.value })}
                    placeholder="输入文本内容..."
                    minHeight={80}
                />
            )}
        </div>
    );
}
