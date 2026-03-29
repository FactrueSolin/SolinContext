'use client';

import React, { useState, useEffect } from 'react';
import { useEditor } from '../contexts/EditorContext';
import { FolderOpen, Save, Settings, Download, Upload, Code } from 'lucide-react';
import { exportToXmlPrompt } from '../lib/utils';

export default function Header() {
    const {
        state: { currentProject, isSaving, error },
        toggleProjectList,
        toggleApiConfig,
        saveProject,
        loadProject,
    } = useEditor();

    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState('');
    const [isCopied, setIsCopied] = useState(false);

    const handleEditName = () => {
        if (currentProject) {
            setEditedName(currentProject.meta.name);
            setIsEditingName(true);
        }
    };

    const handleSaveName = async () => {
        if (currentProject && editedName.trim() && editedName !== currentProject.meta.name) {
            // Create a shallow copy and update name
            const updatedProject = {
                ...currentProject,
                meta: { ...currentProject.meta, name: editedName.trim() }
            };

            try {
                const response = await fetch(`/api/projects/${currentProject.meta.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(updatedProject),
                });

                if (response.ok) {
                    await loadProject(currentProject.meta.id);
                } else {
                    console.error('Failed to update name');
                }
            } catch (err) {
                console.error('Failed to save project name', err);
            }
        }
        setIsEditingName(false);
    };

    const handleExport = () => {
        if (!currentProject) return;
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentProject, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `${currentProject.meta.name}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const content = e.target?.result as string;
                const projectData = JSON.parse(content);
                // Assuming we have a way to save this new project data or override current
                // Since createProject only takes a name, we might need a workaround or API update
                // For now, we'll try to set it to current and save if id exists, or alert
                alert('导入功能正在完善中');
            } catch (err) {
                console.error('Failed to import project', err);
                alert('导入失败，文件格式不正确');
            }
        };
        reader.readAsText(file);
        // Reset input
        event.target.value = '';
    };

    const handleExportXml = async () => {
        if (!currentProject) return;
        
        try {
            const xml = exportToXmlPrompt(currentProject.systemPrompt, currentProject.messages);
            await navigator.clipboard.writeText(xml);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            console.error('Failed to export XML prompt', err);
        }
    };


    return (
        <header className="flex items-center justify-between h-14 px-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
            <div className="flex items-center space-x-4">
                <button
                    onClick={toggleProjectList}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                    title="项目列表"
                >
                    <FolderOpen size={20} className="text-gray-600 dark:text-gray-400" />
                </button>
                <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-200 hidden sm:block">AI Context Editor</h1>
            </div>

            <div className="flex-1 flex justify-center">
                {currentProject && (
                    <div className="flex items-center">
                        {isEditingName ? (
                            <input
                                type="text"
                                value={editedName}
                                onChange={(e) => setEditedName(e.target.value)}
                                onBlur={handleSaveName}
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                                className="px-2 py-1 border border-blue-500 rounded bg-transparent text-gray-800 dark:text-gray-200 text-center w-48 focus:outline-none"
                                autoFocus
                            />
                        ) : (
                            <span
                                onClick={handleEditName}
                                className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 px-2 py-1 rounded text-gray-800 dark:text-gray-200 transition-colors"
                                title="点击修改项目名称"
                            >
                                {currentProject.meta.name}
                            </span>
                        )}
                    </div>
                )}
            </div>

            <div className="flex items-center space-x-2">
                {error && (
                    <span className="text-red-500 text-sm mr-2 max-w-[200px] truncate" title={error}>
                        {error}
                    </span>
                )}

                {isSaving && (
                    <span className="text-gray-500 text-sm mr-2 animate-pulse">
                        保存中...
                    </span>
                )}

                <button
                    onClick={saveProject}
                    disabled={!currentProject || isSaving}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors disabled:opacity-50"
                    title="保存项目"
                >
                    <Save size={20} className="text-gray-600 dark:text-gray-400" />
                </button>

                <div className="relative">
                    <button
                        onClick={handleExportXml}
                        disabled={!currentProject}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors disabled:opacity-50"
                        title="导出 XML 提示词到剪贴板"
                    >
                        <Code size={20} className="text-gray-600 dark:text-gray-400" />
                    </button>
                    {isCopied && (
                        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap shadow-lg">
                            已复制!
                        </div>
                    )}
                </div>

                <button
                    onClick={handleExport}
                    disabled={!currentProject}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors disabled:opacity-50"
                    title="导出 JSON"
                >
                    <Download size={20} className="text-gray-600 dark:text-gray-400" />
                </button>

                <label className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors cursor-pointer" title="导入 JSON">
                    <Upload size={20} className="text-gray-600 dark:text-gray-400" />
                    <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                </label>

                <button
                    onClick={toggleApiConfig}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                    title="API 设置"
                >
                    <Settings size={20} className="text-gray-600 dark:text-gray-400" />
                </button>
            </div>
        </header>
    );
}
