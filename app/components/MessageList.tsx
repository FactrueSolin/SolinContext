'use client';

import React, { useRef, useEffect } from 'react';
import { useEditorState } from '../contexts/EditorContext';
import MessageCard from './MessageCard';

function MessageList() {
    const { currentProject } = useEditorState();
    const listEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new messages are added
    useEffect(() => {
        if (currentProject?.messages && currentProject.messages.length > 0) {
            // Don't auto scroll if we're just updating a block, only on new messages or generation
            // This is a simple implementation, in a real app you might want more complex scroll logic
            const timeoutId = setTimeout(() => {
                listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
            return () => clearTimeout(timeoutId);
        }
    }, [currentProject?.messages.length]); // Only trigger when count changes

    if (!currentProject) return null;

    return (
        <div className="flex flex-col gap-4 py-2">
            {currentProject.messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-[var(--muted-foreground)] bg-[var(--muted)]/50 rounded-[var(--radius-lg)] border border-dashed border-[var(--border)]">
                    <p className="mb-1 text-sm font-medium">暂无消息</p>
                    <p className="text-xs">点击下方按钮添加</p>
                </div>
            ) : (
                currentProject.messages.map((message, index) => (
                    <MessageCard
                        key={message.id}
                        message={message}
                        index={index}
                        totalCount={currentProject.messages.length}
                    />
                ))
            )}
            <div ref={listEndRef} />
        </div>
    );
}

export default React.memo(MessageList);
