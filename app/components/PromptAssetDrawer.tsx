'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
    Archive,
    ArrowLeft,
    Check,
    Clock3,
    History,
    Pencil,
    Plus,
    Search,
    Sparkles,
    X,
} from 'lucide-react';
import { useEditor } from '../contexts/EditorContext';
import AutoResizeTextarea from './ui/AutoResizeTextarea';
import type {
    PromptAsset,
    PromptAssetStatus,
    PromptAssetVersion,
} from '../types';

const STORAGE_KEY = 'aicontext_prompt_assets_v1';

type DrawerView = 'list' | 'detail' | 'edit' | 'history';
type AssetFilter = 'all' | PromptAssetStatus;

interface ToastState {
    tone: 'success' | 'info';
    message: string;
}

interface AssetDraft {
    name: string;
    description: string;
    content: string;
    note: string;
}

const seedAssets: PromptAsset[] = [
    {
        id: 'asset-code-review',
        name: '代码评审提示词',
        description: '用于通用代码 review，强调缺陷优先、证据充分、回归风险可判读。',
        status: 'active',
        updatedAt: '2026-04-18T20:30:00.000Z',
        versions: [
            {
                id: 'asset-code-review-v6',
                version: 6,
                nameSnapshot: '代码评审提示词',
                descriptionSnapshot: '用于通用代码 review，强调缺陷优先、证据充分、回归风险可判读。',
                note: '补齐 severity 排序和 open questions 模板。',
                createdAt: '2026-04-18T20:30:00.000Z',
                content: `你是一名严格的代码评审者。\n\n输出要求：\n1. 先给出 Findings，按严重级别排序。\n2. 每个问题都要指出风险、触发条件、建议修复方向。\n3. 如果没有明显缺陷，明确写出 "No findings"。\n4. 不做泛泛总结，避免没有证据的判断。`,
            },
            {
                id: 'asset-code-review-v5',
                version: 5,
                nameSnapshot: '代码评审提示词',
                descriptionSnapshot: '用于通用代码 review，强调缺陷优先、证据充分、回归风险可判读。',
                note: '新增 “无问题时也要说明残余风险” 的要求。',
                createdAt: '2026-04-12T09:10:00.000Z',
                content: `你是一名代码评审者。\n请先列出 Findings，再补充整体建议。\n聚焦 bug、回归、缺失测试与边界条件。`,
            },
        ],
    },
    {
        id: 'asset-customer-support',
        name: '电商客服系统 Prompt',
        description: '处理售前和售后问答，统一语气，优先给明确下一步。',
        status: 'active',
        updatedAt: '2026-04-17T08:15:00.000Z',
        versions: [
            {
                id: 'asset-customer-support-v3',
                version: 3,
                nameSnapshot: '电商客服系统 Prompt',
                descriptionSnapshot: '处理售前和售后问答，统一语气，优先给明确下一步。',
                note: '补充退款与缺货场景。',
                createdAt: '2026-04-17T08:15:00.000Z',
                content: `你是一名电商客服助手。\n\n风格：清晰、友好、不要空话。\n规则：\n- 优先回答用户当前问题。\n- 涉及订单时先确认订单号。\n- 无法直接处理时给明确升级路径。`,
            },
        ],
    },
    {
        id: 'asset-product-prd',
        name: 'PRD 结构化生成',
        description: '把模糊想法整理成可执行的 PRD 草案，适合产品探索和方案对齐。',
        status: 'active',
        updatedAt: '2026-04-15T13:50:00.000Z',
        versions: [
            {
                id: 'asset-product-prd-v4',
                version: 4,
                nameSnapshot: 'PRD 结构化生成',
                descriptionSnapshot: '把模糊想法整理成可执行的 PRD 草案，适合产品探索和方案对齐。',
                note: '增加验收标准和不做事项。',
                createdAt: '2026-04-15T13:50:00.000Z',
                content: `你是一名资深产品经理。\n请把输入整理为 PRD 草案，并按以下结构输出：\n- 目标与问题\n- 用户场景\n- 核心流程\n- 约束与边界\n- 验收标准\n- 非目标`,
            },
            {
                id: 'asset-product-prd-v3',
                version: 3,
                nameSnapshot: 'PRD 结构化生成',
                descriptionSnapshot: '把模糊想法整理成可执行的 PRD 草案，适合产品探索和方案对齐。',
                note: '初版结构化模板。',
                createdAt: '2026-04-09T11:20:00.000Z',
                content: `你是一名产品经理。\n把零散想法整理成结构化需求文档。`,
            },
        ],
    },
    {
        id: 'asset-legacy-agent',
        name: '旧版 Agent 指令集',
        description: '供历史项目兼容，默认归档，不建议用于新项目。',
        status: 'archived',
        updatedAt: '2026-04-10T06:00:00.000Z',
        versions: [
            {
                id: 'asset-legacy-agent-v2',
                version: 2,
                nameSnapshot: '旧版 Agent 指令集',
                descriptionSnapshot: '供历史项目兼容，默认归档，不建议用于新项目。',
                note: '冻结。',
                createdAt: '2026-04-10T06:00:00.000Z',
                content: `兼容旧版输出格式，仅用于历史项目迁移。`,
            },
        ],
    },
];

function formatRelativeTime(value: string) {
    const input = new Date(value).getTime();
    const delta = input - Date.now();
    const abs = Math.abs(delta);

    if (abs < 60_000) return '刚刚';
    if (abs < 3_600_000) return `${Math.round(abs / 60_000)} 分钟前`;
    if (abs < 86_400_000) return `${Math.round(abs / 3_600_000)} 小时前`;
    if (abs < 7 * 86_400_000) return `${Math.round(abs / 86_400_000)} 天前`;

    return new Intl.DateTimeFormat('zh-CN', {
        month: 'short',
        day: 'numeric',
    }).format(new Date(value));
}

function getCurrentVersion(asset: PromptAsset) {
    return asset.versions[0];
}

function sortAssets(assets: PromptAsset[]) {
    return [...assets].sort(
        (left, right) =>
            new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    );
}

function createId(prefix: string) {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function makeBlankDraft(content = ''): AssetDraft {
    return {
        name: '',
        description: '',
        content,
        note: '',
    };
}

function makeEditDraft(asset: PromptAsset): AssetDraft {
    const currentVersion = getCurrentVersion(asset);

    return {
        name: asset.name,
        description: asset.description,
        content: currentVersion.content,
        note: '',
    };
}

function readAssets() {
    if (typeof window === 'undefined') {
        return sortAssets(seedAssets);
    }

    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return sortAssets(seedAssets);

        const parsed = JSON.parse(raw) as PromptAsset[];
        return sortAssets(parsed);
    } catch (error) {
        console.error('Failed to read prompt assets', error);
        return sortAssets(seedAssets);
    }
}

function writeAssets(assets: PromptAsset[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sortAssets(assets)));
    } catch (error) {
        console.error('Failed to persist prompt assets', error);
    }
}

function StatusPill({ status }: { status: PromptAssetStatus }) {
    return (
        <span
            className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ${
                status === 'archived'
                    ? 'bg-slate-200/90 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
            }`}
        >
            {status === 'archived' ? '已归档' : '生效中'}
        </span>
    );
}

function Modal({
    title,
    description,
    children,
    onClose,
}: {
    title: string;
    description?: string;
    children: React.ReactNode;
    onClose: () => void;
}) {
    return (
        <div className="absolute inset-0 z-20 flex items-end justify-center bg-slate-950/28 p-3 backdrop-blur-[2px] sm:items-center sm:p-6">
            <div className="w-full max-w-xl overflow-hidden rounded-[28px] border border-white/60 bg-[var(--card-bg)] shadow-2xl shadow-slate-900/20">
                <div className="flex items-start justify-between border-b border-[var(--border)] px-5 py-4">
                    <div>
                        <h3 className="text-lg font-semibold text-[var(--foreground)]">{title}</h3>
                        {description && (
                            <p className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-full p-2 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                        aria-label="关闭弹窗"
                    >
                        <X size={16} />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

export default function PromptAssetDrawer() {
    const {
        state: { currentProject, promptAssetEntry, showPromptAssets },
        closePromptAssets,
        setPromptAssetNotice,
        updateSystemPrompt,
    } = useEditor();

    const initialAssets = useMemo(() => readAssets(), []);
    const [assets, setAssets] = useState<PromptAsset[]>(initialAssets);
    const [isLoading, setIsLoading] = useState(true);
    const [view, setView] = useState<DrawerView>('list');
    const [selectedAssetId, setSelectedAssetId] = useState<string | null>(() => initialAssets[0]?.id ?? null);
    const [historyVersionId, setHistoryVersionId] = useState<string | null>(() =>
        initialAssets[0] ? getCurrentVersion(initialAssets[0]).id : null
    );
    const [filter, setFilter] = useState<AssetFilter>('all');
    const [query, setQuery] = useState('');
    const [saveDraft, setSaveDraft] = useState<AssetDraft>(() =>
        makeBlankDraft(currentProject?.systemPrompt ?? '')
    );
    const [editDraft, setEditDraft] = useState<AssetDraft>(makeBlankDraft());
    const [showSaveModal, setShowSaveModal] = useState(promptAssetEntry === 'save');
    const [showApplyConfirm, setShowApplyConfirm] = useState(false);
    const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
    const [toast, setToast] = useState<ToastState | null>(null);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setIsLoading(false);
        }, 220);

        return () => window.clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!showPromptAssets) return;
        writeAssets(assets);
    }, [assets, showPromptAssets]);

    useEffect(() => {
        if (!toast) return;

        const timer = window.setTimeout(() => {
            setToast(null);
        }, 2600);

        return () => window.clearTimeout(timer);
    }, [toast]);

    const selectedAsset = useMemo(
        () => assets.find((asset) => asset.id === selectedAssetId) ?? null,
        [assets, selectedAssetId]
    );

    const filteredAssets = useMemo(() => {
        return assets.filter((asset) => {
            const matchesFilter = filter === 'all' ? true : asset.status === filter;
            const currentVersion = getCurrentVersion(asset);
            const source = `${asset.name} ${asset.description} ${currentVersion.note}`.toLowerCase();
            const matchesQuery = query.trim() ? source.includes(query.trim().toLowerCase()) : true;

            return matchesFilter && matchesQuery;
        });
    }, [assets, filter, query]);

    const selectedHistoryVersion = useMemo(() => {
        if (!selectedAsset || !historyVersionId) return null;
        return selectedAsset.versions.find((version) => version.id === historyVersionId) ?? null;
    }, [historyVersionId, selectedAsset]);

    if (!showPromptAssets) return null;

    const openDetail = (asset: PromptAsset) => {
        setSelectedAssetId(asset.id);
        setHistoryVersionId(getCurrentVersion(asset).id);
        setView('detail');
    };

    const handleCreateAsset = () => {
        if (!saveDraft.name.trim() || !saveDraft.content.trim()) return;

        const now = new Date().toISOString();
        const newAsset: PromptAsset = {
            id: createId('asset'),
            name: saveDraft.name.trim(),
            description: saveDraft.description.trim(),
            status: 'active',
            updatedAt: now,
            versions: [
                {
                    id: createId('asset-version'),
                    version: 1,
                    nameSnapshot: saveDraft.name.trim(),
                    descriptionSnapshot: saveDraft.description.trim(),
                    content: saveDraft.content,
                    note: saveDraft.note.trim(),
                    createdAt: now,
                },
            ],
        };

        const nextAssets = sortAssets([newAsset, ...assets]);
        setAssets(nextAssets);
        setSelectedAssetId(newAsset.id);
        setHistoryVersionId(getCurrentVersion(newAsset).id);
        setView('detail');
        setShowSaveModal(false);
        setToast({
            tone: 'success',
            message: '已保存到提示词资产库，当前版本 v1',
        });
    };

    const handleSaveNewVersion = () => {
        if (!selectedAsset) return;

        const currentVersion = getCurrentVersion(selectedAsset);
        const hasChanges =
            editDraft.name.trim() !== selectedAsset.name ||
            editDraft.description.trim() !== selectedAsset.description ||
            editDraft.content !== currentVersion.content;

        if (!hasChanges || !editDraft.name.trim() || !editDraft.content.trim()) return;

        const now = new Date().toISOString();
        const nextVersionNumber = currentVersion.version + 1;
        const nextVersion: PromptAssetVersion = {
            id: createId('asset-version'),
            version: nextVersionNumber,
            nameSnapshot: editDraft.name.trim(),
            descriptionSnapshot: editDraft.description.trim(),
            content: editDraft.content,
            note: editDraft.note.trim(),
            createdAt: now,
        };

        const nextAssets = sortAssets(
            assets.map((asset) =>
                asset.id === selectedAsset.id
                    ? {
                        ...asset,
                        name: editDraft.name.trim(),
                        description: editDraft.description.trim(),
                        updatedAt: now,
                        versions: [nextVersion, ...asset.versions],
                    }
                    : asset
            )
        );

        setAssets(nextAssets);
        setView('detail');
        setHistoryVersionId(nextVersion.id);
        setToast({
            tone: 'success',
            message: `已生成 v${nextVersionNumber}，旧版本历史已保留。`,
        });
    };

    const handleToggleArchive = () => {
        if (!selectedAsset) return;

        const nextStatus: PromptAssetStatus =
            selectedAsset.status === 'archived' ? 'active' : 'archived';

        setAssets(
            assets.map((asset) =>
                asset.id === selectedAsset.id
                    ? {
                        ...asset,
                        status: nextStatus,
                        updatedAt: new Date().toISOString(),
                    }
                    : asset
            )
        );

        setToast({
            tone: 'info',
            message: nextStatus === 'archived' ? '资产已归档。' : '资产已恢复到可用状态。',
        });
    };

    const handleApplyAsset = () => {
        if (!selectedAsset || !currentProject) return;

        const currentVersion = getCurrentVersion(selectedAsset);
        updateSystemPrompt(currentVersion.content);
        setPromptAssetNotice({
            assetName: selectedAsset.name,
            versionLabel: `v${currentVersion.version}`,
        });
        setShowApplyConfirm(false);
        setToast({
            tone: 'success',
            message: `已应用资产「${selectedAsset.name}」v${currentVersion.version}`,
        });
        closePromptAssets();
    };

    const handleRestoreVersion = () => {
        if (!selectedAsset || !selectedHistoryVersion) return;

        const now = new Date().toISOString();
        const currentVersion = getCurrentVersion(selectedAsset);
        const nextVersionNumber = currentVersion.version + 1;
        const restoredVersion: PromptAssetVersion = {
            id: createId('asset-version'),
            version: nextVersionNumber,
            nameSnapshot: selectedHistoryVersion.nameSnapshot,
            descriptionSnapshot: selectedHistoryVersion.descriptionSnapshot,
            content: selectedHistoryVersion.content,
            note: `恢复自 v${selectedHistoryVersion.version}${selectedHistoryVersion.note ? ` · ${selectedHistoryVersion.note}` : ''}`,
            createdAt: now,
        };

        const nextAssets = sortAssets(
            assets.map((asset) =>
                asset.id === selectedAsset.id
                    ? {
                        ...asset,
                        name: selectedHistoryVersion.nameSnapshot,
                        description: selectedHistoryVersion.descriptionSnapshot,
                        updatedAt: now,
                        versions: [restoredVersion, ...asset.versions],
                    }
                    : asset
            )
        );

        setAssets(nextAssets);
        setHistoryVersionId(restoredVersion.id);
        setShowRestoreConfirm(false);
        setView('detail');
        setToast({
            tone: 'success',
            message: `已从历史恢复，并生成新的当前版本 v${nextVersionNumber}。`,
        });
    };

    const renderListState = () => {
        if (isLoading) {
            return (
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, index) => (
                        <div
                            key={`asset-skeleton-${index}`}
                            className="overflow-hidden rounded-[24px] border border-white/50 bg-white/70 p-4 dark:bg-slate-900/40"
                        >
                            <div className="h-4 w-32 animate-pulse rounded-full bg-[var(--muted)]" />
                            <div className="mt-3 h-3 w-full animate-pulse rounded-full bg-[var(--muted)]" />
                            <div className="mt-2 h-3 w-3/4 animate-pulse rounded-full bg-[var(--muted)]" />
                        </div>
                    ))}
                </div>
            );
        }

        if (assets.length === 0) {
            return (
                <div className="rounded-[28px] border border-dashed border-[var(--border)] bg-white/70 px-6 py-12 text-center shadow-sm dark:bg-slate-900/40">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--asset-primary-soft)] text-[var(--asset-primary)]">
                        <Sparkles size={22} />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-[var(--foreground)]">还没有提示词资产</h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                        把常用 System Prompt 保存进来，之后可以跨项目复用。
                    </p>
                    <button
                        onClick={() => {
                            setSaveDraft(makeBlankDraft(currentProject?.systemPrompt ?? ''));
                            setShowSaveModal(true);
                        }}
                        className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--asset-primary)] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-900/15"
                    >
                        <Plus size={15} />
                        {currentProject ? '从当前 Prompt 创建' : '新建资产'}
                    </button>
                </div>
            );
        }

        if (filteredAssets.length === 0) {
            return (
                <div className="rounded-[28px] border border-dashed border-[var(--border)] bg-white/70 px-6 py-12 text-center shadow-sm dark:bg-slate-900/40">
                    <h3 className="text-lg font-semibold text-[var(--foreground)]">未找到匹配资产</h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                        试试更短的关键词，或创建一个新资产。
                    </p>
                    <button
                        onClick={() => {
                            setSaveDraft(makeBlankDraft(currentProject?.systemPrompt ?? ''));
                            setShowSaveModal(true);
                        }}
                        className="mt-5 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--muted)]"
                    >
                        新建资产
                    </button>
                </div>
            );
        }

        return (
            <div className="space-y-3">
                {filteredAssets.map((asset) => {
                    const currentVersion = getCurrentVersion(asset);
                    return (
                        <button
                            key={asset.id}
                            onClick={() => openDetail(asset)}
                            className="group w-full rounded-[24px] border border-white/60 bg-white/75 p-4 text-left shadow-sm shadow-slate-900/5 transition-all hover:-translate-y-0.5 hover:border-[var(--asset-primary)]/35 hover:shadow-lg hover:shadow-cyan-950/10 dark:bg-slate-900/40"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-[15px] font-semibold text-[var(--foreground)]">{asset.name}</h3>
                                        <StatusPill status={asset.status} />
                                    </div>
                                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--muted-foreground)]">
                                        {asset.description}
                                    </p>
                                </div>
                                <div className="rounded-full bg-[var(--asset-primary-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--asset-primary)]">
                                    v{currentVersion.version}
                                </div>
                            </div>
                            <div className="mt-4 flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                                <span className="line-clamp-1">{currentVersion.note || '无版本说明'}</span>
                                <span>{formatRelativeTime(asset.updatedAt)}</span>
                            </div>
                        </button>
                    );
                })}
            </div>
        );
    };

    const renderDetailState = () => {
        if (!selectedAsset) return null;

        const currentVersion = getCurrentVersion(selectedAsset);

        return (
            <div className="flex h-full flex-col">
                <div className="border-b border-[var(--border)] px-5 pb-4">
                    <button
                        onClick={() => setView('list')}
                        className="inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] shadow-sm hover:text-[var(--foreground)] dark:bg-slate-900/40"
                    >
                        <ArrowLeft size={14} />
                        返回列表
                    </button>
                    <div className="mt-4 flex items-start justify-between gap-4">
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-2xl font-semibold text-[var(--foreground)]">{selectedAsset.name}</h3>
                                <div className="rounded-full bg-[var(--asset-primary-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--asset-primary)]">
                                    v{currentVersion.version}
                                </div>
                                <StatusPill status={selectedAsset.status} />
                            </div>
                            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted-foreground)]">
                                {selectedAsset.description}
                            </p>
                        </div>
                        <div className="flex items-center gap-2 rounded-full bg-white/75 px-3 py-1.5 text-xs text-[var(--muted-foreground)] shadow-sm dark:bg-slate-900/40">
                            <Clock3 size={13} />
                            {formatRelativeTime(selectedAsset.updatedAt)}
                        </div>
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <button
                            onClick={() => setShowApplyConfirm(true)}
                            disabled={!currentProject}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--asset-primary)] px-3 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-950/15 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                            <Check size={15} />
                            应用到当前 System Prompt
                        </button>
                        <button
                            onClick={() => {
                                setEditDraft(makeEditDraft(selectedAsset));
                                setView('edit');
                            }}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-white/80 px-3 py-3 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--muted)] dark:bg-slate-900/50"
                        >
                            <Pencil size={15} />
                            编辑
                        </button>
                        <button
                            onClick={() => {
                                setHistoryVersionId(currentVersion.id);
                                setView('history');
                            }}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-white/80 px-3 py-3 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--muted)] dark:bg-slate-900/50"
                        >
                            <History size={15} />
                            查看版本历史
                        </button>
                        <button
                            onClick={handleToggleArchive}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-white/80 px-3 py-3 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--muted)] dark:bg-slate-900/50"
                        >
                            <Archive size={15} />
                            {selectedAsset.status === 'archived' ? '恢复使用' : '归档'}
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-5">
                    <div className="rounded-[28px] border border-white/60 bg-white/75 p-4 shadow-sm dark:bg-slate-900/40">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                                    Prompt Preview
                                </p>
                                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                                    当前版本说明：{currentVersion.note || '未填写'}
                                </p>
                            </div>
                            <div className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--muted-foreground)]">
                                {currentVersion.content.length} 字符
                            </div>
                        </div>
                        <pre className="mt-4 whitespace-pre-wrap rounded-[22px] bg-[var(--asset-preview-bg)] p-4 font-mono text-[13px] leading-6 text-[var(--foreground)]">
                            {currentVersion.content}
                        </pre>
                        {!currentProject && (
                            <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                                当前未选择项目，暂时只能浏览资产，不能应用到编辑区。
                            </p>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderEditState = () => {
        if (!selectedAsset) return null;

        const currentVersion = getCurrentVersion(selectedAsset);
        const hasChanges =
            editDraft.name.trim() !== selectedAsset.name ||
            editDraft.description.trim() !== selectedAsset.description ||
            editDraft.content !== currentVersion.content;

        return (
            <div className="flex h-full flex-col">
                <div className="border-b border-[var(--border)] px-5 py-4">
                    <button
                        onClick={() => setView('detail')}
                        className="inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] shadow-sm hover:text-[var(--foreground)] dark:bg-slate-900/40"
                    >
                        <ArrowLeft size={14} />
                        返回详情
                    </button>
                    <h3 className="mt-4 text-2xl font-semibold text-[var(--foreground)]">编辑当前资产</h3>
                    <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                        保存动作会生成新版本，不会覆盖历史记录。
                    </p>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-5">
                    <div className="space-y-4">
                        <label className="block">
                            <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">名称</span>
                            <input
                                type="text"
                                value={editDraft.name}
                                onChange={(event) =>
                                    setEditDraft((current) => ({ ...current, name: event.target.value }))
                                }
                                className="w-full rounded-2xl border border-[var(--border)] bg-white/90 px-4 py-3 text-sm text-[var(--foreground)] shadow-sm dark:bg-slate-900/60"
                                placeholder="例如：代码评审提示词"
                            />
                        </label>
                        <label className="block">
                            <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">描述</span>
                            <textarea
                                value={editDraft.description}
                                onChange={(event) =>
                                    setEditDraft((current) => ({ ...current, description: event.target.value }))
                                }
                                className="min-h-[88px] w-full rounded-2xl border border-[var(--border)] bg-white/90 px-4 py-3 text-sm leading-6 text-[var(--foreground)] shadow-sm dark:bg-slate-900/60"
                                placeholder="说明它适合什么场景、为什么值得复用。"
                            />
                        </label>
                        <label className="block">
                            <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">版本说明</span>
                            <input
                                type="text"
                                value={editDraft.note}
                                onChange={(event) =>
                                    setEditDraft((current) => ({ ...current, note: event.target.value }))
                                }
                                className="w-full rounded-2xl border border-[var(--border)] bg-white/90 px-4 py-3 text-sm text-[var(--foreground)] shadow-sm dark:bg-slate-900/60"
                                placeholder="例如：补充冲突处理和输出格式约束"
                            />
                        </label>
                        <label className="block">
                            <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">正文</span>
                            <AutoResizeTextarea
                                value={editDraft.content}
                                onChange={(event) =>
                                    setEditDraft((current) => ({ ...current, content: event.target.value }))
                                }
                                minHeight={260}
                                className="w-full rounded-[24px] border border-[var(--border)] bg-[var(--asset-preview-bg)] px-4 py-4 font-mono text-sm leading-6 text-[var(--foreground)] shadow-sm"
                                placeholder="在这里调整当前版本内容..."
                            />
                        </label>
                    </div>
                </div>
                <div className="border-t border-[var(--border)] bg-white/75 px-5 py-4 backdrop-blur-sm dark:bg-slate-950/35">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-[var(--muted-foreground)]">
                            {hasChanges ? '检测到改动，将创建新版本。' : '没有检测到内容变更。'}
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setView('detail')}
                                className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--muted)]"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleSaveNewVersion}
                                disabled={!hasChanges || !editDraft.name.trim() || !editDraft.content.trim()}
                                className="rounded-full bg-[var(--asset-primary)] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-950/15 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                                保存为新版本
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderHistoryState = () => {
        if (!selectedAsset) return null;

        return (
            <div className="flex h-full flex-col">
                <div className="border-b border-[var(--border)] px-5 py-4">
                    <button
                        onClick={() => setView('detail')}
                        className="inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] shadow-sm hover:text-[var(--foreground)] dark:bg-slate-900/40"
                    >
                        <ArrowLeft size={14} />
                        返回详情
                    </button>
                    <h3 className="mt-4 text-2xl font-semibold text-[var(--foreground)]">版本历史</h3>
                    <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                        恢复历史版本时，系统会基于它生成一个新的当前版本。
                    </p>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-5">
                    <div className="space-y-3">
                        {selectedAsset.versions.map((version) => (
                            <button
                                key={version.id}
                                onClick={() => setHistoryVersionId(version.id)}
                                className={`w-full rounded-[22px] border p-4 text-left shadow-sm transition-all ${
                                    historyVersionId === version.id
                                        ? 'border-[var(--asset-primary)] bg-[var(--asset-primary-soft)]/75 shadow-cyan-950/10'
                                        : 'border-white/60 bg-white/75 hover:border-[var(--asset-primary)]/35 dark:bg-slate-900/40'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-[var(--foreground)]">
                                                v{version.version}
                                            </span>
                                            {version.id === getCurrentVersion(selectedAsset).id && (
                                                <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                                                    当前版本
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                                            {formatRelativeTime(version.createdAt)}
                                        </p>
                                    </div>
                                    <span className="text-xs text-[var(--muted-foreground)]">
                                        {version.note || '无版本说明'}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                    {selectedHistoryVersion && (
                        <div className="mt-5 rounded-[28px] border border-white/60 bg-white/75 p-4 shadow-sm dark:bg-slate-900/40">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <h4 className="text-lg font-semibold text-[var(--foreground)]">
                                        v{selectedHistoryVersion.version}
                                    </h4>
                                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                                        {selectedHistoryVersion.note || '未填写版本说明'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowRestoreConfirm(true)}
                                    className="rounded-full bg-[var(--asset-primary)] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-950/15"
                                >
                                    恢复为当前版本
                                </button>
                            </div>
                            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                                        名称快照
                                    </p>
                                    <p className="mt-2 text-sm font-medium text-[var(--foreground)]">
                                        {selectedHistoryVersion.nameSnapshot}
                                    </p>
                                    <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
                                        {selectedHistoryVersion.descriptionSnapshot}
                                    </p>
                                </div>
                                <pre className="whitespace-pre-wrap rounded-[22px] bg-[var(--asset-preview-bg)] p-4 font-mono text-[13px] leading-6 text-[var(--foreground)]">
                                    {selectedHistoryVersion.content}
                                </pre>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="absolute inset-y-0 right-0 left-0 z-20">
            <button
                className="absolute inset-0 bg-slate-950/18 backdrop-blur-[1px]"
                onClick={closePromptAssets}
                aria-label="关闭提示词资产库"
            />
            <aside className="absolute top-0 right-0 bottom-0 z-10 flex w-full flex-col overflow-hidden border-l border-white/60 bg-[var(--asset-drawer-bg)] shadow-2xl shadow-cyan-950/15 backdrop-blur-xl animate-[slideInRight_220ms_ease-out] sm:w-[520px]">
                <div className="border-b border-white/60 bg-[var(--asset-header-bg)] px-5 pb-5 pt-6">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--asset-primary)]">
                                Prompt Assets
                            </p>
                            <h2 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">提示词资产库</h2>
                            <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted-foreground)]">
                                资产是模板来源，项目里的 System Prompt 是当前工作副本。
                            </p>
                        </div>
                        <button
                            onClick={closePromptAssets}
                            className="rounded-full border border-white/60 bg-white/70 p-2 text-[var(--muted-foreground)] shadow-sm hover:bg-white dark:bg-slate-900/50"
                            aria-label="关闭提示词资产库"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {view === 'list' && (
                        <div className="mt-5 space-y-3">
                            <div className="relative">
                                <Search
                                    size={16}
                                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
                                />
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="搜索名称、描述或版本说明"
                                    className="w-full rounded-[20px] border border-white/60 bg-white/80 py-3 pl-11 pr-4 text-sm text-[var(--foreground)] shadow-sm outline-none ring-0 placeholder:text-[var(--muted-foreground)] dark:bg-slate-900/55"
                                />
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {[
                                    { label: '全部', value: 'all' as const },
                                    { label: '生效中', value: 'active' as const },
                                    { label: '已归档', value: 'archived' as const },
                                ].map((item) => (
                                    <button
                                        key={item.value}
                                        onClick={() => setFilter(item.value)}
                                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                                            filter === item.value
                                                ? 'bg-[var(--asset-primary)] text-white shadow-lg shadow-cyan-950/15'
                                                : 'border border-white/70 bg-white/70 text-[var(--muted-foreground)] hover:text-[var(--foreground)] dark:bg-slate-900/45'
                                        }`}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                                <button
                                    onClick={() => {
                                        setSaveDraft(makeBlankDraft(currentProject?.systemPrompt ?? ''));
                                        setShowSaveModal(true);
                                    }}
                                    className="ml-auto inline-flex items-center gap-2 rounded-full bg-[var(--asset-primary)] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-950/15"
                                >
                                    <Plus size={15} />
                                    新建资产
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-hidden">
                    {view === 'list' && <div className="h-full overflow-y-auto px-5 py-5">{renderListState()}</div>}
                    {view === 'detail' && renderDetailState()}
                    {view === 'edit' && renderEditState()}
                    {view === 'history' && renderHistoryState()}
                </div>

                {toast && (
                    <div className="pointer-events-none absolute bottom-5 left-1/2 z-20 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-full border border-white/70 bg-white/90 px-4 py-3 text-sm font-medium text-[var(--foreground)] shadow-xl shadow-slate-900/10 backdrop-blur dark:bg-slate-900/80">
                        {toast.message}
                    </div>
                )}

                {showSaveModal && (
                    <Modal
                        title="保存为资产"
                        description="创建后会生成 v1，并保留当前项目里的 prompt 内容。"
                        onClose={() => setShowSaveModal(false)}
                    >
                        <div className="space-y-4 px-5 py-5">
                            <label className="block">
                                <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">名称</span>
                                <input
                                    type="text"
                                    value={saveDraft.name}
                                    onChange={(event) =>
                                        setSaveDraft((current) => ({ ...current, name: event.target.value }))
                                    }
                                    className="w-full rounded-2xl border border-[var(--border)] bg-white/90 px-4 py-3 text-sm text-[var(--foreground)] shadow-sm dark:bg-slate-900/60"
                                    placeholder="例如：代码评审提示词"
                                />
                            </label>
                            <label className="block">
                                <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">描述</span>
                                <textarea
                                    value={saveDraft.description}
                                    onChange={(event) =>
                                        setSaveDraft((current) => ({ ...current, description: event.target.value }))
                                    }
                                    className="min-h-[88px] w-full rounded-2xl border border-[var(--border)] bg-white/90 px-4 py-3 text-sm leading-6 text-[var(--foreground)] shadow-sm dark:bg-slate-900/60"
                                    placeholder="说明它适合什么场景、为什么值得沉淀。"
                                />
                            </label>
                            <label className="block">
                                <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">版本说明</span>
                                <input
                                    type="text"
                                    value={saveDraft.note}
                                    onChange={(event) =>
                                        setSaveDraft((current) => ({ ...current, note: event.target.value }))
                                    }
                                    className="w-full rounded-2xl border border-[var(--border)] bg-white/90 px-4 py-3 text-sm text-[var(--foreground)] shadow-sm dark:bg-slate-900/60"
                                    placeholder="例如：整理成可复用模板"
                                />
                            </label>
                            <label className="block">
                                <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">正文</span>
                                <AutoResizeTextarea
                                    value={saveDraft.content}
                                    onChange={(event) =>
                                        setSaveDraft((current) => ({ ...current, content: event.target.value }))
                                    }
                                    minHeight={220}
                                    className="w-full rounded-[24px] border border-[var(--border)] bg-[var(--asset-preview-bg)] px-4 py-4 font-mono text-sm leading-6 text-[var(--foreground)] shadow-sm"
                                    placeholder="默认带入当前 System Prompt，也可以在这里二次整理。"
                                />
                            </label>
                        </div>
                        <div className="flex items-center justify-between border-t border-[var(--border)] bg-white/70 px-5 py-4 dark:bg-slate-950/35">
                            <p className="text-sm text-[var(--muted-foreground)]">
                                正文允许在创建前微调，避免来回切上下文。
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowSaveModal(false)}
                                    className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--muted)]"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleCreateAsset}
                                    disabled={!saveDraft.name.trim() || !saveDraft.content.trim()}
                                    className="rounded-full bg-[var(--asset-primary)] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-950/15 disabled:cursor-not-allowed disabled:opacity-45"
                                >
                                    创建资产
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}

                {showApplyConfirm && selectedAsset && (
                    <Modal
                        title="应用到当前项目？"
                        description="这会替换当前项目中的 System Prompt，但不会修改资产库内容。"
                        onClose={() => setShowApplyConfirm(false)}
                    >
                        <div className="px-5 py-5">
                            {currentProject?.systemPrompt.trim() && (
                                <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                                    当前项目存在未保存改动，应用后将以资产内容覆盖编辑区。
                                </div>
                            )}
                            <p className="mt-4 text-sm leading-6 text-[var(--muted-foreground)]">
                                即将应用资产「{selectedAsset.name}」{getCurrentVersion(selectedAsset).version} 版本。
                            </p>
                        </div>
                        <div className="flex justify-end gap-2 border-t border-[var(--border)] bg-white/70 px-5 py-4 dark:bg-slate-950/35">
                            <button
                                onClick={() => setShowApplyConfirm(false)}
                                className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--muted)]"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleApplyAsset}
                                className="rounded-full bg-[var(--asset-primary)] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-950/15"
                            >
                                确认应用
                            </button>
                        </div>
                    </Modal>
                )}

                {showRestoreConfirm && selectedHistoryVersion && (
                    <Modal
                        title="恢复这个版本？"
                        description="系统会基于该历史版本创建一个新的当前版本，原有历史不会丢失。"
                        onClose={() => setShowRestoreConfirm(false)}
                    >
                        <div className="px-5 py-5">
                            <div className="rounded-[24px] border border-white/60 bg-[var(--asset-preview-bg)] p-4 shadow-sm">
                                <p className="text-sm font-semibold text-[var(--foreground)]">
                                    即将恢复 v{selectedHistoryVersion.version}
                                </p>
                                <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                                    {selectedHistoryVersion.note || '未填写版本说明'}
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 border-t border-[var(--border)] bg-white/70 px-5 py-4 dark:bg-slate-950/35">
                            <button
                                onClick={() => setShowRestoreConfirm(false)}
                                className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--muted)]"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleRestoreVersion}
                                className="rounded-full bg-[var(--asset-primary)] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-950/15"
                            >
                                恢复并生成新版本
                            </button>
                        </div>
                    </Modal>
                )}
            </aside>
        </div>
    );
}
