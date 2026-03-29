'use client';

import React, { useState } from 'react';
import { useEditor } from '../contexts/EditorContext';
import { X, Eye, EyeOff } from 'lucide-react';

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

        if (name === 'maxTokens') {
            const parsedValue = value === '' ? undefined : Number(value);
            updateApiConfig({
                maxTokens: parsedValue
            });
            return;
        }

        updateApiConfig({
            [name]: type === 'number' ? Number(value) : value,
        });
    };

    return (
        <div className="absolute top-14 right-0 bottom-0 w-80 bg-white dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800 flex flex-col shadow-lg z-10 transition-transform duration-300 transform translate-x-0">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">API 配置</h2>
                <button
                    onClick={toggleApiConfig}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors text-gray-500"
                    title="关闭"
                >
                    <X size={18} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Base URL
                    </label>
                    <input
                        type="text"
                        name="baseUrl"
                        value={apiConfig.baseUrl}
                        onChange={handleChange}
                        placeholder="https://api.openai.com/v1"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        API Key
                    </label>
                    <div className="relative">
                        <input
                            type={showApiKey ? 'text' : 'password'}
                            name="apiKey"
                            value={apiConfig.apiKey}
                            onChange={handleChange}
                            placeholder="sk-..."
                            className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                            {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Model
                    </label>
                    <input
                        type="text"
                        name="model"
                        value={apiConfig.model}
                        onChange={handleChange}
                        placeholder="gpt-4o"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Max Tokens
                    </label>
                    <input
                        type="number"
                        name="maxTokens"
                        value={apiConfig.maxTokens ?? ''}
                        onChange={handleChange}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>
        </div>
    );
}
