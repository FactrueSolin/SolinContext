'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useEditorActions, useEditorState } from '../contexts/EditorContext';
import { ChevronDown, ChevronRight, Terminal, Eye, Pencil, Sparkles, BookmarkPlus, X } from 'lucide-react';
import AutoResizeTextarea from './ui/AutoResizeTextarea';
import MarkdownPreview from './ui/MarkdownPreview';
import { buildWorkspaceModulePath, getWorkspaceSlugFromWindow } from '../lib/workspace-routing';

function SystemPromptEditor() {
    const { currentProject, promptAssetNotice } = useEditorState();
    const { updateSystemPrompt, setPromptAssetNotice } = useEditorActions();
    const router = useRouter();
    const workspaceSlug = getWorkspaceSlugFromWindow();

    const [isExpanded, setIsExpanded] = useState(true);
    const [isPreview, setIsPreview] = useState(false);

    useEffect(() => {
        if (!promptAssetNotice) return;

        const timer = window.setTimeout(() => {
            setPromptAssetNotice(null);
        }, 4200);

        return () => window.clearTimeout(timer);
    }, [promptAssetNotice, setPromptAssetNotice]);

    if (!currentProject) return null;

    return (
        <div className="mb-4 rounded-[var(--radius-lg)] border border-[var(--system-border)] bg-[var(--system-bg)] shadow-sm overflow-visible" style={{ boxShadow: 'var(--card-shadow)' }}>
            {/* Header */}
            <div
                className="flex items-center justify-between px-4 py-2.5 cursor-pointer bg-[var(--system-header)]/60 hover:bg-[var(--system-header)] transition-colors duration-[var(--transition-fast)] border-b border-[var(--system-border)]"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-yellow-200/80 dark:bg-yellow-800/40">
                        <Terminal size={13} className="text-yellow-700 dark:text-yellow-300" />
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-yellow-200/60 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300">
                        system
                    </span>
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

            {/* Content - 条件渲染，不使用 CSS 动画折叠 */}
            {isExpanded && (
                <div className="p-4">
                    {promptAssetNotice && (
                        <div className="mb-3 flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-cyan-200/80 bg-cyan-50/90 px-3 py-2.5 text-sm text-cyan-800 dark:border-cyan-900/60 dark:bg-cyan-950/40 dark:text-cyan-200">
                            <div className="flex items-start gap-2">
                                <Sparkles size={15} className="mt-0.5" />
                                <div>
                                    <p className="font-medium">
                                        已应用资产「{promptAssetNotice.assetName}」{promptAssetNotice.versionLabel}
                                    </p>
                                    <p className="mt-0.5 text-xs text-cyan-700/80 dark:text-cyan-200/80">
                                        当前修改仅作用于项目，未改动资产本身。
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setPromptAssetNotice(null)}
                                className="rounded-full p-1 text-cyan-700/80 hover:bg-cyan-100 dark:text-cyan-200/80 dark:hover:bg-cyan-900/40"
                                title="关闭提示"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    )}
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={() => router.push(buildWorkspaceModulePath(workspaceSlug ?? '', 'prompt-assets'))}
                                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--asset-primary-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--asset-primary)] shadow-sm hover:bg-cyan-100 dark:hover:bg-cyan-950/80"
                            >
                                <Sparkles size={13} />
                                从资产应用
                            </button>
                            <button
                                onClick={() => router.push(buildWorkspaceModulePath(workspaceSlug ?? '', 'prompt-assets', { entry: 'save' }))}
                                disabled={!currentProject.systemPrompt.trim()}
                                className="inline-flex items-center gap-1.5 rounded-full border border-yellow-300/60 bg-white/60 px-3 py-1.5 text-xs font-semibold text-yellow-800 shadow-sm hover:bg-yellow-100/80 disabled:cursor-not-allowed disabled:opacity-45 dark:border-yellow-800/50 dark:bg-yellow-950/20 dark:text-yellow-300 dark:hover:bg-yellow-900/30"
                                title={currentProject.systemPrompt.trim() ? '保存为资产' : '当前 System Prompt 为空，无法保存为资产'}
                            >
                                <BookmarkPlus size={13} />
                                保存为资产
                            </button>
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsPreview(!isPreview); }}
                            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-[var(--radius-sm)] border border-yellow-300/60 dark:border-yellow-800/50 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-100/50 dark:hover:bg-yellow-900/30 transition-colors duration-[var(--transition-fast)]"
                            title={isPreview ? '切换到编辑模式' : '切换到预览模式'}
                        >
                            {isPreview ? <Pencil size={13} /> : <Eye size={13} />}
                            {isPreview ? '编辑' : '预览'}
                        </button>
                    </div>
                    {isPreview ? (
                        <div className="p-3 border border-yellow-300/60 dark:border-yellow-800/50 rounded-[var(--radius-md)] bg-[var(--input-bg)] min-h-[120px]">
                            <MarkdownPreview content={currentProject.systemPrompt} />
                        </div>
                    ) : (
                        <AutoResizeTextarea
                            value={currentProject.systemPrompt}
                            onChange={(e) => updateSystemPrompt(e.target.value)}
                            placeholder="在这里输入系统提示词 (System Prompt)..."
                            minHeight={120}
                            className="w-full p-3 text-sm border border-yellow-300/60 dark:border-yellow-800/50 rounded-[var(--radius-md)] bg-[var(--input-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-yellow-500/30 focus:border-yellow-500 font-mono transition-all duration-[var(--transition-fast)]"
                        />
                    )}
                </div>
            )}
        </div>
    );
}

export default React.memo(SystemPromptEditor);
