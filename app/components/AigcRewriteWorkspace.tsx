'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import {
    AlertCircle,
    BrainCircuit,
    CheckCircle2,
    ChevronDown,
    Copy,
    FilePenLine,
    LoaderCircle,
    PencilLine,
    RefreshCw,
    Save,
    Sparkles,
    Square,
    Trash2,
} from 'lucide-react';
import AutoResizeTextarea from './ui/AutoResizeTextarea';
import {
    AigcRewriteClientError,
    consumeAigcRewriteStream,
    listAigcRewritePresets,
    requestAigcRewriteStream,
    type AigcRewriteMetaEvent,
    type AigcRewritePresetSummary,
} from '../lib/aigc-rewrite/client';
import {
    countAigcRewriteSampleChars,
    createAigcRewriteStorageKey,
    createDefaultAigcRewriteDraft,
    evaluateAigcRewriteSampleQuality,
    getSavedAigcRewriteSample,
    mergeAigcRewriteDraft,
    normalizeAigcRewriteDraft,
} from '../lib/aigc-rewrite/draft';

const guideItems = [
    {
        title: '1. 先选未修改的原文',
        description: '优先选择一章或一段尚未修改过的正文，尽量在 1000 字以上，样本越完整越容易学到你的表达习惯。',
    },
    {
        title: '2. 先自己改写这段内容',
        description: '先不用系统，自己把这段原文用自己的语言重新修改一遍，尽量体现你真实的句式、衔接和表达节奏。',
    },
    {
        title: '3. 再把原文、改文和目标文本输入系统',
        description: '先录入原文和你修改后的版本作为样本，再粘贴需要改写的新内容，系统会按这个习惯继续改写。',
    },
];

const sampleTips = [
    '先选择一段未修改的正文，最好是一章或一段，尽量在 1000 字以上。',
    '先自己把这段内容改写一遍，再把原文和改写后的内容输入系统。',
    '样本前后需要有真实改写差异，不要只替换几个词。',
    '待改写文本的篇幅尽量和示例样本接近，这样通常更容易得到稳定结果。',
    '最后再粘贴需要改写的新文本，让 AI 按你的写法继续处理。',
];

function formatDateTime(value: string | null): string {
    if (!value) {
        return '未保存';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '未保存';
    }

    return date.toLocaleString('zh-CN', {
        hour12: false,
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getSampleStatusText(level: 'empty' | 'warning' | 'ready') {
    if (level === 'ready') {
        return '可直接使用';
    }

    if (level === 'warning') {
        return '可保存但建议优化';
    }

    return '不可用';
}

function getSampleSummaryText(level: 'empty' | 'warning' | 'ready') {
    if (level === 'ready') {
        return '可用于改写';
    }

    if (level === 'warning') {
        return '建议补充更多差异';
    }

    return '样本未完成';
}

function getPhaseText(phase: 'idle' | 'streaming' | 'succeeded' | 'stopped' | 'failed') {
    if (phase === 'streaming') {
        return '正在生成';
    }

    if (phase === 'succeeded') {
        return '已完成';
    }

    if (phase === 'stopped') {
        return '已停止';
    }

    if (phase === 'failed') {
        return '生成失败';
    }

    return '等待生成';
}

function getQualityPanelClass(level: 'empty' | 'warning' | 'ready') {
    if (level === 'ready') {
        return 'border-emerald-200 bg-emerald-50/90 text-emerald-900';
    }

    if (level === 'warning') {
        return 'border-amber-200 bg-amber-50/90 text-amber-900';
    }

    return 'border-slate-200 bg-slate-50/90 text-slate-700';
}

function getPhaseBadgeClass(phase: 'idle' | 'streaming' | 'succeeded' | 'stopped' | 'failed') {
    if (phase === 'streaming') {
        return 'border-cyan-200 bg-cyan-50 text-cyan-800';
    }

    if (phase === 'succeeded') {
        return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    }

    if (phase === 'stopped') {
        return 'border-amber-200 bg-amber-50 text-amber-800';
    }

    if (phase === 'failed') {
        return 'border-rose-200 bg-rose-50 text-rose-800';
    }

    return 'border-slate-200 bg-slate-50 text-slate-700';
}

function getThinkingPreview(thinkingText: string): string {
    const normalized = thinkingText.trim();

    if (!normalized) {
        return '';
    }

    const lines = normalized
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    const lastLine = lines.at(-1) ?? normalized;

    return lastLine.length > 72 ? `${lastLine.slice(0, 72)}...` : lastLine;
}

function readMessageFromError(error: unknown): string {
    if (error instanceof AigcRewriteClientError) {
        return error.message;
    }

    if (error instanceof Error) {
        return error.message;
    }

    return '改写请求失败，请稍后再试。';
}

export default function AigcRewriteWorkspace() {
    const params = useParams<{ workspaceSlug?: string | string[] }>();
    const workspaceSlug = typeof params.workspaceSlug === 'string' ? params.workspaceSlug : '';
    const [draft, setDraft] = useState(createDefaultAigcRewriteDraft);
    const [isHydrated, setIsHydrated] = useState(false);
    const [isGuideExpanded, setIsGuideExpanded] = useState(true);
    const [isEditingSample, setIsEditingSample] = useState(true);
    const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);
    const [copyState, setCopyState] = useState<'idle' | 'copied' | 'unsupported'>('idle');
    const [streamMeta, setStreamMeta] = useState<AigcRewriteMetaEvent | null>(null);
    const [presets, setPresets] = useState<AigcRewritePresetSummary[]>([]);
    const [isLoadingPresets, setIsLoadingPresets] = useState(false);
    const [presetError, setPresetError] = useState<string | null>(null);
    const [previousResultText, setPreviousResultText] = useState('');
    const [previousThinkingText, setPreviousThinkingText] = useState('');
    const abortControllerRef = useRef<AbortController | null>(null);
    const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const previousGenerationPhaseRef = useRef(draft.generationPhase);

    const sampleQuality = evaluateAigcRewriteSampleQuality(draft.sampleBefore, draft.sampleAfter);
    const savedSample = getSavedAigcRewriteSample(draft);
    const selectedPreset = draft.selectedPresetId
        ? presets.find((preset) => preset.id === draft.selectedPresetId) ?? {
              id: draft.selectedPresetId,
              name: draft.selectedPresetName ?? '已选预设模板',
              description: draft.selectedPresetDescription ?? '该模板的示例正文仅在服务端使用，不会返回到前端。',
              recommendedUsage: '',
          }
        : null;
    const hasActiveSampleSource = Boolean(selectedPreset || savedSample);
    const displayResultText = draft.resultText || previousResultText;
    const displayThinkingText = draft.thinkingText || previousThinkingText;
    const canSubmit = Boolean(hasActiveSampleSource && draft.targetText.trim() && draft.generationPhase !== 'streaming');
    const hasVisibleResult = displayResultText.trim().length > 0;
    const hasVisibleThinking = displayThinkingText.trim().length > 0;
    const hasLiveThinking = draft.thinkingText.trim().length > 0;
    const hasLiveOutput = draft.resultText.trim().length > 0;
    const sampleCharCount = savedSample ? countAigcRewriteSampleChars(savedSample) : 0;
    const primaryActionLabel = hasVisibleResult ? '再次生成' : '开始改写';
    const thinkingPreview = getThinkingPreview(draft.thinkingText);
    const currentSampleLevel = selectedPreset ? 'ready' : sampleQuality.level;

    useEffect(() => {
        if (previousGenerationPhaseRef.current === 'streaming' && draft.generationPhase !== 'streaming') {
            setIsThinkingExpanded(false);
        }

        previousGenerationPhaseRef.current = draft.generationPhase;
    }, [draft.generationPhase]);

    useEffect(() => {
        if (!workspaceSlug) {
            return;
        }

        let cancelled = false;

        async function loadPresets() {
            setIsLoadingPresets(true);
            setPresetError(null);

            try {
                const nextPresets = await listAigcRewritePresets(workspaceSlug);

                if (cancelled) {
                    return;
                }

                setPresets(nextPresets);

                if (draft.selectedPresetId) {
                    const matchedPreset = nextPresets.find((preset) => preset.id === draft.selectedPresetId);

                    if (matchedPreset) {
                        setDraft((current) =>
                            mergeAigcRewriteDraft(current, {
                                selectedPresetName: matchedPreset.name,
                                selectedPresetDescription: matchedPreset.description,
                            })
                        );
                    }
                }
            } catch (error) {
                if (cancelled) {
                    return;
                }

                setPresetError(readMessageFromError(error));
            } finally {
                if (!cancelled) {
                    setIsLoadingPresets(false);
                }
            }
        }

        void loadPresets();

        return () => {
            cancelled = true;
        };
    }, [workspaceSlug, draft.selectedPresetId]);

    useEffect(() => {
        if (!workspaceSlug) {
            setIsHydrated(true);
            return;
        }

        try {
            const stored = localStorage.getItem(createAigcRewriteStorageKey(workspaceSlug));
            const nextDraft = normalizeAigcRewriteDraft(stored ? JSON.parse(stored) as unknown : null);
            const nextSavedSample = getSavedAigcRewriteSample(nextDraft);

            setDraft(nextDraft);
            setIsEditingSample(nextSavedSample === null);
            setIsGuideExpanded(!nextDraft.hasSeenGuide || nextSavedSample === null);
        } catch {
            setDraft(createDefaultAigcRewriteDraft());
            setIsEditingSample(true);
            setIsGuideExpanded(true);
        } finally {
            setIsHydrated(true);
        }
    }, [workspaceSlug]);

    useEffect(() => {
        if (!isHydrated || !workspaceSlug) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            localStorage.setItem(createAigcRewriteStorageKey(workspaceSlug), JSON.stringify(draft));
        }, 120);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [draft, isHydrated, workspaceSlug]);

    useEffect(() => {
        return () => {
            abortControllerRef.current?.abort();

            if (copyTimerRef.current) {
                clearTimeout(copyTimerRef.current);
            }
        };
    }, []);

    function patchDraft(
        patch: Partial<Omit<typeof draft, 'sampleQualityLevel' | 'sampleQualityMessage' | 'updatedAt'>>
    ) {
        setDraft((current) => mergeAigcRewriteDraft(current, patch));
    }

    function resetCopyState() {
        if (copyTimerRef.current) {
            clearTimeout(copyTimerRef.current);
        }

        copyTimerRef.current = setTimeout(() => {
            setCopyState('idle');
        }, 1400);
    }

    async function handleSaveSample() {
        if (!sampleQuality.canSave) {
            patchDraft({ lastError: sampleQuality.message });
            return;
        }

        const savedAt = new Date().toISOString();
        patchDraft({
            sampleSavedAt: savedAt,
            savedSampleBefore: draft.sampleBefore.trim(),
            savedSampleAfter: draft.sampleAfter.trim(),
            selectedPresetId: null,
            selectedPresetName: null,
            selectedPresetDescription: null,
            hasSeenGuide: true,
            lastError: null,
        });
        setIsEditingSample(false);
        setIsGuideExpanded(false);
    }

    function handleEditSample() {
        if (savedSample) {
            patchDraft({
                sampleBefore: savedSample.before,
                sampleAfter: savedSample.after,
                selectedPresetId: null,
                selectedPresetName: null,
                selectedPresetDescription: null,
                lastError: null,
            });
        }

        setIsEditingSample(true);
    }

    function handleClearSample() {
        abortControllerRef.current?.abort();
        setPreviousResultText('');
        setPreviousThinkingText('');
        patchDraft({
            sampleBefore: '',
            sampleAfter: '',
            sampleSavedAt: null,
            savedSampleBefore: null,
            savedSampleAfter: null,
            generationPhase: draft.generationPhase === 'streaming' ? 'stopped' : draft.generationPhase,
            lastError: null,
        });
        setIsEditingSample(true);
        setIsGuideExpanded(true);
    }

    function handleSelectPreset(preset: AigcRewritePresetSummary) {
        patchDraft({
            selectedPresetId: preset.id,
            selectedPresetName: preset.name,
            selectedPresetDescription: preset.description,
            hasSeenGuide: true,
            lastError: null,
        });
        setIsEditingSample(false);
        setIsGuideExpanded(false);
    }

    function handleClearPreset() {
        patchDraft({
            selectedPresetId: null,
            selectedPresetName: null,
            selectedPresetDescription: null,
            lastError: null,
        });
        setIsEditingSample(savedSample === null);
    }

    function stopGeneration() {
        abortControllerRef.current?.abort();
    }

    async function startGeneration() {
        if (!hasActiveSampleSource) {
            patchDraft({ lastError: '请先完成步骤 1，保存手动样本或选择一个预设模板。' });
            return;
        }

        if (!draft.targetText.trim()) {
            patchDraft({ lastError: '请输入待改写文本。' });
            return;
        }

        abortControllerRef.current?.abort();

        const controller = new AbortController();
        abortControllerRef.current = controller;
        setStreamMeta(null);
        setIsThinkingExpanded(false);
        setPreviousResultText(draft.resultText);
        setPreviousThinkingText(draft.thinkingText);
        patchDraft({
            resultText: '',
            thinkingText: '',
            generationPhase: 'streaming',
            lastError: null,
            hasSeenGuide: true,
        });

        try {
            const response = await requestAigcRewriteStream(
                workspaceSlug,
                selectedPreset
                    ? {
                          presetId: selectedPreset.id,
                          targetText: draft.targetText.trim(),
                      }
                    : {
                          sampleBefore: savedSample?.before,
                          sampleAfter: savedSample?.after,
                          targetText: draft.targetText.trim(),
                      },
                controller.signal
            );

            await consumeAigcRewriteStream(
                response,
                {
                    onMeta: (payload) => {
                        setStreamMeta(payload);
                    },
                    onDelta: (payload) => {
                        if (payload.channel === 'output') {
                            setPreviousResultText('');
                            setDraft((current) =>
                                mergeAigcRewriteDraft(current, {
                                    resultText: current.resultText + payload.text,
                                    lastError: null,
                                })
                            );
                            return;
                        }

                        setPreviousThinkingText('');
                        setDraft((current) =>
                            mergeAigcRewriteDraft(current, {
                                thinkingText: current.thinkingText + payload.text,
                                lastError: null,
                            })
                        );
                    },
                    onDone: () => {
                        setDraft((current) =>
                            mergeAigcRewriteDraft(current, {
                                generationPhase: 'succeeded',
                                lastError: null,
                            })
                        );
                    },
                    onError: (payload) => {
                        setDraft((current) =>
                            mergeAigcRewriteDraft(current, {
                                generationPhase: 'failed',
                                lastError: payload.message,
                            })
                        );
                    },
                },
                controller.signal
            );

            if (!controller.signal.aborted) {
                setDraft((current) =>
                    current.generationPhase === 'streaming'
                        ? mergeAigcRewriteDraft(current, {
                              generationPhase: 'succeeded',
                              lastError: null,
                          })
                        : current
                );
            }
        } catch (error) {
            if (controller.signal.aborted) {
                setDraft((current) =>
                    mergeAigcRewriteDraft(current, {
                        generationPhase: 'stopped',
                        lastError: current.resultText ? null : '已停止生成，可继续重试。',
                    })
                );
                return;
            }

            patchDraft({
                generationPhase: 'failed',
                lastError: readMessageFromError(error),
            });
        } finally {
            if (abortControllerRef.current === controller) {
                abortControllerRef.current = null;
            }
        }
    }

    async function handleCopyResult() {
        if (!hasVisibleResult) {
            return;
        }

        if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
            setCopyState('unsupported');
            resetCopyState();
            return;
        }

        await navigator.clipboard.writeText(displayResultText);
        setCopyState('copied');
        resetCopyState();
    }

    function handleReplaceTarget() {
        if (!hasVisibleResult) {
            return;
        }

        patchDraft({
            targetText: displayResultText,
            lastError: null,
        });
    }

    function handleClearTarget() {
        patchDraft({
            targetText: '',
            lastError: null,
        });
    }

    const pageTag = selectedPreset
        ? `已选择预设模板`
        : savedSample
          ? '已保存 1 组样本'
          : '样本未保存';
    const pageTagClass = selectedPreset
        ? 'border-cyan-200 bg-cyan-50 text-cyan-800'
        : savedSample
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-amber-200 bg-amber-50 text-amber-800';

    if (!isHydrated) {
        return (
            <div className="mx-auto flex min-h-[calc(100vh-120px)] max-w-[1600px] items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
                <div className="flex items-center gap-3 rounded-full border border-white/80 bg-white/80 px-5 py-3 text-sm text-slate-600 shadow-lg shadow-slate-900/5 backdrop-blur">
                    <LoaderCircle size={16} className="animate-spin" />
                    正在恢复本地样本和草稿
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
            <section className="relative overflow-hidden rounded-[28px] border border-white/75 bg-[linear-gradient(135deg,rgba(248,252,255,0.94),rgba(242,255,251,0.92))] p-6 shadow-[0_30px_90px_-54px_rgba(15,23,42,0.42)] backdrop-blur">
                <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.12),transparent_62%)]" />
                <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-3xl">
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-700">
                            <Sparkles size={14} />
                            AIGC Rewrite Workspace
                        </div>
                        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                            降低 AIGC
                        </h1>
                        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                            先选一段未修改的原文并自行改写，再把原文、改文和目标文本输入系统，让 AI 按你的习惯继续改写。
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${pageTagClass}`}>
                            {pageTag}
                        </span>
                        <span className="rounded-full border border-white/75 bg-white/75 px-3 py-1.5 text-xs font-medium text-slate-600">
                            {selectedPreset ? '预设示例正文仅在服务端使用' : '样本仅保存在当前浏览器'}
                        </span>
                    </div>
                </div>
            </section>

            <section className="overflow-hidden rounded-[26px] border border-[var(--border)] bg-white/82 shadow-[var(--card-shadow)] backdrop-blur">
                <button
                    type="button"
                    onClick={() => setIsGuideExpanded((current) => !current)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6"
                >
                    <div>
                        <div className="text-sm font-semibold text-slate-900">首次使用引导</div>
                        <p className="mt-1 text-sm text-slate-600">
                            先按正确顺序准备样本，再开始改写会更稳定。
                        </p>
                    </div>
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600">
                        <ChevronDown size={18} className={isGuideExpanded ? 'rotate-180' : ''} />
                    </span>
                </button>

                {isGuideExpanded && (
                    <div className="border-t border-[var(--border)] px-5 pb-5 pt-1 sm:px-6 sm:pb-6">
                        <div className="grid gap-3 lg:grid-cols-3">
                            {guideItems.map((item) => (
                                <div
                                    key={item.title}
                                    className="rounded-[22px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.94))] p-4"
                                >
                                    <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 rounded-[22px] border border-cyan-100 bg-cyan-50/70 p-4">
                            <div className="text-sm font-semibold text-cyan-950">什么样的样本更有效</div>
                            <ul className="mt-3 space-y-2 text-sm leading-6 text-cyan-900">
                                {sampleTips.map((item) => (
                                    <li key={item} className="flex items-start gap-2">
                                        <CheckCircle2 size={15} className="mt-1 shrink-0" />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
            </section>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.06fr)_minmax(380px,0.94fr)]">
                <div className="flex flex-col gap-6">
                    <section className="rounded-[26px] border border-[var(--border)] bg-white/86 p-5 shadow-[var(--card-shadow)] backdrop-blur sm:p-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                                    步骤 1
                                </div>
                                <h2 className="mt-2 text-xl font-semibold text-slate-950">样本标定区</h2>
                                <p className="mt-2 text-sm leading-6 text-slate-600">
                                    录入一组「改写前 / 改写后」样本，让系统学习你的改写习惯。
                                </p>
                            </div>
                            <span
                                className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${getQualityPanelClass(
                                    currentSampleLevel
                                )}`}
                            >
                                {getSampleStatusText(currentSampleLevel)}
                            </span>
                        </div>

                        <div className="mt-5 rounded-[24px] border border-cyan-200 bg-[linear-gradient(135deg,rgba(236,254,255,0.98),rgba(239,246,255,0.95))] p-5">
                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                <div>
                                    <div className="text-sm font-semibold text-cyan-950">预设模板体验</div>
                                    <p className="mt-2 text-sm leading-6 text-cyan-900/80">
                                        不想先手动准备样本时，可以直接选择一个预设模板体验整套方法。模板正文仅保存在服务端，不会返回到前端。
                                    </p>
                                </div>
                                {selectedPreset && (
                                    <span className="rounded-full border border-cyan-200 bg-white/75 px-3 py-1 text-xs font-semibold text-cyan-900">
                                        当前已选
                                    </span>
                                )}
                            </div>

                            <div className="mt-4 space-y-3">
                                {isLoadingPresets && (
                                    <div className="rounded-2xl border border-white/80 bg-white/75 px-4 py-3 text-sm text-slate-600">
                                        正在读取可用预设模板
                                    </div>
                                )}
                                {presetError && (
                                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                        {presetError}
                                    </div>
                                )}
                                {presets.map((preset) => {
                                    const isSelected = selectedPreset?.id === preset.id;

                                    return (
                                        <div
                                            key={preset.id}
                                            className={`rounded-[22px] border p-4 ${
                                                isSelected
                                                    ? 'border-cyan-300 bg-white/90 shadow-sm'
                                                    : 'border-white/80 bg-white/75'
                                            }`}
                                        >
                                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                <div>
                                                    <div className="text-sm font-semibold text-slate-950">{preset.name}</div>
                                                    <p className="mt-2 text-sm leading-6 text-slate-600">{preset.description}</p>
                                                    <p className="mt-2 text-sm leading-6 text-cyan-900/80">
                                                        {preset.recommendedUsage}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSelectPreset(preset)}
                                                    className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-medium ${
                                                        isSelected
                                                            ? 'border border-cyan-200 bg-cyan-50 text-cyan-800'
                                                            : 'bg-slate-950 text-white hover:bg-slate-800'
                                                    }`}
                                                >
                                                    {isSelected ? '已选中' : '直接使用这个模板'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {selectedPreset && (
                                <div className="mt-4 flex flex-wrap gap-3">
                                    <button
                                        type="button"
                                        onClick={handleClearPreset}
                                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300"
                                    >
                                        改用手动样本
                                    </button>
                                </div>
                            )}
                        </div>

                        {!selectedPreset && savedSample && !isEditingSample && (
                            <div className="mt-5 rounded-[24px] border border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,0.98),rgba(240,249,255,0.94))] p-5">
                                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                    <div>
                                        <div className="text-sm font-semibold text-emerald-950">已保存样本</div>
                                        <p className="mt-2 text-sm leading-6 text-emerald-900/80">
                                            样本会保存在当前浏览器，可直接用于本页重复改写。
                                        </p>
                                    </div>
                                    <span className="rounded-full border border-emerald-200 bg-white/75 px-3 py-1 text-xs font-semibold text-emerald-900">
                                        {getSampleSummaryText(
                                            evaluateAigcRewriteSampleQuality(savedSample.before, savedSample.after).level
                                        )}
                                    </span>
                                </div>

                                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                    <div className="rounded-2xl border border-white/80 bg-white/75 p-4">
                                        <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                                            字数
                                        </div>
                                        <div className="mt-2 text-lg font-semibold text-slate-950">{sampleCharCount}</div>
                                    </div>
                                    <div className="rounded-2xl border border-white/80 bg-white/75 p-4">
                                        <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                                            最近保存
                                        </div>
                                        <div className="mt-2 text-lg font-semibold text-slate-950">
                                            {formatDateTime(savedSample.savedAt)}
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border border-white/80 bg-white/75 p-4">
                                        <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                                            当前状态
                                        </div>
                                        <div className="mt-2 text-lg font-semibold text-slate-950">
                                            {getSampleSummaryText(
                                                evaluateAigcRewriteSampleQuality(savedSample.before, savedSample.after).level
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-5 flex flex-wrap gap-3">
                                    <button
                                        type="button"
                                        onClick={handleEditSample}
                                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300"
                                    >
                                        <PencilLine size={16} />
                                        编辑样本
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleClearSample}
                                        className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
                                    >
                                        <Trash2 size={16} />
                                        清空样本
                                    </button>
                                </div>
                            </div>
                        )}

                        {!selectedPreset && (!savedSample || isEditingSample) && (
                            <>
                                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                                    <label className="block">
                                        <span className="text-sm font-medium text-slate-800">改写前文本</span>
                                        <AutoResizeTextarea
                                            minHeight={200}
                                            value={draft.sampleBefore}
                                            onChange={(event) => patchDraft({ sampleBefore: event.target.value, lastError: null })}
                                            placeholder="粘贴原始文本，建议是一段完整的自然段或小节。"
                                            className="mt-2 w-full rounded-[22px] border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm leading-7 text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-cyan-400 focus:shadow-[0_0_0_4px_rgba(34,211,238,0.12)]"
                                        />
                                    </label>

                                    <label className="block">
                                        <span className="text-sm font-medium text-slate-800">改写后文本</span>
                                        <AutoResizeTextarea
                                            minHeight={200}
                                            value={draft.sampleAfter}
                                            onChange={(event) => patchDraft({ sampleAfter: event.target.value, lastError: null })}
                                            placeholder="粘贴你自己改过后的版本，保留你的真实表达习惯。"
                                            className="mt-2 w-full rounded-[22px] border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm leading-7 text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-cyan-400 focus:shadow-[0_0_0_4px_rgba(34,211,238,0.12)]"
                                        />
                                    </label>
                                </div>

                                <div className={`mt-4 rounded-[22px] border p-4 ${getQualityPanelClass(sampleQuality.level)}`}>
                                    <div className="flex items-center gap-2 text-sm font-semibold">
                                        {sampleQuality.level === 'ready' ? (
                                            <CheckCircle2 size={16} />
                                        ) : (
                                            <AlertCircle size={16} />
                                        )}
                                        {sampleQuality.message ?? '请先补全样本。'}
                                    </div>
                                    {sampleQuality.issues.length > 1 && (
                                        <ul className="mt-3 space-y-2 text-sm leading-6">
                                            {sampleQuality.issues.slice(1).map((item) => (
                                                <li key={item} className="pl-5">
                                                    {item}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>

                                <div className="mt-5 flex flex-wrap gap-3">
                                    <button
                                        type="button"
                                        onClick={() => void handleSaveSample()}
                                        disabled={!sampleQuality.canSave}
                                        className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                                    >
                                        <Save size={16} />
                                        保存样本
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleClearSample}
                                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-300"
                                    >
                                        <Trash2 size={16} />
                                        清空样本
                                    </button>
                                    {savedSample && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsEditingSample(false);
                                                patchDraft({
                                                    sampleBefore: savedSample.before,
                                                    sampleAfter: savedSample.after,
                                                    selectedPresetId: null,
                                                    selectedPresetName: null,
                                                    selectedPresetDescription: null,
                                                    lastError: null,
                                                });
                                            }}
                                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-300"
                                        >
                                            取消编辑
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </section>

                    <section className="rounded-[26px] border border-[var(--border)] bg-white/86 p-5 shadow-[var(--card-shadow)] backdrop-blur sm:p-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                                    步骤 2
                                </div>
                                <h2 className="mt-2 text-xl font-semibold text-slate-950">待改写区</h2>
                                <p className="mt-2 text-sm leading-6 text-slate-600">
                                    输入本次需要改写的目标文本，没有手动样本或预设模板时不能提交。
                                </p>
                            </div>
                            {!hasActiveSampleSource && (
                                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
                                    请先完成步骤 1
                                </span>
                            )}
                        </div>

                        <label className="mt-5 block">
                            <span className="text-sm font-medium text-slate-800">待改写文本</span>
                            <AutoResizeTextarea
                                minHeight={220}
                                value={draft.targetText}
                                onChange={(event) => patchDraft({ targetText: event.target.value, lastError: null })}
                                placeholder="粘贴需要降低 AI 痕迹的新文本。"
                                className="mt-2 w-full rounded-[24px] border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm leading-7 text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-cyan-400 focus:shadow-[0_0_0_4px_rgba(34,211,238,0.12)]"
                            />
                        </label>

                        <div className="mt-5 flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={() => void startGeneration()}
                                disabled={!canSubmit}
                                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                                {draft.generationPhase === 'streaming' ? (
                                    <LoaderCircle size={16} className="animate-spin" />
                                ) : (
                                    <FilePenLine size={16} />
                                )}
                                {primaryActionLabel}
                            </button>
                            <button
                                type="button"
                                onClick={stopGeneration}
                                disabled={draft.generationPhase !== 'streaming'}
                                className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                            >
                                <Square size={15} />
                                停止生成
                            </button>
                            <button
                                type="button"
                                onClick={handleClearTarget}
                                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-300"
                            >
                                <Trash2 size={16} />
                                清空
                            </button>
                        </div>

                        {draft.lastError && (
                            <div className="mt-4 rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-800">
                                {draft.lastError}
                            </div>
                        )}
                    </section>
                </div>

                <section className="rounded-[26px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(247,250,252,0.9))] p-5 shadow-[var(--card-shadow)] backdrop-blur sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                                步骤 3
                            </div>
                            <h2 className="mt-2 text-xl font-semibold text-slate-950">结果区</h2>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                改写结果会实时出现在这里，可复制、替换回步骤 2，或继续重试。
                            </p>
                        </div>
                        <span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${getPhaseBadgeClass(draft.generationPhase)}`}>
                            {getPhaseText(draft.generationPhase)}
                        </span>
                    </div>

                    {draft.generationPhase === 'streaming' && previousResultText && !draft.resultText && (
                        <div className="mt-5 rounded-[20px] border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm leading-6 text-cyan-900">
                            正在重新生成，新结果到达后会覆盖上一轮输出。
                        </div>
                    )}

                    <div className="mt-5 rounded-[24px] border border-slate-200 bg-white/85 p-4 shadow-inner shadow-slate-200/35">
                        {draft.generationPhase === 'streaming' && (
                            <div className="mb-4 rounded-[20px] border border-cyan-200 bg-[linear-gradient(135deg,rgba(236,254,255,0.96),rgba(239,246,255,0.94))] p-4">
                                <div className="flex items-center gap-2 text-sm font-semibold text-cyan-900">
                                    <BrainCircuit size={16} />
                                    {hasLiveThinking ? '模型正在思考并生成中' : '模型已开始思考，请稍候'}
                                    <span className="inline-flex items-center gap-1">
                                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-500" />
                                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-500 [animation-delay:180ms]" />
                                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-500 [animation-delay:360ms]" />
                                    </span>
                                </div>
                                <p className="mt-2 text-sm leading-6 text-cyan-900/80">
                                    {hasLiveThinking
                                        ? hasLiveOutput
                                            ? `thinking 持续更新中：${thinkingPreview}`
                                            : `正文尚未开始输出，最新 thinking：${thinkingPreview}`
                                        : '服务正在处理样本和目标文本，thinking 返回后会立即显示在这里。'}
                                </p>
                            </div>
                        )}

                        {hasVisibleResult ? (
                            <div className="space-y-4">
                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                    {streamMeta && (
                                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium">
                                            {streamMeta.provider} / {streamMeta.model}
                                        </span>
                                    )}
                                    {draft.generationPhase === 'streaming' && (
                                        <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 font-medium text-cyan-700">
                                            正在生成
                                        </span>
                                    )}
                                    {draft.generationPhase === 'streaming' && hasLiveThinking && (
                                        <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 font-medium text-sky-700">
                                            thinking 更新中
                                        </span>
                                    )}
                                </div>

                                <div className="min-h-[280px] whitespace-pre-wrap break-words text-sm leading-7 text-slate-900">
                                    {displayResultText}
                                    {draft.generationPhase === 'streaming' && (
                                        <span className="ml-1 inline-block h-5 w-2 animate-pulse rounded-full bg-cyan-500 align-middle" />
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[20px] border border-dashed border-slate-200 bg-slate-50/80 px-6 text-center">
                                <Sparkles size={20} className="text-slate-400" />
                                <div className="mt-4 text-sm font-medium text-slate-700">结果将在这里实时出现</div>
                                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                                    保存样本后输入目标文本，系统会按你的改写习惯开始流式改写。
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={() => void handleCopyResult()}
                            disabled={!hasVisibleResult}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-300 disabled:cursor-not-allowed disabled:text-slate-400"
                        >
                            <Copy size={16} />
                            {copyState === 'copied'
                                ? '已复制'
                                : copyState === 'unsupported'
                                  ? '当前环境不支持复制'
                                  : '复制结果'}
                        </button>
                        <button
                            type="button"
                            onClick={handleReplaceTarget}
                            disabled={!hasVisibleResult}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-300 disabled:cursor-not-allowed disabled:text-slate-400"
                        >
                            <FilePenLine size={16} />
                            替换待改写区
                        </button>
                        <button
                            type="button"
                            onClick={() => void startGeneration()}
                            disabled={!canSubmit}
                            className="inline-flex items-center gap-2 rounded-full bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                            <RefreshCw size={16} />
                            保留结果并再次生成
                        </button>
                    </div>

                    <div className="mt-6 rounded-[24px] border border-slate-200 bg-white/82">
                        <button
                            type="button"
                            onClick={() => setIsThinkingExpanded((current) => !current)}
                            disabled={!hasVisibleThinking}
                            className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left disabled:cursor-not-allowed disabled:text-slate-400"
                        >
                            <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                                <BrainCircuit size={16} />
                                {hasVisibleThinking
                                    ? draft.generationPhase === 'streaming'
                                        ? 'thinking 正在更新'
                                        : '展开 thinking'
                                    : draft.generationPhase === 'streaming'
                                      ? 'thinking 已开启，等待返回'
                                      : 'thinking 暂无内容'}
                            </span>
                            <ChevronDown
                                size={18}
                                className={isThinkingExpanded && hasVisibleThinking ? 'rotate-180' : ''}
                            />
                        </button>

                        {isThinkingExpanded && hasVisibleThinking && (
                            <div className="border-t border-slate-200 px-4 py-4">
                                <div className="rounded-[18px] bg-slate-950 px-4 py-4 text-sm leading-7 text-slate-100">
                                    {displayThinkingText}
                                </div>
                            </div>
                        )}
                    </div>

                    {(draft.generationPhase === 'stopped' || draft.generationPhase === 'failed') && (
                        <div className="mt-4 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                            {draft.generationPhase === 'stopped'
                                ? '本轮已停止，当前内容已保留，可继续重试。'
                                : '本轮生成未完成，已保留已有内容，建议调整样本后再试。'}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
