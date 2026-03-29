'use client';

import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useEditor } from '../../contexts/EditorContext';
import { ContentBlock } from '../../types';

import TextBlockEditor from './TextBlockEditor';
import ThinkingBlockEditor from './ThinkingBlockEditor';
import ToolUseBlockEditor from './ToolUseBlockEditor';
import ToolResultBlockEditor from './ToolResultBlockEditor';
import ImageBlockEditor from './ImageBlockEditor';
import DocumentBlockEditor from './DocumentBlockEditor';
import SearchResultBlockEditor from './SearchResultBlockEditor';
import RedactedThinkingBlockEditor from './RedactedThinkingBlockEditor';
import ServerToolUseBlockEditor from './ServerToolUseBlockEditor';
import WebSearchToolResultBlockEditor from './WebSearchToolResultBlockEditor';
import WebFetchToolResultBlockEditor from './WebFetchToolResultBlockEditor';
import CodeExecutionToolResultBlockEditor from './CodeExecutionToolResultBlockEditor';
import ContainerUploadBlockEditor from './ContainerUploadBlockEditor';

interface ContentBlockEditorProps {
    block: ContentBlock;
    messageId: string;
    blockIndex: number;
    totalBlocks: number;
}

export default function ContentBlockEditor({
    block,
    messageId,
    blockIndex,
}: ContentBlockEditorProps) {
    const { updateContentBlock, deleteContentBlock } = useEditor();
    const [isHovered, setIsHovered] = useState(false);

    const handleUpdate = (updatedBlock: ContentBlock) => {
        updateContentBlock(messageId, blockIndex, updatedBlock);
    };

    const renderEditor = () => {
        switch (block.type) {
            case 'text':
                return (
                    <TextBlockEditor
                        block={block}
                        onUpdate={handleUpdate}
                    />
                );
            case 'thinking':
                return (
                    <ThinkingBlockEditor
                        block={block}
                        onUpdate={handleUpdate}
                    />
                );
            case 'tool_use':
                return (
                    <ToolUseBlockEditor
                        block={block}
                        onUpdate={handleUpdate}
                    />
                );
            case 'tool_result':
                return (
                    <ToolResultBlockEditor
                        block={block}
                        onUpdate={handleUpdate}
                        messageId={messageId}
                        blockIndex={blockIndex}
                    />
                );
            case 'image':
                return (
                    <ImageBlockEditor
                        block={block}
                        onUpdate={handleUpdate}
                    />
                );
            case 'document':
                return (
                    <DocumentBlockEditor
                        block={block}
                        onUpdate={handleUpdate}
                    />
                );
            case 'search_result':
                return (
                    <SearchResultBlockEditor
                        block={block}
                        onUpdate={handleUpdate}
                    />
                );
            case 'redacted_thinking':
                return (
                    <RedactedThinkingBlockEditor
                        block={block}
                        onUpdate={handleUpdate}
                    />
                );
            case 'server_tool_use':
                return (
                    <ServerToolUseBlockEditor
                        block={block}
                        onUpdate={handleUpdate}
                    />
                );
            case 'web_search_tool_result':
                return (
                    <WebSearchToolResultBlockEditor
                        block={block}
                        onUpdate={handleUpdate}
                    />
                );
            case 'web_fetch_tool_result':
                return (
                    <WebFetchToolResultBlockEditor
                        block={block}
                        onUpdate={handleUpdate}
                    />
                );
            case 'code_execution_tool_result':
                return (
                    <CodeExecutionToolResultBlockEditor
                        block={block}
                        onUpdate={handleUpdate}
                    />
                );
            case 'container_upload':
                return (
                    <ContainerUploadBlockEditor
                        block={block}
                        onUpdate={handleUpdate}
                    />
                );
            default: {
                // 确保所有块类型都已处理
                const _exhaustive: never = block;
                return <div>Unknown block type: {_exhaustive}</div>;
            }
        }
    };

    return (
        <div
            className="relative group rounded-[var(--radius-md)] p-2 transition-all duration-[var(--transition-fast)] border border-transparent hover:border-[var(--border)] hover:bg-[var(--card-bg)]/50"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                    {renderEditor()}
                </div>

                <div className={`flex flex-col gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-[var(--transition-fast)] shrink-0`}>
                    <button
                        onClick={() => deleteContentBlock(messageId, blockIndex)}
                        className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--destructive)] hover:bg-red-50 dark:hover:bg-red-900/20 rounded-[var(--radius-sm)] transition-all duration-[var(--transition-fast)] active:scale-95"
                        title="删除块"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}
