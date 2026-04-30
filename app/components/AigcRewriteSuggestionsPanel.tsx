'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Copy, FilePenLine, LoaderCircle } from 'lucide-react';
import type { AigcDetectionTaskStatus } from '../lib/aigc-detection/dto';

export type RewriteSuggestionStatus = 'pending' | 'streaming' | 'succeeded' | 'failed';
export type RewriteSuggestionDetectionStatus = 'idle' | 'checking' | 'succeeded' | 'failed';

export interface RewriteSuggestion {
    sentenceId: string;
    order: number;
    sourceText: string;
    rewrittenText: string;
    aiProbability: number;
    label: string;
    status: RewriteSuggestionStatus;
    error: string | null;
    rewrittenAiProbability: number | null;
    rewrittenLabel: string | null;
    rewrittenDetectionStatus: RewriteSuggestionDetectionStatus;
    rewrittenDetectionError: string | null;
}

function formatPercent(value: number | null) {
    if (value === null) {
        return '--';
    }

    const normalized = value <= 1 ? value * 100 : value;
    return `${Math.round(normalized)}%`;
}

function normalizeLikelihoodLabel(label: string | null | undefined) {
    return label?.trim().toLowerCase().replace(/[\s-]+/g, '_') ?? null;
}

function getLikelihoodBadgeClass(label: string | null | undefined) {
    const normalizedLabel = normalizeLikelihoodLabel(label);

    if (normalizedLabel === 'ai_likely') {
        return 'border-rose-200 bg-rose-50 text-rose-700';
    }

    if (normalizedLabel === 'human_likely') {
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    }

    return 'border-slate-200 bg-slate-50 text-slate-700';
}

function getRewriteSuggestionStatusText(status: RewriteSuggestionStatus) {
    if (status === 'streaming') {
        return '生成中';
    }

    if (status === 'succeeded') {
        return '已完成';
    }

    if (status === 'failed') {
        return '失败';
    }

    return '等待生成';
}

function getRewriteSuggestionStatusClass(status: RewriteSuggestionStatus) {
    if (status === 'streaming') {
        return 'border-cyan-200 bg-cyan-50 text-cyan-800';
    }

    if (status === 'succeeded') {
        return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    }

    if (status === 'failed') {
        return 'border-rose-200 bg-rose-50 text-rose-800';
    }

    return 'border-slate-200 bg-slate-50 text-slate-600';
}

function buildCopyAllText(suggestions: RewriteSuggestion[]) {
    return suggestions
        .filter((suggestion) => suggestion.rewrittenText.trim())
        .map((suggestion, index) =>
            [
                `句子 ${index + 1}`,
                `原句：${suggestion.sourceText}`,
                `改写句：${suggestion.rewrittenText.trim()}`,
                `改写句 AIGC 率：${formatPercent(suggestion.rewrittenAiProbability)}`,
                `改写句标签：${suggestion.rewrittenLabel ?? '--'}`,
            ].join('\n')
        )
        .join('\n\n');
}

async function copyText(text: string) {
    if (!text.trim() || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        return false;
    }

    await navigator.clipboard.writeText(text);
    return true;
}

export default function AigcRewriteSuggestionsPanel({
    taskStatus,
    aiLikelySuggestions,
    rewriteSuggestions,
    rewriteSuggestionError,
    rewriteSuggestionPresetName,
    isGeneratingRewriteSuggestions,
    onGenerate,
}: {
    taskStatus: AigcDetectionTaskStatus;
    aiLikelySuggestions: RewriteSuggestion[];
    rewriteSuggestions: RewriteSuggestion[];
    rewriteSuggestionError: string | null;
    rewriteSuggestionPresetName: string | null;
    isGeneratingRewriteSuggestions: boolean;
    onGenerate: () => void;
}) {
    const [copyState, setCopyState] = useState<string | null>(null);
    const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const displaySuggestions = rewriteSuggestions.length > 0 ? rewriteSuggestions : aiLikelySuggestions;
    const completedCount = rewriteSuggestions.filter((item) => item.status === 'succeeded').length;
    const failedCount = rewriteSuggestions.filter((item) => item.status === 'failed').length;
    const copyableCount = rewriteSuggestions.filter((item) => item.rewrittenText.trim()).length;
    const copyAllText = useMemo(() => buildCopyAllText(rewriteSuggestions), [rewriteSuggestions]);

    useEffect(() => {
        return () => {
            if (copyTimerRef.current) {
                clearTimeout(copyTimerRef.current);
            }
        };
    }, []);

    function showCopied(key: string) {
        if (copyTimerRef.current) {
            clearTimeout(copyTimerRef.current);
        }

        setCopyState(key);
        copyTimerRef.current = setTimeout(() => {
            setCopyState(null);
        }, 1400);
    }

    async function handleCopy(key: string, text: string) {
        const copied = await copyText(text);

        if (copied) {
            showCopied(key);
        }
    }

    return (
        <section className="mt-6 rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-[0_24px_64px_-52px_rgba(15,23,42,0.5)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">修改建议</div>
                    <h2 className="mt-2 text-xl font-semibold text-slate-950">AI Likely 句子改写</h2>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                        <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 font-semibold text-rose-700">
                            AI Likely {aiLikelySuggestions.length}
                        </span>
                        {rewriteSuggestions.length > 0 ? (
                            <>
                                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
                                    已完成 {completedCount}
                                </span>
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-semibold text-slate-600">
                                    可复制 {copyableCount}
                                </span>
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-semibold text-slate-600">
                                    失败 {failedCount}
                                </span>
                            </>
                        ) : null}
                        {rewriteSuggestionPresetName ? (
                            <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 font-semibold text-cyan-800">
                                {rewriteSuggestionPresetName}
                            </span>
                        ) : null}
                    </div>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button
                        type="button"
                        onClick={onGenerate}
                        disabled={isGeneratingRewriteSuggestions || aiLikelySuggestions.length === 0}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
                    >
                        {isGeneratingRewriteSuggestions ? (
                            <LoaderCircle size={15} className="animate-spin" />
                        ) : (
                            <FilePenLine size={15} />
                        )}
                        {rewriteSuggestions.length > 0 ? '重新生成建议' : '生成修改建议'}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            void handleCopy('all', copyAllText);
                        }}
                        disabled={!copyAllText}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300 disabled:cursor-not-allowed disabled:text-slate-400"
                    >
                        <Copy size={15} />
                        {copyState === 'all' ? '已复制全部' : '复制全部'}
                    </button>
                </div>
            </div>

            {rewriteSuggestionError ? (
                <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>{rewriteSuggestionError}</span>
                </div>
            ) : null}

            {displaySuggestions.length > 0 ? (
                <div className="mt-5 space-y-3">
                    {displaySuggestions.map((suggestion, index) => (
                        <article
                            key={suggestion.sentenceId}
                            className="rounded-[22px] border border-slate-200 bg-slate-50/75 p-4"
                        >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                                        句子 {index + 1}
                                    </span>
                                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getLikelihoodBadgeClass(suggestion.label)}`}>
                                        {suggestion.label}
                                    </span>
                                    <span className="text-xs font-medium text-slate-500">
                                        分值 {formatPercent(suggestion.aiProbability)}
                                    </span>
                                </div>
                                <span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getRewriteSuggestionStatusClass(suggestion.status)}`}>
                                    {suggestion.status === 'streaming' ? (
                                        <LoaderCircle size={13} className="mr-1 animate-spin" />
                                    ) : suggestion.status === 'succeeded' ? (
                                        <CheckCircle2 size={13} className="mr-1" />
                                    ) : null}
                                    {getRewriteSuggestionStatusText(suggestion.status)}
                                </span>
                            </div>

                            <div className="mt-4 grid gap-3 xl:grid-cols-2">
                                <div className="rounded-[18px] border border-rose-100 bg-white px-4 py-3">
                                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-500">
                                        原句
                                    </div>
                                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-800">
                                        {suggestion.sourceText}
                                    </p>
                                </div>
                                <div className="rounded-[18px] border border-emerald-100 bg-white px-4 py-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">
                                                改写句
                                            </div>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {suggestion.rewrittenDetectionStatus === 'checking' ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-800">
                                                        <LoaderCircle size={12} className="animate-spin" />
                                                        复检中
                                                    </span>
                                                ) : null}
                                                {suggestion.rewrittenDetectionStatus === 'succeeded' ? (
                                                    <>
                                                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                                            AIGC {formatPercent(suggestion.rewrittenAiProbability)}
                                                        </span>
                                                        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getLikelihoodBadgeClass(suggestion.rewrittenLabel)}`}>
                                                            {suggestion.rewrittenLabel}
                                                        </span>
                                                    </>
                                                ) : null}
                                                {suggestion.rewrittenDetectionStatus === 'failed' ? (
                                                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                                                        复检失败
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                void handleCopy(suggestion.sentenceId, suggestion.rewrittenText);
                                            }}
                                            disabled={!suggestion.rewrittenText.trim()}
                                            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300 disabled:cursor-not-allowed disabled:text-slate-300"
                                        >
                                            <Copy size={13} />
                                            {copyState === suggestion.sentenceId ? '已复制' : '复制'}
                                        </button>
                                    </div>
                                    {suggestion.rewrittenText ? (
                                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-800">
                                            {suggestion.rewrittenText}
                                            {suggestion.status === 'streaming' ? (
                                                <span className="ml-1 inline-block h-4 w-2 animate-pulse rounded-full bg-cyan-500 align-middle" />
                                            ) : null}
                                        </p>
                                    ) : (
                                        <p className="mt-2 text-sm leading-7 text-slate-500">
                                            {suggestion.status === 'failed'
                                                ? suggestion.error ?? '生成失败'
                                                : suggestion.status === 'streaming'
                                                  ? '正在生成'
                                                  : '尚未生成'}
                                        </p>
                                    )}
                                    {suggestion.error ? (
                                        <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm leading-6 text-rose-700">
                                            {suggestion.error}
                                        </div>
                                    ) : null}
                                    {suggestion.rewrittenDetectionError ? (
                                        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-800">
                                            {suggestion.rewrittenDetectionError}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            ) : (
                <div className="mt-5 rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 px-4 py-8 text-sm leading-7 text-slate-500">
                    {taskStatus === 'succeeded'
                        ? '当前检测结果没有 ai_likely 句子。'
                        : '任务完成后，这里会生成高风险句子的改写建议。'}
                </div>
            )}
        </section>
    );
}
