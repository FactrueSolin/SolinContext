'use client';

import React, { useState } from 'react';
import { useEditor } from '../contexts/EditorContext';
import { X, Settings, ChevronDown, ChevronRight, GitCompare } from 'lucide-react';

export default function ApiConfigPanel() {
    const {
        state: { currentProject, showApiConfig },
        toggleApiConfig,
        updateApiConfig,
    } = useEditor();

    const [showAdvanced, setShowAdvanced] = useState(false);
    const [stopInput, setStopInput] = useState('');

    if (!showApiConfig || !currentProject) return null;

    const { apiConfig } = currentProject;
    const primaryModelLabel = apiConfig.primaryModelLabel?.trim() || '服务端主模型';
    const compareModelLabel = apiConfig.compareModelLabel?.trim();
    const hasCompareModel = apiConfig.hasCompareModel === true;

    const numberInputClass = "w-20 px-2 py-1 text-xs text-center border border-[var(--input-border)] rounded-[var(--radius-sm)] bg-[var(--input-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] disabled:opacity-40 disabled:cursor-not-allowed";
    const sliderClass = "w-full h-1.5 rounded-full appearance-none cursor-pointer bg-[var(--muted)] accent-[var(--primary)] disabled:opacity-40 disabled:cursor-not-allowed";
    const autoBadgeClass = (isAuto: boolean) =>
        `inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full cursor-pointer select-none transition-colors duration-[var(--transition-fast)] ${
            isAuto
                ? 'bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20'
                : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]/80'
        }`;

    const setAdvancedValue = (field: string, value: number | boolean | string[] | undefined) => {
        updateApiConfig({ [field]: value });
    };

    const toggleAuto = (
        field: string,
        currentValue: number | boolean | string[] | undefined,
        defaultValue: number | boolean
    ) => {
        if (currentValue !== undefined) {
            updateApiConfig({ [field]: undefined });
            return;
        }

        updateApiConfig({ [field]: defaultValue });
    };

    const handleStopInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Enter') {
            return;
        }

        e.preventDefault();
        const value = stopInput.trim();

        if (!value) {
            return;
        }

        const current = apiConfig.stopSequences ?? [];
        if (!current.includes(value)) {
            setAdvancedValue('stopSequences', [...current, value]);
        }
        setStopInput('');
    };

    const removeStopSequence = (index: number) => {
        const current = apiConfig.stopSequences ?? [];
        const updated = current.filter((_, currentIndex) => currentIndex !== index);
        setAdvancedValue('stopSequences', updated.length > 0 ? updated : undefined);
    };

    return (
        <div className="absolute top-0 right-0 bottom-0 z-20 flex w-80 flex-col border-l border-[var(--border)] bg-[var(--panel-bg)] shadow-xl animate-[slideInRight_200ms_ease-out]">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                    <Settings size={16} className="text-[var(--muted-foreground)]" />
                    <h2 className="text-sm font-semibold text-[var(--foreground)]">AI 配置</h2>
                </div>
                <button
                    onClick={toggleApiConfig}
                    className="p-1.5 hover:bg-[var(--muted)] rounded-[var(--radius-sm)] transition-colors duration-[var(--transition-fast)] text-[var(--muted-foreground)] active:scale-95"
                    title="关闭"
                >
                    <X size={16} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
                <section className="space-y-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--muted)]/30 p-3">
                    <div>
                        <p className="text-xs font-medium text-[var(--foreground)]">模型与秘钥</p>
                        <p className="mt-1 text-[11px] leading-5 text-[var(--muted-foreground)]">
                            AI 模型、Base URL 与 API Key 已改为由后端环境变量统一管理，前端不会保存或提交这些敏感配置。
                        </p>
                    </div>
                    <div className="rounded-[var(--radius-sm)] bg-[var(--panel-bg)] px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">主模型</p>
                        <p className="mt-1 text-sm font-medium text-[var(--foreground)]">{primaryModelLabel}</p>
                    </div>
                    <div className="rounded-[var(--radius-sm)] bg-[var(--panel-bg)] px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">A/B 对比</p>
                                <p className="mt-1 text-sm font-medium text-[var(--foreground)]">
                                    {hasCompareModel ? compareModelLabel || '服务端对比模型' : '未配置'}
                                </p>
                            </div>
                            <span
                                className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full ${
                                    hasCompareModel
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-[var(--muted)] text-[var(--muted-foreground)]'
                                }`}
                            >
                                {hasCompareModel ? '可用' : '关闭'}
                            </span>
                        </div>
                    </div>
                </section>

                <div className="border border-[var(--border)] rounded-[var(--radius-sm)] overflow-hidden">
                    <button
                        type="button"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-[var(--muted-foreground)] hover:bg-[var(--muted)]/50 transition-colors"
                    >
                        {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        高级参数
                    </button>

                    {showAdvanced && (
                        <div className="px-3 pb-3 space-y-4 border-t border-[var(--border)] pt-3">
                            {(apiConfig.thinking ?? false) && (
                                <div className="text-[10px] text-[var(--muted-foreground)] bg-[var(--muted)] px-2 py-1.5 rounded">
                                    思考模式下 Temperature / Top P / Top K 不可用
                                </div>
                            )}

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-medium text-[var(--foreground)]">
                                        Temperature
                                    </label>
                                    <span
                                        className={autoBadgeClass(apiConfig.temperature === undefined)}
                                        onClick={() => {
                                            if (!(apiConfig.thinking ?? false)) {
                                                toggleAuto('temperature', apiConfig.temperature, 0.5);
                                            }
                                        }}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if ((e.key === 'Enter' || e.key === ' ') && !(apiConfig.thinking ?? false)) {
                                                toggleAuto('temperature', apiConfig.temperature, 0.5);
                                            }
                                        }}
                                    >
                                        {apiConfig.temperature === undefined ? '自动' : '手动'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="range"
                                        min={0}
                                        max={1}
                                        step={0.1}
                                        value={apiConfig.temperature ?? 0.5}
                                        onChange={(e) => setAdvancedValue('temperature', Number(e.target.value))}
                                        disabled={apiConfig.temperature === undefined || (apiConfig.thinking ?? false)}
                                        className={sliderClass}
                                    />
                                    <input
                                        type="number"
                                        min={0}
                                        max={1}
                                        step={0.1}
                                        value={apiConfig.temperature ?? ''}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (value === '') {
                                                setAdvancedValue('temperature', undefined);
                                                return;
                                            }

                                            const number = Number(value);
                                            if (!Number.isNaN(number)) {
                                                setAdvancedValue('temperature', Math.min(1, Math.max(0, number)));
                                            }
                                        }}
                                        disabled={apiConfig.temperature === undefined || (apiConfig.thinking ?? false)}
                                        className={numberInputClass}
                                        placeholder="自动"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-medium text-[var(--foreground)]">
                                        Top P
                                    </label>
                                    <span
                                        className={autoBadgeClass(apiConfig.topP === undefined)}
                                        onClick={() => {
                                            if (!(apiConfig.thinking ?? false)) {
                                                toggleAuto('topP', apiConfig.topP, 0.7);
                                            }
                                        }}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if ((e.key === 'Enter' || e.key === ' ') && !(apiConfig.thinking ?? false)) {
                                                toggleAuto('topP', apiConfig.topP, 0.7);
                                            }
                                        }}
                                    >
                                        {apiConfig.topP === undefined ? '自动' : '手动'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="range"
                                        min={0}
                                        max={1}
                                        step={0.1}
                                        value={apiConfig.topP ?? 0.7}
                                        onChange={(e) => setAdvancedValue('topP', Number(e.target.value))}
                                        disabled={apiConfig.topP === undefined || (apiConfig.thinking ?? false)}
                                        className={sliderClass}
                                    />
                                    <input
                                        type="number"
                                        min={0}
                                        max={1}
                                        step={0.1}
                                        value={apiConfig.topP ?? ''}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (value === '') {
                                                setAdvancedValue('topP', undefined);
                                                return;
                                            }

                                            const number = Number(value);
                                            if (!Number.isNaN(number)) {
                                                setAdvancedValue('topP', Math.min(1, Math.max(0, number)));
                                            }
                                        }}
                                        disabled={apiConfig.topP === undefined || (apiConfig.thinking ?? false)}
                                        className={numberInputClass}
                                        placeholder="自动"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-medium text-[var(--foreground)]">
                                        Top K
                                    </label>
                                    <span
                                        className={autoBadgeClass(apiConfig.topK === undefined)}
                                        onClick={() => {
                                            if (!(apiConfig.thinking ?? false)) {
                                                toggleAuto('topK', apiConfig.topK, 40);
                                            }
                                        }}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if ((e.key === 'Enter' || e.key === ' ') && !(apiConfig.thinking ?? false)) {
                                                toggleAuto('topK', apiConfig.topK, 40);
                                            }
                                        }}
                                    >
                                        {apiConfig.topK === undefined ? '自动' : '手动'}
                                    </span>
                                </div>
                                <input
                                    type="number"
                                    min={1}
                                    step={1}
                                    value={apiConfig.topK ?? ''}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        if (value === '') {
                                            setAdvancedValue('topK', undefined);
                                            return;
                                        }

                                        const number = Number(value);
                                        if (!Number.isNaN(number) && number >= 1) {
                                            setAdvancedValue('topK', Math.floor(number));
                                        }
                                    }}
                                    disabled={apiConfig.topK === undefined || (apiConfig.thinking ?? false)}
                                    className={`${numberInputClass} w-full disabled:opacity-40 disabled:cursor-not-allowed`}
                                    placeholder="自动"
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-medium text-[var(--foreground)]">
                                        Max Tokens
                                    </label>
                                    <span
                                        className={autoBadgeClass(apiConfig.maxTokens === undefined)}
                                        onClick={() => toggleAuto('maxTokens', apiConfig.maxTokens, 4096)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                toggleAuto('maxTokens', apiConfig.maxTokens, 4096);
                                            }
                                        }}
                                    >
                                        {apiConfig.maxTokens === undefined ? '自动' : '手动'}
                                    </span>
                                </div>
                                <input
                                    type="number"
                                    min={1}
                                    step={1}
                                    value={apiConfig.maxTokens ?? ''}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        if (value === '') {
                                            setAdvancedValue('maxTokens', undefined);
                                            return;
                                        }

                                        const number = Number(value);
                                        if (!Number.isNaN(number) && number >= 1) {
                                            setAdvancedValue('maxTokens', Math.floor(number));
                                        }
                                    }}
                                    disabled={apiConfig.maxTokens === undefined}
                                    className={`${numberInputClass} w-full disabled:opacity-40 disabled:cursor-not-allowed`}
                                    placeholder="自动（由模型推断）"
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-medium text-[var(--foreground)]">
                                        Stop Sequences
                                    </label>
                                </div>
                                <input
                                    type="text"
                                    value={stopInput}
                                    onChange={(e) => setStopInput(e.target.value)}
                                    onKeyDown={handleStopInputKeyDown}
                                    className={`${numberInputClass} w-full text-left disabled:opacity-40 disabled:cursor-not-allowed`}
                                    placeholder="输入后按 Enter 添加"
                                />
                                {apiConfig.stopSequences && apiConfig.stopSequences.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {apiConfig.stopSequences.map((sequence, index) => (
                                            <span
                                                key={sequence}
                                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-[var(--muted)] rounded-full text-[var(--foreground)]"
                                            >
                                                {sequence}
                                                <button
                                                    type="button"
                                                    onClick={() => removeStopSequence(index)}
                                                    className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                                                >
                                                    <X size={10} />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-medium text-[var(--foreground)]">
                                        Stream
                                    </label>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={apiConfig.stream ?? false}
                                        onClick={() => setAdvancedValue('stream', !(apiConfig.stream ?? false))}
                                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                            (apiConfig.stream ?? false) ? 'bg-[var(--primary)]' : 'bg-[var(--muted)]'
                                        }`}
                                    >
                                        <span
                                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                                (apiConfig.stream ?? false) ? 'translate-x-4' : 'translate-x-1'
                                            }`}
                                        />
                                    </button>
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-medium text-[var(--foreground)]">
                                        思考模式
                                    </label>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={apiConfig.thinking ?? false}
                                        onClick={() => setAdvancedValue('thinking', !(apiConfig.thinking ?? false))}
                                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                            (apiConfig.thinking ?? false) ? 'bg-[var(--primary)]' : 'bg-[var(--muted)]'
                                        }`}
                                    >
                                        <span
                                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                                (apiConfig.thinking ?? false) ? 'translate-x-4' : 'translate-x-1'
                                            }`}
                                        />
                                    </button>
                                </div>
                                {(apiConfig.thinking ?? false) && (
                                    <div className="mt-2">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="text-xs font-medium text-[var(--foreground)]">
                                                思考预算 (tokens)
                                            </label>
                                            <span
                                                className={autoBadgeClass(apiConfig.thinkingBudget === undefined)}
                                                onClick={() => toggleAuto('thinkingBudget', apiConfig.thinkingBudget, 10000)}
                                                role="button"
                                                tabIndex={0}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        toggleAuto('thinkingBudget', apiConfig.thinkingBudget, 10000);
                                                    }
                                                }}
                                            >
                                                {apiConfig.thinkingBudget === undefined ? '自动' : '手动'}
                                            </span>
                                        </div>
                                        <input
                                            type="number"
                                            min={1024}
                                            step={1024}
                                            value={apiConfig.thinkingBudget ?? ''}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                if (value === '') {
                                                    setAdvancedValue('thinkingBudget', undefined);
                                                    return;
                                                }

                                                const number = Number(value);
                                                if (!Number.isNaN(number) && number >= 1024) {
                                                    setAdvancedValue('thinkingBudget', Math.floor(number));
                                                }
                                            }}
                                            disabled={apiConfig.thinkingBudget === undefined}
                                            className={`${numberInputClass} w-full disabled:opacity-40 disabled:cursor-not-allowed`}
                                            placeholder="自动（10000）"
                                        />
                                        <p className="text-[10px] text-[var(--muted-foreground)] mt-1">
                                            启用思考模式时，Temperature / Top P / Top K 将不可用
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="border border-[var(--border)] rounded-[var(--radius-sm)] overflow-hidden">
                    <div className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium text-[var(--muted-foreground)]">
                        <div className="flex items-center gap-2">
                            <GitCompare size={14} />
                            对比模型（A/B 测试）
                        </div>
                        <span
                            className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full ${
                                hasCompareModel
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-[var(--muted)] text-[var(--muted-foreground)]'
                            }`}
                        >
                            {hasCompareModel ? '由服务端启用' : '未启用'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
