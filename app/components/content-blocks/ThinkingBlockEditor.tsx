'use client';

import React, { useEffect, useRef, useState } from 'react';
import { BrainCircuit, ChevronDown } from 'lucide-react';
import { ThinkingBlock } from '../../types';
import AutoResizeTextarea from '../ui/AutoResizeTextarea';

interface ThinkingBlockEditorProps {
    block: ThinkingBlock;
    onUpdate: (block: ThinkingBlock) => void;
    isGenerating?: boolean;
}

function getThinkingPreview(thinkingText: string): string {
    const normalized = thinkingText.trim();

    if (!normalized) {
        return '等待 thinking 内容';
    }

    const lines = normalized
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    const lastLine = lines.at(-1) ?? normalized;

    return lastLine.length > 72 ? `${lastLine.slice(0, 72)}...` : lastLine;
}

function ThinkingBlockEditor({ block, onUpdate, isGenerating = false }: ThinkingBlockEditorProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const previousIsGeneratingRef = useRef(isGenerating);
    const hasThinking = block.thinking.trim().length > 0;
    const thinkingPreview = getThinkingPreview(block.thinking);

    useEffect(() => {
        if (isGenerating) {
            setIsExpanded(true);
        } else if (previousIsGeneratingRef.current) {
            setIsExpanded(false);
        }

        previousIsGeneratingRef.current = isGenerating;
    }, [isGenerating]);

    return (
        <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-purple-200/60 bg-purple-50/40 p-3 dark:border-purple-800/30 dark:bg-purple-900/10">
            <button
                type="button"
                onClick={() => setIsExpanded((current) => !current)}
                className="flex w-full items-center justify-between gap-3 text-left"
            >
                <div className="min-w-0">
                    <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                        <BrainCircuit size={13} />
                        Thinking
                    </span>
                    <p className="mt-1 truncate text-xs text-[var(--muted-foreground)]">
                        {isGenerating
                            ? hasThinking
                                ? `生成中: ${thinkingPreview}`
                                : '生成中，等待 thinking 返回...'
                            : isExpanded
                              ? '点击收起 thinking'
                              : thinkingPreview}
                    </p>
                </div>
                <ChevronDown
                    size={16}
                    className={`shrink-0 text-purple-500 transition-transform duration-[var(--transition-fast)] ${isExpanded ? 'rotate-180' : ''}`}
                />
            </button>

            {isExpanded && (
                <>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-medium text-[var(--muted-foreground)]">Thinking</label>
                        <AutoResizeTextarea
                            className="w-full rounded-[var(--radius-sm)] border border-purple-200/60 bg-[var(--input-bg)] p-2.5 text-sm text-[var(--foreground)] transition-all duration-[var(--transition-fast)] focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400/20 dark:border-purple-800/40"
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
                            className="rounded-[var(--radius-sm)] border border-purple-200/60 bg-[var(--input-bg)] p-2 text-sm text-[var(--foreground)] transition-all duration-[var(--transition-fast)] focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400/20 dark:border-purple-800/40"
                            value={block.signature}
                            onChange={(e) => onUpdate({ ...block, signature: e.target.value })}
                            placeholder="签名..."
                        />
                    </div>
                </>
            )}
        </div>
    );
}

export default React.memo(ThinkingBlockEditor);
