'use client';

import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownPreviewProps {
    content: string;
    className?: string;
}

export default function MarkdownPreview({ content, className = '' }: MarkdownPreviewProps) {
    if (!content.trim()) {
        return (
            <div className={`markdown-preview text-[var(--muted-foreground)] italic ${className}`}>
                暂无内容
            </div>
        );
    }

    return (
        <div className={`markdown-preview ${className}`}>
            <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
        </div>
    );
}
