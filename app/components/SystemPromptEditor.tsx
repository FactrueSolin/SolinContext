'use client';

import React, { useState } from 'react';
import { useEditor } from '../contexts/EditorContext';
import { ChevronDown, ChevronRight, Terminal } from 'lucide-react';

export default function SystemPromptEditor() {
    const {
        state: { currentProject },
        updateSystemPrompt,
    } = useEditor();

    const [isExpanded, setIsExpanded] = useState(true);

    if (!currentProject) return null;

    return (
        <div className="mb-6 rounded-[var(--radius-lg)] border border-[var(--system-border)] bg-[var(--system-bg)] shadow-sm overflow-hidden">
            <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer bg-[var(--system-header)]/50 hover:bg-[var(--system-header)] transition-colors duration-[var(--transition-fast)]"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-yellow-200/60 dark:bg-yellow-800/30">
                        <Terminal size={13} className="text-yellow-700 dark:text-yellow-400" />
                    </div>
                    <h3 className="font-semibold text-sm text-yellow-800 dark:text-yellow-400">System Prompt</h3>
                    {isExpanded ? (
                        <ChevronDown size={16} className="text-yellow-600 dark:text-yellow-500" />
                    ) : (
                        <ChevronRight size={16} className="text-yellow-600 dark:text-yellow-500" />
                    )}
                </div>
                {!isExpanded && (
                    <div className="text-sm text-yellow-700/70 dark:text-yellow-500/60 truncate max-w-xl ml-4">
                        {currentProject.systemPrompt || '暂无内容'}
                    </div>
                )}
            </div>

            <div
                className={`overflow-hidden transition-all duration-[var(--transition-slow)] ${
                    isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
                }`}
            >
                <div className="p-4 border-t border-[var(--system-border)]">
                    <textarea
                        value={currentProject.systemPrompt}
                        onChange={(e) => updateSystemPrompt(e.target.value)}
                        placeholder="在这里输入系统提示词 (System Prompt)..."
                        className="w-full min-h-[120px] p-3 text-sm border border-yellow-300/60 dark:border-yellow-800/50 rounded-[var(--radius-md)] bg-[var(--input-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-yellow-500/30 focus:border-yellow-500 font-mono resize-y transition-all duration-[var(--transition-fast)]"
                    />
                </div>
            </div>
        </div>
    );
}
