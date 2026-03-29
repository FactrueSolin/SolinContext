'use client';

import React, { useEffect, useState } from 'react';
import { useEditor } from '../contexts/EditorContext';
import { Plus, Trash2, X } from 'lucide-react';

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

    return (
        <div className="absolute top-14 left-0 bottom-0 w-80 bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 flex flex-col shadow-lg z-10 transition-transform duration-300 transform translate-x-0">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">项目列表</h2>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => setIsCreating(true)}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors text-blue-500"
                        title="新建项目"
                    >
                        <Plus size={18} />
                    </button>
                    <button
                        onClick={toggleProjectList}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors text-gray-500"
                        title="关闭"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
                {isCreating && (
                    <form onSubmit={handleCreateProject} className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <input
                            type="text"
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            placeholder="输入项目名称..."
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                            autoFocus
                        />
                        <div className="flex justify-end space-x-2">
                            <button
                                type="button"
                                onClick={() => { setIsCreating(false); setNewProjectName(''); }}
                                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-md transition-colors"
                            >
                                取消
                            </button>
                            <button
                                type="submit"
                                disabled={!newProjectName.trim()}
                                className="px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors disabled:opacity-50"
                            >
                                创建
                            </button>
                        </div>
                    </form>
                )}

                {projects.length === 0 && !isCreating ? (
                    <div className="text-center text-gray-500 dark:text-gray-400 p-4 mt-8">
                        <p>暂无项目</p>
                        <button
                            onClick={() => setIsCreating(true)}
                            className="mt-4 text-blue-500 hover:underline"
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
                                    className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${isCurrent
                                            ? 'bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800/50'
                                            : 'hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent'
                                        }`}
                                    onClick={() => {
                                        if (!isCurrent) {
                                            loadProject(project.id);
                                        }
                                    }}
                                >
                                    <div className="flex flex-col min-w-0 flex-1 mr-2">
                                        <span className={`text-sm font-medium truncate ${isCurrent ? 'text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-gray-200'}`}>
                                            {project.name}
                                        </span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                            更新于: {new Date(project.updatedAt).toLocaleString()}
                                        </span>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteProject(project.id, project.name);
                                        }}
                                        className={`p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors opacity-0 group-hover:opacity-100 ${isCurrent ? 'opacity-100' : ''}`}
                                        title="删除项目"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
