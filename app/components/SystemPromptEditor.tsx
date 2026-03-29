'use client';

import React, { useState } from 'react';
import { useEditor } from '../contexts/EditorContext';
import { ChevronDown, ChevronRight } from 'lucide-react';

export default function SystemPromptEditor() {
    const {
        state: { currentProject },
        updateSystemPrompt,
    } = useEditor();

    const [isExpanded, setIsExpanded] = useState(true);

    if (!currentProject) return null;

    return (
        <div className="mb-6 rounded-lg border border-yellow-200 dark:border-yellow-900/50 bg-system-bg shadow-sm overflow-hidden">
            <div
                className="flex items-center justify-between p-3 cursor-pointer bg-yellow-100/50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center space-x-2">
                    {isExpanded ? (
                        <ChevronDown size={18} className="text-yellow-700 dark:text-yellow-500" />
                    ) : (
                        <ChevronRight size={18} className="text-yellow-700 dark:text-yellow-500" />
                    )}
                    <h3 className="font-semibold text-yellow-800 dark:text-yellow-500">System Prompt</h3>
                </div>
                {!isExpanded && (
                    <div className="text-sm text-yellow-600 dark:text-yellow-600/70 truncate max-w-xl">
                        {currentProject.systemPrompt || '暂无内容'}
                    </div>
                )}
            </div>

            {isExpanded && (
                <div className="p-3 border-t border-yellow-200 dark:border-yellow-900/50">
                    <textarea
                        value={currentProject.systemPrompt}
                        onChange={(e) => updateSystemPrompt(e.target.value)}
                        placeholder="在这里输入系统提示词 (System Prompt)..."
                        className="w-full min-h-[120px] p-3 text-sm border border-yellow-300 dark:border-yellow-800 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-yellow-500 font-mono resize-y"
                    />
                </div>
            )}
        </div>
    );
}
