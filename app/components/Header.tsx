'use client';

import React, { useState } from 'react';
import { useEditor } from '../contexts/EditorContext';
import { FolderOpen, Save, Settings, Download, Upload, Code, FileJson } from 'lucide-react';
import { exportToXmlPrompt, exportToMessageJson } from '../lib/utils';

export default function Header() {
    const {
        state: { currentProject, isSaving, error },
        toggleProjectList,
        toggleApiConfig,
        saveProject,
        updateProjectName,
    } = useEditor();

    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState('');
    const [isCopied, setIsCopied] = useState(false);
    const [isJsonCopied, setIsJsonCopied] = useState(false);

    const handleEditName = () => {
        if (currentProject) {
            setEditedName(currentProject.meta.name);
            setIsEditingName(true);
        }
    };

    const handleSaveName = async () => {
        if (currentProject && editedName.trim() && editedName !== currentProject.meta.name) {
            try {
                const response = await fetch(`/api/projects/${currentProject.meta.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        ...currentProject,
                        meta: { ...currentProject.meta, name: editedName.trim() }
                    }),
                });

                if (response.ok) {
                    updateProjectName(editedName.trim());
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

    const handleExportMessageJson = async () => {
        if (!currentProject) return;
        
        try {
            const json = exportToMessageJson(currentProject.systemPrompt, currentProject.messages);
            await navigator.clipboard.writeText(json);
            setIsJsonCopied(true);
            setTimeout(() => setIsJsonCopied(false), 2000);
        } catch (err) {
            console.error('Failed to export message JSON', err);
        }
    };

    const tooltipBaseClass = "absolute -bottom-9 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-[var(--tooltip-bg)] text-[var(--tooltip-text)] text-xs rounded-md whitespace-nowrap shadow-lg pointer-events-none";

    return (
        <header className="flex items-center justify-between h-14 px-3 sm:px-4 border-b border-[var(--border)] bg-[var(--header-bg)] backdrop-blur-sm z-20">
            {/* Left: Logo & Project List Toggle */}
            <div className="flex items-center gap-2 min-w-0">
                <button
                    onClick={toggleProjectList}
                    className="p-2 hover:bg-[var(--muted)] rounded-[var(--radius-sm)] transition-colors duration-[var(--transition-fast)] active:scale-95"
                    title="项目列表"
                >
                    <FolderOpen size={20} className="text-[var(--muted-foreground)]" />
                </button>
                <h1 className="text-base font-semibold text-[var(--foreground)] hidden sm:block tracking-tight">
                    AI Context Editor
                </h1>
            </div>

            {/* Center: Project Name */}
            <div className="flex-1 flex justify-center min-w-0 px-2">
                {currentProject && (
                    <div className="flex items-center min-w-0">
                        {isEditingName ? (
                            <input
                                type="text"
                                value={editedName}
                                onChange={(e) => setEditedName(e.target.value)}
                                onBlur={handleSaveName}
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                                className="px-3 py-1 border border-[var(--primary)] rounded-[var(--radius-sm)] bg-transparent text-[var(--foreground)] text-center w-48 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 text-sm"
                                autoFocus
                            />
                        ) : (
                            <span
                                onClick={handleEditName}
                                className="cursor-pointer hover:bg-[var(--muted)] px-3 py-1.5 rounded-[var(--radius-sm)] text-[var(--foreground)] transition-colors duration-[var(--transition-fast)] text-sm font-medium truncate max-w-[200px] lg:max-w-[300px]"
                                title="点击修改项目名称"
                            >
                                {currentProject.meta.name}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-0.5 sm:gap-1">
                {error && (
                    <span className="text-[var(--destructive)] text-xs mr-2 max-w-[200px] truncate hidden sm:inline-block" title={error}>
                        {error}
                    </span>
                )}

                {isSaving && (
                    <span className="text-[var(--muted-foreground)] text-xs mr-2 animate-pulse hidden sm:inline-block">
                        保存中...
                    </span>
                )}

                <button
                    onClick={saveProject}
                    disabled={!currentProject || isSaving}
                    className="p-2 hover:bg-[var(--muted)] rounded-[var(--radius-sm)] transition-colors duration-[var(--transition-fast)] disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                    title="保存项目"
                >
                    <Save size={18} className="text-[var(--muted-foreground)]" />
                </button>

                <div className="relative">
                    <button
                        onClick={handleExportXml}
                        disabled={!currentProject}
                        className="p-2 hover:bg-[var(--muted)] rounded-[var(--radius-sm)] transition-colors duration-[var(--transition-fast)] disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                        title="导出 XML 提示词到剪贴板"
                    >
                        <Code size={18} className="text-[var(--muted-foreground)]" />
                    </button>
                    {isCopied && (
                        <div className={`${tooltipBaseClass} animate-[fadeInUp_200ms_ease-out]`}>
                            已复制!
                        </div>
                    )}
                </div>

                <div className="relative">
                    <button
                        onClick={handleExportMessageJson}
                        disabled={!currentProject}
                        className="p-2 hover:bg-[var(--muted)] rounded-[var(--radius-sm)] transition-colors duration-[var(--transition-fast)] disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                        title="导出 Messages JSON 到剪贴板"
                    >
                        <FileJson size={18} className="text-[var(--muted-foreground)]" />
                    </button>
                    {isJsonCopied && (
                        <div className={`${tooltipBaseClass} animate-[fadeInUp_200ms_ease-out]`}>
                            已复制!
                        </div>
                    )}
                </div>

                <button
                    onClick={handleExport}
                    disabled={!currentProject}
                    className="p-2 hover:bg-[var(--muted)] rounded-[var(--radius-sm)] transition-colors duration-[var(--transition-fast)] disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                    title="导出 JSON"
                >
                    <Download size={18} className="text-[var(--muted-foreground)]" />
                </button>

                <label className="p-2 hover:bg-[var(--muted)] rounded-[var(--radius-sm)] transition-colors duration-[var(--transition-fast)] cursor-pointer active:scale-95" title="导入 JSON">
                    <Upload size={18} className="text-[var(--muted-foreground)]" />
                    <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                </label>

                <div className="w-px h-5 bg-[var(--border)] mx-1 hidden sm:block" />

                <button
                    onClick={toggleApiConfig}
                    className="p-2 hover:bg-[var(--muted)] rounded-[var(--radius-sm)] transition-colors duration-[var(--transition-fast)] active:scale-95"
                    title="API 设置"
                >
                    <Settings size={18} className="text-[var(--muted-foreground)]" />
                </button>
            </div>
        </header>
    );
}
