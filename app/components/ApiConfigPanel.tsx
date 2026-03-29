'use client';

import React, { useState } from 'react';
import { useEditor } from '../contexts/EditorContext';
import { X, Eye, EyeOff, Settings } from 'lucide-react';

export default function ApiConfigPanel() {
    const {
        state: { currentProject, showApiConfig },
        toggleApiConfig,
        updateApiConfig,
    } = useEditor();

    const [showApiKey, setShowApiKey] = useState(false);

    if (!showApiConfig || !currentProject) return null;

    const { apiConfig } = currentProject;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;

        updateApiConfig({
            [name]: type === 'number' ? Number(value) : value,
        });
    };

    const inputClass = "w-full px-3 py-2 text-sm border border-[var(--input-border)] rounded-[var(--radius-sm)] bg-[var(--input-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all duration-[var(--transition-fast)]";
    const labelClass = "block text-xs font-medium text-[var(--muted-foreground)] mb-1.5";

    return (
        <div className="absolute top-14 right-0 bottom-0 w-80 bg-[var(--panel-bg)] border-l border-[var(--border)] flex flex-col shadow-xl z-10 animate-[slideInRight_200ms_ease-out]">
            {/* Panel Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                    <Settings size={16} className="text-[var(--muted-foreground)]" />
                    <h2 className="text-sm font-semibold text-[var(--foreground)]">API 配置</h2>
                </div>
                <button
                    onClick={toggleApiConfig}
                    className="p-1.5 hover:bg-[var(--muted)] rounded-[var(--radius-sm)] transition-colors duration-[var(--transition-fast)] text-[var(--muted-foreground)] active:scale-95"
                    title="关闭"
                >
                    <X size={16} />
                </button>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
                <div>
                    <label className={labelClass}>
                        Base URL
                    </label>
                    <input
                        type="text"
                        name="baseUrl"
                        value={apiConfig.baseUrl}
                        onChange={handleChange}
                        placeholder="https://api.openai.com/v1"
                        className={inputClass}
                    />
                </div>

                <div>
                    <label className={labelClass}>
                        API Key
                    </label>
                    <div className="relative">
                        <input
                            type={showApiKey ? 'text' : 'password'}
                            name="apiKey"
                            value={apiConfig.apiKey}
                            onChange={handleChange}
                            placeholder="sk-..."
                            className={`${inputClass} pr-10`}
                        />
                        <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                        >
                            {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                </div>

                <div>
                    <label className={labelClass}>
                        Model
                    </label>
                    <input
                        type="text"
                        name="model"
                        value={apiConfig.model}
                        onChange={handleChange}
                        placeholder="gpt-4o"
                        className={inputClass}
                    />
                </div>
            </div>
        </div>
    );
}
