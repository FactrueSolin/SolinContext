'use client';

import React, { useEffect, useState } from 'react';
import { useEditor } from '../contexts/EditorContext';
import { Plus, Trash2, X, FolderOpen, Copy } from 'lucide-react';

export default function ProjectListPanel() {
    const {
        state: { projects, currentProject, showProjectList },
        toggleProjectList,
        loadProjects,
        loadProject,
        createProject,
        deleteProject,
    } = useEditor();

    const [isCreating, setIsCreating] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');

    useEffect(() => {
        if (showProjectList) {
            loadProjects();
        }
    }, [showProjectList, loadProjects]);

    if (!showProjectList) return null;

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newProjectName.trim()) {
            await createProject(newProjectName.trim());
            setNewProjectName('');
            setIsCreating(false);
        }
    };

    const handleDeleteProject = async (id: string, name: string) => {
        if (confirm(`确定要删除项目 "${name}" 吗？此操作不可撤销。`)) {
            await deleteProject(id);
        }
    };

    const handleDuplicateProject = async (id: string) => {
        try {
            const res = await fetch(`/api/projects/${id}/duplicate`, { method: 'POST' });
            if (!res.ok) {
                const data = await res.json() as { error: string };
                alert(data.error || '复制项目失败');
                return;
            }
            await loadProjects();
        } catch {
            alert('复制项目失败');
        }
    };

    return (
        <div className="absolute top-14 left-0 bottom-0 w-80 bg-[var(--panel-bg)] border-r border-[var(--border)] flex flex-col shadow-xl z-10 animate-[slideInLeft_200ms_ease-out]">
            {/* Panel Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                    <FolderOpen size={16} className="text-[var(--muted-foreground)]" />
                    <h2 className="text-sm font-semibold text-[var(--foreground)]">项目列表</h2>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setIsCreating(true)}
                        className="p-1.5 hover:bg-[var(--muted)] rounded-[var(--radius-sm)] transition-colors duration-[var(--transition-fast)] text-[var(--primary)] active:scale-95"
                        title="新建项目"
                    >
                        <Plus size={16} />
                    </button>
                    <button
                        onClick={toggleProjectList}
                        className="p-1.5 hover:bg-[var(--muted)] rounded-[var(--radius-sm)] transition-colors duration-[var(--transition-fast)] text-[var(--muted-foreground)] active:scale-95"
                        title="关闭"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto p-3">
                {isCreating && (
                    <form onSubmit={handleCreateProject} className="mb-3 p-3 bg-[var(--primary-light)] dark:bg-blue-900/20 rounded-[var(--radius-md)] border border-blue-200/60 dark:border-blue-800/40">
                        <input
                            type="text"
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            placeholder="输入项目名称..."
                            className="w-full px-3 py-2 text-sm border border-[var(--input-border)] rounded-[var(--radius-sm)] bg-[var(--input-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] mb-2.5"
                            autoFocus
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => { setIsCreating(false); setNewProjectName(''); }}
                                className="px-3 py-1.5 text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)] rounded-[var(--radius-sm)] transition-colors duration-[var(--transition-fast)]"
                            >
                                取消
                            </button>
                            <button
                                type="submit"
                                disabled={!newProjectName.trim()}
                                className="px-3 py-1.5 text-sm bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-foreground)] rounded-[var(--radius-sm)] transition-colors duration-[var(--transition-fast)] disabled:opacity-40 active:scale-95"
                            >
                                创建
                            </button>
                        </div>
                    </form>
                )}

                {projects.length === 0 && !isCreating ? (
                    <div className="text-center text-[var(--muted-foreground)] p-6 mt-8">
                        <FolderOpen size={32} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm mb-3">暂无项目</p>
                        <button
                            onClick={() => setIsCreating(true)}
                            className="text-sm text-[var(--primary)] hover:underline"
                        >
                            创建一个新项目
                        </button>
                    </div>
                ) : (
                    <ul className="space-y-1">
                        {projects.map((project) => {
                            const isCurrent = currentProject?.meta.id === project.id;
                            return (
                                <li
                                    key={project.id}
                                    className={`group flex items-center justify-between p-3 rounded-[var(--radius-md)] cursor-pointer transition-all duration-[var(--transition-fast)] ${
                                        isCurrent
                                            ? 'bg-[var(--primary-light)] dark:bg-blue-900/30 border border-[var(--user-border)]'
                                            : 'hover:bg-[var(--muted)] border border-transparent'
                                    }`}
                                    onClick={() => {
                                        if (!isCurrent) {
                                            loadProject(project.id);
                                        }
                                    }}
                                >
                                    <div className="flex flex-col min-w-0 flex-1 mr-2">
                                        <span className={`text-sm font-medium truncate ${isCurrent ? 'text-[var(--primary)]' : 'text-[var(--foreground)]'}`}>
                                            {project.name}
                                        </span>
                                        <span className="text-[11px] text-[var(--muted-foreground)] truncate mt-0.5">
                                            更新于: {new Date(project.updatedAt).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-0.5">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDuplicateProject(project.id);
                                            }}
                                            className={`p-1.5 text-[var(--muted-foreground)] hover:text-[var(--primary)] rounded-[var(--radius-sm)] hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-[var(--transition-fast)] opacity-0 group-hover:opacity-100 ${isCurrent ? 'opacity-100' : ''}`}
                                            title="复制项目"
                                        >
                                            <Copy size={14} />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteProject(project.id, project.name);
                                            }}
                                            className={`p-1.5 text-[var(--muted-foreground)] hover:text-[var(--destructive)] rounded-[var(--radius-sm)] hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-[var(--transition-fast)] opacity-0 group-hover:opacity-100 ${isCurrent ? 'opacity-100' : ''}`}
                                            title="删除项目"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
