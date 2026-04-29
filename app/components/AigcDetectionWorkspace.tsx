'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    ArrowLeft,
    FileSearch,
    LoaderCircle,
    RefreshCw,
    Search,
    Sparkles,
    Upload,
    X,
} from 'lucide-react';
import {
    AigcDetectionApiError,
    createAigcDetectionTask,
    getAigcDetectionTaskDetail,
    getAigcDetectionTaskResult,
    listAigcDetectionTasks,
    retryAigcDetectionTask,
    type ListAigcDetectionTasksParams,
} from '../lib/aigc-detection/browser-client';
import type {
    AigcDetectionResultDto,
    AigcDetectionTaskDetail,
    AigcDetectionTaskStatus,
    AigcDetectionTaskSummary,
} from '../lib/aigc-detection/dto';
import { getCurrentSession } from '../lib/workspaces/client';
import { buildWorkspaceModulePath } from '../lib/workspace-routing';

type TaskFilter = 'all' | 'processing' | 'succeeded' | 'failed';

const pollingStatuses: AigcDetectionTaskStatus[] = ['queued_local', 'submitted', 'processing'];
const supportedExtensions = ['pdf', 'doc', 'docx'];
const uploadLimitText = '支持 pdf / doc / docx，单文件大小以内网配置上限为准。';

function formatDateTime(value: number | null) {
    if (!value) {
        return '暂无';
    }

    return new Intl.DateTimeFormat('zh-CN', {
        hour12: false,
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value));
}

function formatFileSize(size: number) {
    if (size < 1024) {
        return `${size} B`;
    }

    if (size < 1024 * 1024) {
        return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatPercent(value: number | null) {
    if (value === null) {
        return '--';
    }

    const normalized = value <= 1 ? value * 100 : value;
    return `${Math.round(normalized)}%`;
}

function truncateSha256(value: string) {
    if (value.length <= 12) {
        return value;
    }

    return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function getStatusMeta(status: AigcDetectionTaskStatus) {
    switch (status) {
        case 'queued_local':
            return { label: '准备提交', className: 'border-slate-200 bg-slate-50 text-slate-700' };
        case 'submit_failed':
            return { label: '提交失败', className: 'border-rose-200 bg-rose-50 text-rose-700' };
        case 'submitted':
            return { label: '已提交', className: 'border-sky-200 bg-sky-50 text-sky-700' };
        case 'processing':
            return { label: '检测中', className: 'border-cyan-200 bg-cyan-50 text-cyan-700' };
        case 'succeeded':
            return { label: '已完成', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
        case 'failed':
            return { label: '检测失败', className: 'border-amber-200 bg-amber-50 text-amber-800' };
        default:
            return { label: status, className: 'border-slate-200 bg-slate-50 text-slate-700' };
    }
}

function getRiskBadgeClass(riskLevel: 'high' | 'medium' | 'low' | 'unknown') {
    if (riskLevel === 'high') {
        return 'border-rose-200 bg-rose-50 text-rose-700';
    }

    if (riskLevel === 'medium') {
        return 'border-amber-200 bg-amber-50 text-amber-800';
    }

    if (riskLevel === 'low') {
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    }

    return 'border-slate-200 bg-slate-50 text-slate-700';
}

function getRiskLevel(score: number | null): 'high' | 'medium' | 'low' | 'unknown' {
    if (score === null) {
        return 'unknown';
    }

    if (score >= 0.75) {
        return 'high';
    }

    if (score >= 0.45) {
        return 'medium';
    }

    return 'low';
}

function getTaskErrorMessage(error: unknown, fallback: string) {
    if (error instanceof AigcDetectionApiError) {
        switch (error.code) {
            case 'AIGC_DETECTION_FILE_TOO_LARGE':
                return '文件超过系统允许的大小上限，请压缩后重试。';
            case 'AIGC_DETECTION_UNSUPPORTED_FILE_TYPE':
                return '当前只支持上传 pdf、doc 或 docx 文件。';
            case 'AIGC_DETECTION_FORBIDDEN':
                return '当前工作区没有执行该操作的权限。';
            case 'AIGC_DETECTION_TASK_NOT_COMPLETED':
                return '检测结果尚未完成，请稍后再试。';
            default:
                return error.message || fallback;
        }
    }

    if (error instanceof Error && error.message) {
        return error.message;
    }

    return fallback;
}

function SearchField({
    defaultValue,
    onSubmit,
}: {
    defaultValue: string;
    onSubmit: (value: string) => void;
}) {
    const [value, setValue] = useState(defaultValue);

    useEffect(() => {
        setValue(defaultValue);
    }, [defaultValue]);

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                onSubmit(value.trim());
            }}
            className="flex w-full items-center gap-2 rounded-full border border-white/70 bg-white/80 px-4 py-2 shadow-sm shadow-slate-900/5 sm:max-w-sm"
        >
            <Search size={16} className="text-slate-400" />
            <input
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="按文件名搜索"
                className="w-full border-0 bg-transparent p-0 text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
        </form>
    );
}

function UploadModal({
    canUpload,
    isSubmitting,
    selectedFile,
    uploadError,
    isForceReprocess,
    onClose,
    onFileChange,
    onToggleForceReprocess,
    onSubmit,
}: {
    canUpload: boolean;
    isSubmitting: boolean;
    selectedFile: File | null;
    uploadError: string | null;
    isForceReprocess: boolean;
    onClose: () => void;
    onFileChange: (file: File | null) => void;
    onToggleForceReprocess: (nextValue: boolean) => void;
    onSubmit: () => void;
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
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/30 p-3 backdrop-blur-[2px] sm:items-center sm:p-6"
            onClick={onClose}
        >
            <div
                className="w-full max-w-xl rounded-[28px] border border-white/60 bg-[var(--card-bg)] shadow-2xl shadow-slate-900/20"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-start justify-between border-b border-[var(--border)] px-5 py-4">
                    <div>
                        <h2 className="text-lg font-semibold text-[var(--foreground)]">上传文件并开始检测</h2>
                        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                            检测任务会在后台异步执行，大文件通常需要更长时间。
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
                        aria-label="关闭上传窗口"
                    >
                        <X size={16} />
                    </button>
                </div>
                <div className="space-y-5 px-5 py-5">
                    <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 p-4">
                        <label className="flex cursor-pointer flex-col gap-3">
                            <span className="text-sm font-medium text-slate-700">上传文件</span>
                            <input
                                type="file"
                                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
                                className="text-sm text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                                disabled={!canUpload || isSubmitting}
                            />
                        </label>
                        <p className="mt-3 text-xs leading-6 text-slate-500">{uploadLimitText}</p>
                        {selectedFile ? (
                            <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                                <div className="font-medium text-slate-900">{selectedFile.name}</div>
                                <div className="mt-1 text-xs text-slate-500">
                                    {selectedFile.type || '未知类型'} · {formatFileSize(selectedFile.size)}
                                </div>
                            </div>
                        ) : null}
                        {uploadError ? (
                            <div className="mt-4 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                                <span>{uploadError}</span>
                            </div>
                        ) : null}
                    </div>
                    <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
                        <input
                            type="checkbox"
                            checked={isForceReprocess}
                            onChange={(event) => onToggleForceReprocess(event.target.checked)}
                            disabled={!canUpload || isSubmitting}
                            className="mt-1 h-4 w-4 rounded border-slate-300"
                        />
                        <span>
                            强制重新检测
                            <span className="mt-1 block text-xs leading-5 text-slate-500">
                                勾选后即使命中历史哈希，也会重新走一次外部检测流程。
                            </span>
                        </span>
                    </label>
                </div>
                <div className="flex justify-end gap-3 border-t border-[var(--border)] px-5 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                    >
                        取消
                    </button>
                    <button
                        type="button"
                        onClick={onSubmit}
                        disabled={!canUpload || !selectedFile || isSubmitting}
                        className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
                    >
                        {isSubmitting ? <LoaderCircle size={15} className="animate-spin" /> : <Upload size={15} />}
                        {isSubmitting ? '正在提交' : '开始检测'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function TaskListPage({ workspaceSlug }: { workspaceSlug: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const filter = (searchParams.get('status') as TaskFilter | null) ?? 'all';
    const keyword = searchParams.get('keyword') ?? '';
    const [tasks, setTasks] = useState<AigcDetectionTaskSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [canUpload, setCanUpload] = useState(true);
    const [permissionHint, setPermissionHint] = useState<string | null>(null);
    const [isForceReprocess, setIsForceReprocess] = useState(false);

    const requestParams = useMemo<ListAigcDetectionTasksParams>(() => {
        return {
            page: 1,
            pageSize: 20,
            status: filter === 'failed' ? 'failed' : filter === 'processing' ? 'processing' : filter === 'succeeded' ? 'succeeded' : 'all',
            keyword,
        };
    }, [filter, keyword]);

    useEffect(() => {
        let cancelled = false;

        async function loadSession() {
            try {
                const session = await getCurrentSession(workspaceSlug);

                if (cancelled) {
                    return;
                }

                const writable = session.permissions.includes('aigc_detection:write');
                setCanUpload(writable);
                setPermissionHint(writable ? null : '当前账号只有查看权限，不能上传或重试检测任务。');
            } catch {
                if (cancelled) {
                    return;
                }

                setCanUpload(false);
                setPermissionHint('无法确认当前工作区权限，已暂时禁用上传。');
            }
        }

        void loadSession();

        return () => {
            cancelled = true;
        };
    }, [workspaceSlug]);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setIsLoading(true);
            setListError(null);

            try {
                const data = await listAigcDetectionTasks(workspaceSlug, requestParams);

                if (cancelled) {
                    return;
                }

                setTasks(data.items);
            } catch (error) {
                if (cancelled) {
                    return;
                }

                setListError(getTaskErrorMessage(error, '任务列表加载失败，请稍后再试。'));
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        }

        void load();

        return () => {
            cancelled = true;
        };
    }, [requestParams, workspaceSlug]);

    useEffect(() => {
        if (!tasks.some((task) => pollingStatuses.includes(task.status))) {
            return;
        }

        const timeoutId = window.setTimeout(async () => {
            try {
                const data = await listAigcDetectionTasks(workspaceSlug, requestParams);
                setTasks(data.items);
            } catch {
                // Polling failures should not tear down the screen.
            }
        }, 5000);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [requestParams, tasks, workspaceSlug]);

    function updateSearch(nextFilter: TaskFilter, nextKeyword: string) {
        const params = new URLSearchParams();

        if (nextFilter !== 'all') {
            params.set('status', nextFilter);
        }

        if (nextKeyword) {
            params.set('keyword', nextKeyword);
        }

        const query = params.toString();
        router.push(
            query ? `${buildWorkspaceModulePath(workspaceSlug, 'aigc-detection')}?${query}` : buildWorkspaceModulePath(workspaceSlug, 'aigc-detection'),
            { scroll: false }
        );
    }

    function validateFile(file: File | null) {
        if (!file) {
            return '请选择需要检测的文件。';
        }

        const extension = file.name.split('.').pop()?.toLowerCase() ?? '';

        if (!supportedExtensions.includes(extension)) {
            return '当前只支持上传 pdf、doc 或 docx 文件。';
        }

        return null;
    }

    async function handleUploadSubmit() {
        if (!canUpload) {
            setUploadError(permissionHint ?? '当前工作区没有上传权限。');
            return;
        }

        const validationMessage = validateFile(selectedFile);

        if (validationMessage) {
            setUploadError(validationMessage);
            return;
        }

        if (!selectedFile) {
            return;
        }

        setIsSubmitting(true);
        setUploadError(null);

        try {
            const data = await createAigcDetectionTask(workspaceSlug, {
                file: selectedFile,
                forceReprocess: isForceReprocess,
            });

            setIsUploadOpen(false);
            setSelectedFile(null);
            setIsForceReprocess(false);
            router.push(
                `${buildWorkspaceModulePath(workspaceSlug, 'aigc-detection')}/tasks/${encodeURIComponent(data.task.id)}${
                    keyword || filter !== 'all' || data.reusedResult
                        ? `?${new URLSearchParams({
                              ...(filter !== 'all' ? { status: filter } : {}),
                              ...(keyword ? { keyword } : {}),
                              ...(data.reusedResult ? { reused: '1' } : {}),
                          }).toString()}`
                        : ''
                }`
            );
        } catch (error) {
            setUploadError(getTaskErrorMessage(error, '任务提交失败，请稍后重试。'));
        } finally {
            setIsSubmitting(false);
        }
    }

    const activeCount = tasks.filter((task) => pollingStatuses.includes(task.status)).length;

    return (
        <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
            <section className="overflow-hidden rounded-[32px] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(239,246,255,0.78))] p-6 shadow-[0_32px_90px_-48px_rgba(15,23,42,0.48)] backdrop-blur">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold tracking-[0.12em] text-cyan-800 uppercase">
                            <FileSearch size={14} />
                            Task Center
                        </div>
                        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                            AIGC 检测
                        </h1>
                        <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
                            上传文档后，系统会异步计算文本的 AIGC 率与检测明细。任务会保留在当前工作区，便于后续查看与重试。
                        </p>
                        <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
                            <span className="rounded-full border border-white/70 bg-white/75 px-3 py-1.5">当前工作区：{workspaceSlug}</span>
                            <span className="rounded-full border border-white/70 bg-white/75 px-3 py-1.5">{uploadLimitText}</span>
                            <span className="rounded-full border border-white/70 bg-white/75 px-3 py-1.5">检测中任务 {activeCount} 个</span>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                setUploadError(null);
                                setIsUploadOpen(true);
                            }}
                            disabled={!canUpload}
                            className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-950/10 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                            <Upload size={15} />
                            上传文件并开始检测
                        </button>
                    </div>
                </div>
                {permissionHint ? (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        {permissionHint}
                    </div>
                ) : null}
            </section>

            <section className="mt-6 rounded-[30px] border border-white/70 bg-white/80 p-4 shadow-[0_24px_64px_-52px_rgba(15,23,42,0.5)] backdrop-blur sm:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap gap-2">
                        {(['all', 'processing', 'succeeded', 'failed'] as TaskFilter[]).map((item) => {
                            const isActive = item === filter;
                            const label =
                                item === 'all'
                                    ? '全部'
                                    : item === 'processing'
                                      ? '检测中'
                                      : item === 'succeeded'
                                        ? '已完成'
                                        : '失败';

                            return (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => updateSearch(item, keyword)}
                                    className={`rounded-full px-4 py-2 text-sm font-semibold ${
                                        isActive
                                            ? 'bg-slate-950 text-white'
                                            : 'border border-slate-200 bg-white text-slate-600'
                                    }`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                    <SearchField defaultValue={keyword} onSubmit={(value) => updateSearch(filter, value)} />
                </div>
            </section>

            {listError ? (
                <section className="mt-6 rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
                    {listError}
                </section>
            ) : null}

            <section className="mt-6">
                {isLoading ? (
                    <div className="flex min-h-56 items-center justify-center rounded-[30px] border border-white/70 bg-white/80 text-slate-500 shadow-[0_24px_64px_-52px_rgba(15,23,42,0.5)]">
                        <LoaderCircle size={18} className="mr-2 animate-spin" />
                        正在读取检测任务
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="rounded-[30px] border border-dashed border-slate-300 bg-white/70 px-6 py-14 text-center shadow-[0_24px_64px_-52px_rgba(15,23,42,0.5)]">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[linear-gradient(135deg,#0f766e_0%,#2563eb_100%)] text-white shadow-lg shadow-cyan-950/15">
                            <Sparkles size={26} />
                        </div>
                        <h2 className="mt-5 text-2xl font-semibold text-slate-950">还没有检测任务</h2>
                        <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-600">
                            上传 pdf、doc 或 docx 文件后，系统会在后台完成检测并生成结果。检测结果会保存在当前工作区任务记录中。
                        </p>
                        <button
                            type="button"
                            onClick={() => setIsUploadOpen(true)}
                            disabled={!canUpload}
                            className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
                        >
                            <Upload size={15} />
                            上传第一个文件
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {tasks.map((task) => {
                            const statusMeta = getStatusMeta(task.status);
                            const detailQuery = new URLSearchParams();

                            if (filter !== 'all') {
                                detailQuery.set('status', filter);
                            }

                            if (keyword) {
                                detailQuery.set('keyword', keyword);
                            }

                            const href = `${buildWorkspaceModulePath(workspaceSlug, 'aigc-detection')}/tasks/${encodeURIComponent(task.id)}${
                                detailQuery.toString() ? `?${detailQuery.toString()}` : ''
                            }`;

                            return (
                                <Link
                                    key={task.id}
                                    href={href}
                                    className="group overflow-hidden rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-[0_24px_64px_-52px_rgba(15,23,42,0.5)] backdrop-blur hover:-translate-y-0.5 hover:shadow-[0_30px_80px_-50px_rgba(15,23,42,0.46)]"
                                >
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusMeta.className}`}>
                                                    {statusMeta.label}
                                                </span>
                                                {task.deduplicated ? (
                                                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                                                        已复用历史结果
                                                    </span>
                                                ) : null}
                                            </div>
                                            <h2 className="mt-3 truncate text-xl font-semibold text-slate-950">
                                                {task.sourceFileName}
                                            </h2>
                                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500">
                                                <span>{task.sourceFileExt.toUpperCase()}</span>
                                                <span>{formatFileSize(task.sourceFileSize)}</span>
                                                <span>创建于 {formatDateTime(task.createdAt)}</span>
                                                <span>SHA256 {truncateSha256(task.sourceFileSha256)}</span>
                                            </div>
                                            {task.errorMessage ? (
                                                <p className="mt-3 text-sm text-rose-700">{task.errorMessage}</p>
                                            ) : null}
                                        </div>
                                        <div className="grid min-w-[220px] gap-3 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 text-sm">
                                            <div>
                                                <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                                                    AIGC 率
                                                </div>
                                                <div className="mt-1 text-2xl font-semibold text-slate-950">
                                                    {formatPercent(task.overallScore)}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                                                    最新进度
                                                </div>
                                                <div className="mt-1 text-slate-700">
                                                    {task.progressCurrent !== null && task.progressTotal !== null
                                                        ? `${task.progressCurrent} / ${task.progressTotal} ${task.progressUnit ?? ''}`.trim()
                                                        : statusMeta.label}
                                                </div>
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                最后更新时间 {formatDateTime(task.updatedAt)}
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </section>

            {isUploadOpen ? (
                <UploadModal
                    canUpload={canUpload}
                    isSubmitting={isSubmitting}
                    selectedFile={selectedFile}
                    uploadError={uploadError}
                    isForceReprocess={isForceReprocess}
                    onClose={() => {
                        if (isSubmitting) {
                            return;
                        }

                        setIsUploadOpen(false);
                    }}
                    onFileChange={(file) => {
                        setSelectedFile(file);
                        setUploadError(validateFile(file));
                    }}
                    onToggleForceReprocess={setIsForceReprocess}
                    onSubmit={() => {
                        void handleUploadSubmit();
                    }}
                />
            ) : null}
        </main>
    );
}

function TaskDetailPage({
    workspaceSlug,
    taskId,
}: {
    workspaceSlug: string;
    taskId: string;
}) {
    const searchParams = useSearchParams();
    const listStatus = searchParams.get('status');
    const listKeyword = searchParams.get('keyword');
    const reusedResult = searchParams.get('reused') === '1';
    const [task, setTask] = useState<AigcDetectionTaskDetail | null>(null);
    const [result, setResult] = useState<AigcDetectionResultDto | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [isRetrying, setIsRetrying] = useState(false);

    const backHref = useMemo(() => {
        const query = new URLSearchParams();

        if (listStatus) {
            query.set('status', listStatus);
        }

        if (listKeyword) {
            query.set('keyword', listKeyword);
        }

        const basePath = buildWorkspaceModulePath(workspaceSlug, 'aigc-detection');
        return query.toString() ? `${basePath}?${query.toString()}` : basePath;
    }, [listKeyword, listStatus, workspaceSlug]);

    async function loadTask(showRefreshState = false) {
        if (showRefreshState) {
            setIsRefreshing(true);
        } else {
            setIsLoading(true);
        }

        setError(null);
        setActionError(null);

        try {
            const detail = await getAigcDetectionTaskDetail(workspaceSlug, taskId);
            setTask(detail.task);

            if (detail.task.status === 'succeeded') {
                try {
                    const nextResult = await getAigcDetectionTaskResult(workspaceSlug, taskId);
                    setResult(nextResult);
                } catch (resultError) {
                    setActionError(getTaskErrorMessage(resultError, '结果读取失败，请稍后重试。'));
                }
            } else {
                setResult(null);
            }
        } catch (loadError) {
            setError(getTaskErrorMessage(loadError, '任务详情加载失败，请稍后重试。'));
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }

    useEffect(() => {
        void loadTask();
    }, [taskId, workspaceSlug]);

    useEffect(() => {
        if (!task || !pollingStatuses.includes(task.status)) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            void loadTask(true);
        }, 5000);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [task, workspaceSlug, taskId]);

    async function handleRetry() {
        setIsRetrying(true);
        setActionError(null);

        try {
            const data = await retryAigcDetectionTask(workspaceSlug, taskId);
            setTask(data.task);
            setResult(null);
        } catch (retryError) {
            setActionError(getTaskErrorMessage(retryError, '重试失败，请稍后再试。'));
        } finally {
            setIsRetrying(false);
        }
    }

    if (isLoading) {
        return (
            <main className="mx-auto flex min-h-[60vh] max-w-[1500px] items-center justify-center px-4 py-6 text-slate-500 sm:px-6 lg:px-8">
                <LoaderCircle size={18} className="mr-2 animate-spin" />
                正在读取任务详情
            </main>
        );
    }

    if (error || !task) {
        return (
            <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
                <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
                    {error ?? '任务不存在或已失效。'}
                </div>
                <Link
                    href={backHref}
                    className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-700"
                >
                    <ArrowLeft size={16} />
                    返回任务列表
                </Link>
            </main>
        );
    }

    const statusMeta = getStatusMeta(task.status);
    const progressPercent =
        task.progressCurrent !== null && task.progressTotal ? Math.min((task.progressCurrent / task.progressTotal) * 100, 100) : null;

    return (
        <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
            <section className="rounded-[32px] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(244,251,255,0.8))] p-6 shadow-[0_32px_90px_-48px_rgba(15,23,42,0.48)]">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                        <Link href={backHref} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
                            <ArrowLeft size={16} />
                            返回任务列表
                        </Link>
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusMeta.className}`}>
                                {statusMeta.label}
                            </span>
                            {task.deduplicated ? (
                                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                                    已复用历史检测结果
                                </span>
                            ) : null}
                        </div>
                        <h1 className="mt-4 truncate text-3xl font-semibold tracking-tight text-slate-950">
                            {task.sourceFileName}
                        </h1>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500">
                            <span>创建于 {formatDateTime(task.createdAt)}</span>
                            <span>提交于 {formatDateTime(task.submittedAt)}</span>
                            <span>最近同步 {formatDateTime(task.lastSyncedAt)}</span>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                void loadTask(true);
                            }}
                            disabled={isRefreshing}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-45"
                        >
                            {isRefreshing ? <LoaderCircle size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                            刷新状态
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                void handleRetry();
                            }}
                            disabled={!task.canRetry || isRetrying}
                            className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
                        >
                            {isRetrying ? <LoaderCircle size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                            重试
                        </button>
                    </div>
                </div>
            </section>

            {reusedResult ? (
                <section className="mt-6 rounded-[28px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">
                    检测结果已复用，无需重复等待。
                </section>
            ) : null}

            {actionError ? (
                <section className="mt-6 rounded-[28px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
                    {actionError}
                </section>
            ) : null}

            <section className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr_0.9fr]">
                <article className="rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-[0_24px_64px_-52px_rgba(15,23,42,0.5)]">
                    <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">文件信息</div>
                    <dl className="mt-4 grid gap-4 text-sm text-slate-600 sm:grid-cols-2">
                        <div>
                            <dt className="text-xs uppercase tracking-[0.16em] text-slate-400">类型</dt>
                            <dd className="mt-1 font-medium text-slate-900">{task.sourceFileExt.toUpperCase()}</dd>
                        </div>
                        <div>
                            <dt className="text-xs uppercase tracking-[0.16em] text-slate-400">大小</dt>
                            <dd className="mt-1 font-medium text-slate-900">{formatFileSize(task.sourceFileSize)}</dd>
                        </div>
                        <div>
                            <dt className="text-xs uppercase tracking-[0.16em] text-slate-400">SHA256</dt>
                            <dd className="mt-1 font-medium text-slate-900">{truncateSha256(task.sourceFileSha256)}</dd>
                        </div>
                        <div>
                            <dt className="text-xs uppercase tracking-[0.16em] text-slate-400">重试次数</dt>
                            <dd className="mt-1 font-medium text-slate-900">{task.retryCount}</dd>
                        </div>
                    </dl>
                </article>

                <article className="rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-[0_24px_64px_-52px_rgba(15,23,42,0.5)]">
                    <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">任务进度</div>
                    <div className="mt-4 text-2xl font-semibold text-slate-950">{statusMeta.label}</div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                        {task.status === 'submitted'
                            ? '已提交，等待检测服务开始处理。'
                            : task.status === 'processing'
                              ? '正在检测内容，完成后会自动刷新结果。'
                              : task.status === 'succeeded'
                                ? '检测已完成，可以查看摘要和明细。'
                                : task.status === 'submit_failed' || task.status === 'failed'
                                  ? task.errorMessage ?? '检测任务未成功完成，可尝试重新提交。'
                                  : '任务正在准备提交至检测服务。'}
                    </p>
                    {progressPercent !== null ? (
                        <div className="mt-4">
                            <div className="h-2 rounded-full bg-slate-100">
                                <div
                                    className="h-2 rounded-full bg-[linear-gradient(90deg,#0891b2_0%,#2563eb_100%)]"
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                            <div className="mt-2 text-sm text-slate-500">
                                {task.progressCurrent} / {task.progressTotal} {task.progressUnit ?? ''}
                            </div>
                        </div>
                    ) : null}
                </article>

                <article className="rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-[0_24px_64px_-52px_rgba(15,23,42,0.5)]">
                    <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">错误与提示</div>
                    <div className="mt-4 text-sm leading-7 text-slate-600">
                        {task.errorMessage ? task.errorMessage : task.deduplicated ? '该任务命中了历史结果复用，可直接查看现有检测输出。' : '当前没有需要处理的异常信息。'}
                    </div>
                </article>
            </section>

            <section className="mt-6 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                <article className="rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-[0_24px_64px_-52px_rgba(15,23,42,0.5)]">
                    <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">检测结果摘要</div>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                            <div className="text-xs uppercase tracking-[0.16em] text-slate-400">AIGC 率</div>
                            <div className="mt-2 text-4xl font-semibold text-slate-950">
                                {formatPercent(result?.overallScore ?? task.overallScore)}
                            </div>
                        </div>
                        <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                            <div className="text-xs uppercase tracking-[0.16em] text-slate-400">人工撰写倾向</div>
                            <div className="mt-2 text-4xl font-semibold text-slate-950">
                                {formatPercent(result?.humanScore ?? null)}
                            </div>
                        </div>
                    </div>
                    <div className="mt-5 rounded-[24px] border border-slate-200 bg-white p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-slate-400">结果结论</div>
                        <p className="mt-2 text-sm leading-7 text-slate-700">
                            {result?.summary ?? '任务完成后会在这里展示检测摘要。'}
                        </p>
                    </div>
                    <div className="mt-4 text-xs text-slate-500">
                        完成时间 {formatDateTime(result?.completedAt ?? task.completedAt)}
                    </div>
                </article>

                <article className="rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-[0_24px_64px_-52px_rgba(15,23,42,0.5)]">
                    <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">分段明细</div>
                    {result?.segments.length ? (
                        <div className="mt-4 max-h-[720px] space-y-3 overflow-y-auto pr-1">
                            {result.segments.map((segment) => (
                                <div key={segment.blockId} className="rounded-[22px] border border-slate-200 bg-slate-50/75 p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="text-sm font-semibold text-slate-900">片段 {segment.order + 1}</div>
                                        <div className="flex items-center gap-2">
                                            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getRiskBadgeClass(getRiskLevel(segment.aiProbability))}`}>
                                                {segment.label}
                                            </span>
                                            <span className="text-xs font-medium text-slate-500">
                                                分值 {formatPercent(segment.aiProbability)}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="mt-3 text-sm leading-7 text-slate-700">{segment.text}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 px-4 py-8 text-sm leading-7 text-slate-500">
                            {task.status === 'succeeded'
                                ? '当前结果没有返回可枚举的分段明细。'
                                : '任务完成后，这里会展示高风险片段和对应分值。'}
                        </div>
                    )}
                </article>
            </section>
        </main>
    );
}

export default function AigcDetectionWorkspace({ taskId = null }: { taskId?: string | null }) {
    const params = useParams<{ workspaceSlug?: string | string[] }>();
    const workspaceSlug = typeof params.workspaceSlug === 'string' ? params.workspaceSlug : '';

    if (!workspaceSlug) {
        return null;
    }

    return taskId ? <TaskDetailPage workspaceSlug={workspaceSlug} taskId={taskId} /> : <TaskListPage workspaceSlug={workspaceSlug} />;
}
