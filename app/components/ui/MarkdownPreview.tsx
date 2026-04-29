'use client';

import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownPreviewProps {
    content: string;
    className?: string;
    aiMarkerStart?: string;
    aiMarkerEnd?: string;
}

interface MarkdownAstNode {
    type?: unknown;
    value?: unknown;
    children?: unknown;
    data?: unknown;
}

function isNode(value: unknown): value is MarkdownAstNode {
    return typeof value === 'object' && value !== null;
}

function splitMarkedText(value: string, markerStart: string, markerEnd: string): MarkdownAstNode[] {
    const nodes: MarkdownAstNode[] = [];
    let cursor = 0;

    while (cursor < value.length) {
        const startIndex = value.indexOf(markerStart, cursor);
        if (startIndex === -1) {
            nodes.push({ type: 'text', value: value.slice(cursor) });
            break;
        }

        if (startIndex > cursor) {
            nodes.push({ type: 'text', value: value.slice(cursor, startIndex) });
        }

        const textStart = startIndex + markerStart.length;
        const endIndex = value.indexOf(markerEnd, textStart);
        if (endIndex === -1) {
            nodes.push({ type: 'text', value: value.slice(startIndex) });
            break;
        }

        const markedText = value.slice(textStart, endIndex);
        if (markedText) {
            nodes.push({
                type: 'aigcHighlight',
                data: {
                    hName: 'mark',
                    hProperties: {
                        className: 'aigc-ai-highlight',
                    },
                },
                children: [{ type: 'text', value: markedText }],
            });
        }

        cursor = endIndex + markerEnd.length;
    }

    return nodes.filter((node) => typeof node.value !== 'string' || node.value.length > 0);
}

function transformAiMarkers(node: unknown, markerStart: string, markerEnd: string) {
    if (!isNode(node) || !Array.isArray(node.children)) {
        return;
    }

    const children = node.children.filter(isNode);
    const nextChildren: MarkdownAstNode[] = [];

    children.forEach((child) => {
        if (child.type === 'text' && typeof child.value === 'string' && child.value.includes(markerStart)) {
            nextChildren.push(...splitMarkedText(child.value, markerStart, markerEnd));
            return;
        }

        transformAiMarkers(child, markerStart, markerEnd);
        nextChildren.push(child);
    });

    node.children = nextChildren;
}

function createAiMarkerPlugin(markerStart: string, markerEnd: string) {
    return function aiMarkerPlugin() {
        return function transformer(tree: unknown) {
            transformAiMarkers(tree, markerStart, markerEnd);
        };
    };
}

export default function MarkdownPreview({
    content,
    className = '',
    aiMarkerStart,
    aiMarkerEnd,
}: MarkdownPreviewProps) {
    if (!content.trim()) {
        return (
            <div className={`markdown-preview text-[var(--muted-foreground)] italic ${className}`}>
                暂无内容
            </div>
        );
    }

    const remarkPlugins =
        aiMarkerStart && aiMarkerEnd
            ? [remarkGfm, createAiMarkerPlugin(aiMarkerStart, aiMarkerEnd)]
            : [remarkGfm];

    return (
        <div className={`markdown-preview ${className}`}>
            <Markdown remarkPlugins={remarkPlugins}>{content}</Markdown>
        </div>
    );
}
