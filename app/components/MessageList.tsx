'use client';

import React, { useRef, useEffect } from 'react';
import { useEditor } from '../contexts/EditorContext';
import MessageCard from './MessageCard';

export default function MessageList() {
    const { state: { currentProject } } = useEditor();
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
        <div className="flex flex-col gap-6 py-4">
            {currentProject.messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                    <p className="mb-2">暂无消息</p>
                    <p className="text-sm">点击下方按钮添加</p>
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
