'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
    archivePromptAsset,
    createPromptAsset,
    createPromptAssetVersion,
    getPromptAssetDetail,
    listPromptAssets,
    listPromptAssetVersions,
    PromptAssetApiError,
    restorePromptAssetVersion,
    unarchivePromptAsset,
} from '../lib/prompt-assets/client';
import type {
    PromptAssetDetail,
    PromptAssetStatus,
    PromptAssetSummary,
    PromptAssetVersionItem,
} from '../lib/prompt-assets/dto';

type DrawerView = 'list' | 'detail' | 'edit' | 'history';
type AssetFilter = 'all' | PromptAssetStatus;
type PendingAction =
    | 'create'
    | 'loadDetail'
    | 'loadHistory'
    | 'saveVersion'
    | 'restore'
    | 'toggleArchive'
    | null;

interface ToastState {
    tone: 'success' | 'info' | 'error';
    message: string;
}

interface AssetDraft {
    name: string;
    description: string;
    content: string;
    changeNote: string;
}

function formatRelativeTime(value: number) {
    const delta = value - Date.now();
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

function toSummary(detail: PromptAssetDetail): PromptAssetSummary {
    return {
        id: detail.id,
        name: detail.name,
        description: detail.description,
        status: detail.status,
        currentVersionNumber: detail.currentVersionNumber,
        createdAt: detail.createdAt,
        updatedAt: detail.updatedAt,
        archivedAt: detail.archivedAt,
    };
}

function sortSummaries(items: PromptAssetSummary[]) {
    return [...items].sort((left, right) => right.updatedAt - left.updatedAt);
}

function makeBlankDraft(content = ''): AssetDraft {
    return {
        name: '',
        description: '',
        content,
        changeNote: '',
    };
}

function makeEditDraft(detail: PromptAssetDetail): AssetDraft {
    return {
        name: detail.name,
        description: detail.description,
        content: detail.currentVersion.content,
        changeNote: '',
    };
}

function getPromptAssetErrorMessage(error: unknown, fallback: string) {
    if (error instanceof PromptAssetApiError) {
        switch (error.code) {
            case 'PROMPT_ASSET_VERSION_CONFLICT':
                return '版本已变化，请刷新后重试。';
            case 'PROMPT_ASSET_NO_CHANGES':
                return '没有检测到有效变更，无法生成新版本。';
            case 'PROMPT_ASSET_ARCHIVED':
                return '归档资产不能新增版本，请先恢复。';
            case 'PROMPT_ASSET_VALIDATION_FAILED':
                return '输入不符合校验规则，请检查名称和正文。';
            case 'PROMPT_ASSET_NOT_FOUND':
                return '目标资产不存在，可能已被删除。';
            case 'PROMPT_ASSET_VERSION_NOT_FOUND':
                return '目标版本不存在，可能已失效。';
            default:
                return error.message || fallback;
        }
    }

    if (error instanceof Error && error.message) {
        return error.message;
    }

    return fallback;
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
    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, []);

    return (
        <div
            className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/28 p-3 backdrop-blur-[2px] sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label={title}
        >
            <div className="flex min-h-full items-end justify-center sm:items-center">
                <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-xl flex-col overflow-hidden rounded-[28px] border border-white/60 bg-[var(--card-bg)] shadow-2xl shadow-slate-900/20 sm:max-h-[calc(100dvh-3rem)]">
                    <div className="flex shrink-0 items-start justify-between border-b border-[var(--border)] px-5 py-4">
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
                    <div className="overflow-y-auto">{children}</div>
                </div>
            </div>
        </div>
    );
}

export default function PromptAssetDrawer({ entry = null }: { entry?: string | null }) {
    const {
        state: { currentProject },
        setPromptAssetNotice,
        updateSystemPrompt,
    } = useEditor();
    const router = useRouter();

    const [assets, setAssets] = useState<PromptAssetSummary[]>([]);
    const [isLoadingList, setIsLoadingList] = useState(false);
    const [listError, setListError] = useState<string | null>(null);
    const [view, setView] = useState<DrawerView>('list');
    const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
    const [selectedAssetDetail, setSelectedAssetDetail] = useState<PromptAssetDetail | null>(null);
    const [detailError, setDetailError] = useState<string | null>(null);
    const [versions, setVersions] = useState<PromptAssetVersionItem[]>([]);
    const [historyVersionId, setHistoryVersionId] = useState<string | null>(null);
    const [historyError, setHistoryError] = useState<string | null>(null);
    const [filter, setFilter] = useState<AssetFilter>('active');
    const [query, setQuery] = useState('');
    const [saveDraft, setSaveDraft] = useState<AssetDraft>(makeBlankDraft());
    const [editDraft, setEditDraft] = useState<AssetDraft>(makeBlankDraft());
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [showApplyConfirm, setShowApplyConfirm] = useState(false);
    const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
    const [toast, setToast] = useState<ToastState | null>(null);
    const [pendingAction, setPendingAction] = useState<PendingAction>(null);
    const currentProjectPromptRef = useRef(currentProject?.systemPrompt ?? '');
    const listRequestIdRef = useRef(0);
    const detailRequestIdRef = useRef(0);
    const historyRequestIdRef = useRef(0);
    const lastHandledEntryRef = useRef<string | null>(null);

    const selectedHistoryVersion = useMemo(
        () => versions.find((version) => version.id === historyVersionId) ?? null,
        [historyVersionId, versions]
    );

    useEffect(() => {
        currentProjectPromptRef.current = currentProject?.systemPrompt ?? '';
    }, [currentProject?.systemPrompt]);

    const loadAssetsForCurrentFilters = useCallback(async () => {
        const requestId = ++listRequestIdRef.current;
        setIsLoadingList(true);
        setListError(null);

        try {
            const data = await listPromptAssets({
                query: query.trim() || undefined,
                status: filter,
                page: 1,
                pageSize: 50,
            });

            if (requestId !== listRequestIdRef.current) {
                return;
            }

            setAssets(data.items);
        } catch (error) {
            if (requestId !== listRequestIdRef.current) {
                return;
            }

            setListError(getPromptAssetErrorMessage(error, '加载资产列表失败。'));
        } finally {
            if (requestId === listRequestIdRef.current) {
                setIsLoadingList(false);
            }
        }
    }, [filter, query]);

    const loadAssetDetail = useCallback(async (assetId: string) => {
        const requestId = ++detailRequestIdRef.current;
        setPendingAction('loadDetail');
        setDetailError(null);

        try {
            const detail = await getPromptAssetDetail(assetId);

            if (requestId !== detailRequestIdRef.current) {
                return;
            }

            setSelectedAssetId(detail.id);
            setSelectedAssetDetail(detail);
            setHistoryVersionId(detail.currentVersion.id);
            setAssets((current) =>
                sortSummaries([toSummary(detail), ...current.filter((item) => item.id !== detail.id)])
            );
        } catch (error) {
            if (requestId !== detailRequestIdRef.current) {
                return;
            }

            setDetailError(getPromptAssetErrorMessage(error, '加载资产详情失败。'));
        } finally {
            if (requestId === detailRequestIdRef.current) {
                setPendingAction(null);
            }
        }
    }, []);

    const loadAssetHistory = useCallback(async (assetId: string, preferredVersionId?: string | null) => {
        const requestId = ++historyRequestIdRef.current;
        setPendingAction('loadHistory');
        setHistoryError(null);

        try {
            const data = await listPromptAssetVersions(assetId, {
                page: 1,
                pageSize: 50,
            });

            if (requestId !== historyRequestIdRef.current) {
                return;
            }

            setVersions(data.items);
            setHistoryVersionId(preferredVersionId ?? data.items[0]?.id ?? null);
        } catch (error) {
            if (requestId !== historyRequestIdRef.current) {
                return;
            }

            setHistoryError(getPromptAssetErrorMessage(error, '加载版本历史失败。'));
        } finally {
            if (requestId === historyRequestIdRef.current) {
                setPendingAction(null);
            }
        }
    }, []);

    useEffect(() => {
        if (!toast) return;

        const timer = window.setTimeout(() => {
            setToast(null);
        }, 2800);

        return () => window.clearTimeout(timer);
    }, [toast]);

    useEffect(() => {
        if (entry === lastHandledEntryRef.current) {
            return;
        }

        lastHandledEntryRef.current = entry;

        if (entry !== 'save') {
            return;
        }

        if (!currentProjectPromptRef.current.trim()) {
            setToast({
                tone: 'info',
                message: '当前项目的 System Prompt 为空，无法保存为资产。',
            });
        } else {
            setSaveDraft(makeBlankDraft(currentProjectPromptRef.current));
            setShowSaveModal(true);
        }

        router.replace('/prompt-assets', { scroll: false });
    }, [entry, router]);

    useEffect(() => {
        void loadAssetsForCurrentFilters();
    }, [loadAssetsForCurrentFilters]);

    const handleOpenDetail = (assetId: string) => {
        setSelectedAssetId(assetId);
        setSelectedAssetDetail(null);
        setVersions([]);
        setHistoryVersionId(null);
        setView('detail');
        void loadAssetDetail(assetId);
    };

    const handleCreateAsset = async () => {
        if (!saveDraft.name.trim() || !saveDraft.content.trim()) {
            return;
        }

        setPendingAction('create');

        try {
            const detail = await createPromptAsset({
                name: saveDraft.name.trim(),
                description: saveDraft.description,
                content: saveDraft.content,
                changeNote: saveDraft.changeNote.trim() || undefined,
            });

            setSelectedAssetId(detail.id);
            setSelectedAssetDetail(detail);
            setHistoryVersionId(detail.currentVersion.id);
            setVersions([]);
            setView('detail');
            setShowSaveModal(false);
            setToast({
                tone: 'success',
                message: '已保存到提示词资产库，当前版本 v1',
            });

            await loadAssetsForCurrentFilters();
        } catch (error) {
            setToast({
                tone: 'error',
                message: getPromptAssetErrorMessage(error, '创建资产失败。'),
            });
        } finally {
            setPendingAction(null);
        }
    };

    const handleSaveNewVersion = async () => {
        if (!selectedAssetDetail) {
            return;
        }

        const hasChanges =
            editDraft.name.trim() !== selectedAssetDetail.name ||
            editDraft.description !== selectedAssetDetail.description ||
            editDraft.content !== selectedAssetDetail.currentVersion.content;

        if (!hasChanges || !editDraft.name.trim() || !editDraft.content.trim()) {
            return;
        }

        setPendingAction('saveVersion');

        try {
            const detail = await createPromptAssetVersion(selectedAssetDetail.id, {
                name: editDraft.name.trim(),
                description: editDraft.description,
                content: editDraft.content,
                changeNote: editDraft.changeNote.trim() || undefined,
                expectedVersionNumber: selectedAssetDetail.currentVersionNumber,
            });

            setSelectedAssetDetail(detail);
            setHistoryVersionId(detail.currentVersion.id);
            setVersions([]);
            setView('detail');
            setToast({
                tone: 'success',
                message: `已生成 v${detail.currentVersion.versionNumber}，旧版本历史已保留。`,
            });

            await loadAssetsForCurrentFilters();
        } catch (error) {
            setToast({
                tone: 'error',
                message: getPromptAssetErrorMessage(error, '保存新版本失败。'),
            });

            await loadAssetDetail(selectedAssetDetail.id);
        } finally {
            setPendingAction(null);
        }
    };

    const handleToggleArchive = async () => {
        if (!selectedAssetDetail) {
            return;
        }

        setPendingAction('toggleArchive');

        try {
            const summary =
                selectedAssetDetail.status === 'archived'
                    ? await unarchivePromptAsset(selectedAssetDetail.id)
                    : await archivePromptAsset(selectedAssetDetail.id);

            setSelectedAssetDetail((current) =>
                current && current.id === summary.id
                    ? {
                          ...current,
                          status: summary.status,
                          updatedAt: summary.updatedAt,
                          archivedAt: summary.archivedAt,
                      }
                    : current
            );

            setAssets((current) =>
                sortSummaries([summary, ...current.filter((item) => item.id !== summary.id)])
            );
            setToast({
                tone: 'info',
                message: summary.status === 'archived' ? '资产已归档。' : '资产已恢复到可用状态。',
            });

            await loadAssetsForCurrentFilters();
        } catch (error) {
            setToast({
                tone: 'error',
                message: getPromptAssetErrorMessage(error, '更新资产状态失败。'),
            });
        } finally {
            setPendingAction(null);
        }
    };

    const handleApplyAsset = () => {
        if (!selectedAssetDetail || !currentProject) {
            return;
        }

        updateSystemPrompt(selectedAssetDetail.currentVersion.content);
        setPromptAssetNotice({
            assetName: selectedAssetDetail.name,
            versionLabel: `v${selectedAssetDetail.currentVersion.versionNumber}`,
        });
        setShowApplyConfirm(false);
        router.push('/');
    };

    const handleOpenHistory = async () => {
        if (!selectedAssetDetail) {
            return;
        }

        setView('history');
        await loadAssetHistory(selectedAssetDetail.id, selectedAssetDetail.currentVersion.id);
    };

    const handleRestoreVersion = async () => {
        if (!selectedAssetDetail || !selectedHistoryVersion) {
            return;
        }

        setPendingAction('restore');

        try {
            const detail = await restorePromptAssetVersion(selectedAssetDetail.id, {
                versionId: selectedHistoryVersion.id,
                changeNote: `从 v${selectedHistoryVersion.versionNumber} 恢复`,
                expectedVersionNumber: selectedAssetDetail.currentVersionNumber,
            });

            setSelectedAssetDetail(detail);
            setHistoryVersionId(detail.currentVersion.id);
            setShowRestoreConfirm(false);
            setView('detail');
            setToast({
                tone: 'success',
                message: `已从历史恢复，并生成新的当前版本 v${detail.currentVersion.versionNumber}。`,
            });

            await loadAssetsForCurrentFilters();
        } catch (error) {
            setToast({
                tone: 'error',
                message: getPromptAssetErrorMessage(error, '恢复历史版本失败。'),
            });

            await loadAssetDetail(selectedAssetDetail.id);
            await loadAssetHistory(selectedAssetDetail.id, selectedHistoryVersion.id);
        } finally {
            setPendingAction(null);
        }
    };

    const renderListState = () => {
        if (listError) {
            return (
                <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-6 py-8 text-center shadow-sm dark:border-rose-900/60 dark:bg-rose-950/30">
                    <h3 className="text-lg font-semibold text-rose-800 dark:text-rose-200">加载失败</h3>
                    <p className="mt-2 text-sm leading-6 text-rose-700/90 dark:text-rose-200/80">
                        {listError}
                    </p>
                    <button
                        onClick={() => void loadAssetsForCurrentFilters()}
                        className="mt-5 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
                    >
                        重试
                    </button>
                </div>
            );
        }

        if (isLoadingList && assets.length === 0) {
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
            const isSearchState = Boolean(query.trim()) || filter !== 'active';

            return (
                <div className="rounded-[28px] border border-dashed border-[var(--border)] bg-white/70 px-6 py-12 text-center shadow-sm dark:bg-slate-900/40">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--asset-primary-soft)] text-[var(--asset-primary)]">
                        <Sparkles size={22} />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-[var(--foreground)]">
                        {isSearchState ? '未找到匹配资产' : '还没有提示词资产'}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                        {isSearchState
                            ? '试试更短的关键词或切换筛选条件。'
                            : '把常用 System Prompt 保存进来，之后可以跨项目复用。'}
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

        return (
            <div className="space-y-3">
                {assets.map((asset) => (
                    <button
                        key={asset.id}
                        onClick={() => handleOpenDetail(asset.id)}
                        className="group w-full rounded-[24px] border border-white/60 bg-white/75 p-4 text-left shadow-sm shadow-slate-900/5 transition-all hover:-translate-y-0.5 hover:border-[var(--asset-primary)]/35 hover:shadow-lg hover:shadow-cyan-950/10 dark:bg-slate-900/40"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-[15px] font-semibold text-[var(--foreground)]">
                                        {asset.name}
                                    </h3>
                                    <StatusPill status={asset.status} />
                                </div>
                                <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--muted-foreground)]">
                                    {asset.description || '未填写描述'}
                                </p>
                            </div>
                            <div className="rounded-full bg-[var(--asset-primary-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--asset-primary)]">
                                v{asset.currentVersionNumber}
                            </div>
                        </div>
                        <div className="mt-4 flex items-center justify-end text-xs text-[var(--muted-foreground)]">
                            <span>{formatRelativeTime(asset.updatedAt)}</span>
                        </div>
                    </button>
                ))}
            </div>
        );
    };

    const renderDetailState = () => {
        if (detailError) {
            return (
                <div className="flex h-full items-center justify-center px-5 py-8">
                    <div className="w-full rounded-[28px] border border-rose-200 bg-rose-50 px-6 py-8 text-center shadow-sm dark:border-rose-900/60 dark:bg-rose-950/30">
                        <h3 className="text-lg font-semibold text-rose-800 dark:text-rose-200">详情加载失败</h3>
                        <p className="mt-2 text-sm leading-6 text-rose-700/90 dark:text-rose-200/80">
                            {detailError}
                        </p>
                        {selectedAssetId && (
                            <button
                                onClick={() => void loadAssetDetail(selectedAssetId)}
                                className="mt-5 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
                            >
                                重试
                            </button>
                        )}
                    </div>
                </div>
            );
        }

        if (pendingAction === 'loadDetail' || !selectedAssetDetail) {
            return (
                <div className="space-y-4 px-5 py-5">
                    <div className="h-8 w-40 animate-pulse rounded-full bg-[var(--muted)]" />
                    <div className="h-24 animate-pulse rounded-[28px] bg-[var(--muted)]" />
                    <div className="h-72 animate-pulse rounded-[28px] bg-[var(--muted)]" />
                </div>
            );
        }

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
                                <h3 className="text-2xl font-semibold text-[var(--foreground)]">
                                    {selectedAssetDetail.name}
                                </h3>
                                <div className="rounded-full bg-[var(--asset-primary-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--asset-primary)]">
                                    v{selectedAssetDetail.currentVersion.versionNumber}
                                </div>
                                <StatusPill status={selectedAssetDetail.status} />
                            </div>
                            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted-foreground)]">
                                {selectedAssetDetail.description || '未填写描述'}
                            </p>
                        </div>
                        <div className="flex items-center gap-2 rounded-full bg-white/75 px-3 py-1.5 text-xs text-[var(--muted-foreground)] shadow-sm dark:bg-slate-900/40">
                            <Clock3 size={13} />
                            {formatRelativeTime(selectedAssetDetail.updatedAt)}
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
                                setEditDraft(makeEditDraft(selectedAssetDetail));
                                setView('edit');
                            }}
                            disabled={selectedAssetDetail.status === 'archived'}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-white/80 px-3 py-3 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-slate-900/50"
                        >
                            <Pencil size={15} />
                            保存为新版本
                        </button>
                        <button
                            onClick={() => void handleOpenHistory()}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-white/80 px-3 py-3 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--muted)] dark:bg-slate-900/50"
                        >
                            <History size={15} />
                            查看版本历史
                        </button>
                        <button
                            onClick={() => void handleToggleArchive()}
                            disabled={pendingAction === 'toggleArchive'}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-white/80 px-3 py-3 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-slate-900/50"
                        >
                            <Archive size={15} />
                            {selectedAssetDetail.status === 'archived' ? '恢复使用' : '归档'}
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-5">
                    <div className="rounded-[28px] border border-white/60 bg-white/75 p-4 shadow-sm dark:bg-slate-900/40">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                                    Prompt Preview
                                </p>
                                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                                    当前版本说明：{selectedAssetDetail.currentVersion.changeNote || '未填写'}
                                </p>
                            </div>
                            <div className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--muted-foreground)]">
                                {selectedAssetDetail.currentVersion.content.length} 字符
                            </div>
                        </div>
                        <pre className="mt-4 whitespace-pre-wrap rounded-[22px] bg-[var(--asset-preview-bg)] p-4 font-mono text-[13px] leading-6 text-[var(--foreground)]">
                            {selectedAssetDetail.currentVersion.content}
                        </pre>
                        {selectedAssetDetail.status === 'archived' && (
                            <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                                当前资产已归档，可继续浏览和应用，但需要恢复后才能新增版本。
                            </p>
                        )}
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
        if (!selectedAssetDetail) {
            return null;
        }

        const hasChanges =
            editDraft.name.trim() !== selectedAssetDetail.name ||
            editDraft.description !== selectedAssetDetail.description ||
            editDraft.content !== selectedAssetDetail.currentVersion.content;

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
                                value={editDraft.changeNote}
                                onChange={(event) =>
                                    setEditDraft((current) => ({ ...current, changeNote: event.target.value }))
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
                            {selectedAssetDetail.status === 'archived'
                                ? '归档资产不能新增版本，请先恢复。'
                                : hasChanges
                                  ? '检测到改动，将创建新版本。'
                                  : '没有检测到内容变更。'}
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setView('detail')}
                                className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--muted)]"
                            >
                                取消
                            </button>
                            <button
                                onClick={() => void handleSaveNewVersion()}
                                disabled={
                                    selectedAssetDetail.status === 'archived' ||
                                    !hasChanges ||
                                    !editDraft.name.trim() ||
                                    !editDraft.content.trim() ||
                                    pendingAction === 'saveVersion'
                                }
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
        if (!selectedAssetDetail) {
            return null;
        }

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
                    {historyError ? (
                        <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-6 py-8 text-center shadow-sm dark:border-rose-900/60 dark:bg-rose-950/30">
                            <h3 className="text-lg font-semibold text-rose-800 dark:text-rose-200">版本历史加载失败</h3>
                            <p className="mt-2 text-sm leading-6 text-rose-700/90 dark:text-rose-200/80">
                                {historyError}
                            </p>
                            <button
                                onClick={() =>
                                    void loadAssetHistory(
                                        selectedAssetDetail.id,
                                        historyVersionId ?? selectedAssetDetail.currentVersion.id
                                    )
                                }
                                className="mt-5 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
                            >
                                重试
                            </button>
                        </div>
                    ) : pendingAction === 'loadHistory' && versions.length === 0 ? (
                        <div className="space-y-3">
                            {Array.from({ length: 4 }).map((_, index) => (
                                <div
                                    key={`history-skeleton-${index}`}
                                    className="h-20 animate-pulse rounded-[22px] bg-[var(--muted)]"
                                />
                            ))}
                        </div>
                    ) : (
                        <>
                            <div className="space-y-3">
                                {versions.map((version) => (
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
                                                        v{version.versionNumber}
                                                    </span>
                                                    {version.id === selectedAssetDetail.currentVersion.id && (
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
                                                {version.changeNote || '无版本说明'}
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
                                                v{selectedHistoryVersion.versionNumber}
                                            </h4>
                                            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                                                {selectedHistoryVersion.changeNote || '未填写版本说明'}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setShowRestoreConfirm(true)}
                                            disabled={
                                                selectedHistoryVersion.id === selectedAssetDetail.currentVersion.id ||
                                                selectedAssetDetail.status === 'archived'
                                            }
                                            className="rounded-full bg-[var(--asset-primary)] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-950/15 disabled:cursor-not-allowed disabled:opacity-45"
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
                                                {selectedHistoryVersion.descriptionSnapshot || '未填写描述'}
                                            </p>
                                        </div>
                                        <pre className="whitespace-pre-wrap rounded-[22px] bg-[var(--asset-preview-bg)] p-4 font-mono text-[13px] leading-6 text-[var(--foreground)]">
                                            {selectedHistoryVersion.content}
                                        </pre>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        );
    };

    const toastToneClass =
        toast?.tone === 'error'
            ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/70 dark:text-rose-100'
            : toast?.tone === 'info'
              ? 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-100'
              : 'border-white/70 bg-white/90 text-[var(--foreground)] dark:bg-slate-900/80';

    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
            <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--asset-primary)]">
                            Prompt Assets
                        </p>
                        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
                            提示词资产库
                        </h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
                            资产是模板来源，项目里的 System Prompt 是当前工作副本。这里集中完成浏览、沉淀、版本管理和应用。
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <div className="max-w-[320px] truncate rounded-full border border-white/60 bg-white/75 px-4 py-2 text-sm text-[var(--muted-foreground)] shadow-sm dark:bg-slate-900/50">
                            {currentProject ? `当前项目：${currentProject.meta.name}` : '当前未选择项目，仅浏览资产'}
                        </div>
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/80 px-4 py-2 text-sm font-medium text-[var(--foreground)] shadow-sm hover:bg-white dark:bg-slate-900/50"
                        >
                            <ArrowLeft size={15} />
                            返回编辑器
                        </Link>
                    </div>
                </div>

                <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[32px] border border-white/60 bg-[var(--asset-drawer-bg)] shadow-2xl shadow-cyan-950/15 backdrop-blur-xl">
                    <div className="border-b border-white/60 bg-[var(--asset-header-bg)] px-5 pb-5 pt-6 sm:px-6">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--asset-primary)]">
                                    Library Workspace
                                </p>
                                <h2 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                                    {view === 'list' ? '浏览和管理资产' : '资产详情与版本'}
                                </h2>
                                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
                                    {view === 'list'
                                        ? '搜索、筛选并整理可复用提示词，也可以从当前项目直接沉淀为资产。'
                                        : '查看当前版本、编辑新版本、恢复历史版本，或把资产应用回项目。'}
                                </p>
                            </div>
                            <Link
                                href="/"
                                className="hidden rounded-full border border-white/60 bg-white/70 p-2 text-[var(--muted-foreground)] shadow-sm hover:bg-white dark:bg-slate-900/50 sm:inline-flex"
                                aria-label="返回编辑器"
                            >
                                <X size={16} />
                            </Link>
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
                                        placeholder="搜索资产名称"
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
                                        {currentProject?.systemPrompt.trim() ? '从当前 Prompt 新建' : '新建资产'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-hidden">
                        {view === 'list' && <div className="h-full overflow-y-auto px-5 py-5 sm:px-6">{renderListState()}</div>}
                        {view === 'detail' && renderDetailState()}
                        {view === 'edit' && renderEditState()}
                        {view === 'history' && renderHistoryState()}
                    </div>

                    {toast && (
                        <div
                            className={`pointer-events-none absolute bottom-5 left-1/2 z-20 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-full border px-4 py-3 text-sm font-medium shadow-xl shadow-slate-900/10 backdrop-blur ${toastToneClass}`}
                        >
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
                                    value={saveDraft.changeNote}
                                    onChange={(event) =>
                                        setSaveDraft((current) => ({ ...current, changeNote: event.target.value }))
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
                                    onClick={() => void handleCreateAsset()}
                                    disabled={
                                        !saveDraft.name.trim() ||
                                        !saveDraft.content.trim() ||
                                        pendingAction === 'create'
                                    }
                                    className="rounded-full bg-[var(--asset-primary)] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-950/15 disabled:cursor-not-allowed disabled:opacity-45"
                                >
                                    创建资产
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}

                    {showApplyConfirm && selectedAssetDetail && (
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
                                即将应用资产「{selectedAssetDetail.name}」v
                                {selectedAssetDetail.currentVersion.versionNumber}。
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

                    {showRestoreConfirm && selectedHistoryVersion && selectedAssetDetail && (
                    <Modal
                        title="恢复这个版本？"
                        description="系统会基于该历史版本创建一个新的当前版本，原有历史不会丢失。"
                        onClose={() => setShowRestoreConfirm(false)}
                    >
                        <div className="px-5 py-5">
                            <div className="rounded-[24px] border border-white/60 bg-[var(--asset-preview-bg)] p-4 shadow-sm">
                                <p className="text-sm font-semibold text-[var(--foreground)]">
                                    即将恢复 v{selectedHistoryVersion.versionNumber}
                                </p>
                                <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                                    {selectedHistoryVersion.changeNote || '未填写版本说明'}
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
                                onClick={() => void handleRestoreVersion()}
                                disabled={
                                    pendingAction === 'restore' || selectedAssetDetail.status === 'archived'
                                }
                                className="rounded-full bg-[var(--asset-primary)] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-950/15 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                                恢复并生成新版本
                            </button>
                        </div>
                    </Modal>
                    )}
                </div>
            </div>
        </div>
    );
}
