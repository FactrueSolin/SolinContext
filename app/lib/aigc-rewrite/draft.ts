export type AigcRewriteGenerationPhase =
    | 'idle'
    | 'streaming'
    | 'succeeded'
    | 'stopped'
    | 'failed';

export type AigcRewriteSampleQualityLevel = 'empty' | 'warning' | 'ready';

export interface SavedAigcRewriteSample {
    before: string;
    after: string;
    savedAt: string;
}

export interface AigcRewriteDraft {
    sampleBefore: string;
    sampleAfter: string;
    selectedPresetId: string | null;
    selectedPresetName: string | null;
    selectedPresetDescription: string | null;
    targetText: string;
    resultText: string;
    thinkingText: string;
    generationPhase: AigcRewriteGenerationPhase;
    lastError: string | null;
    sampleQualityLevel: AigcRewriteSampleQualityLevel;
    sampleQualityMessage: string | null;
    sampleSavedAt: string | null;
    hasSeenGuide: boolean;
    updatedAt: string;
    savedSampleBefore: string | null;
    savedSampleAfter: string | null;
}

export interface AigcRewriteSampleQuality {
    level: AigcRewriteSampleQualityLevel;
    message: string | null;
    canSave: boolean;
    issues: string[];
}

const MIN_SAMPLE_CHAR_COUNT = 60;
const MAX_SIMILARITY_THRESHOLD = 0.72;
const MIN_LENGTH_RATIO = 0.45;
const MIN_AFTER_RATIO = 0.55;

function nowIsoString() {
    return new Date().toISOString();
}

function createDefaultDraftBase(): AigcRewriteDraft {
    return {
        sampleBefore: '',
        sampleAfter: '',
        selectedPresetId: null,
        selectedPresetName: null,
        selectedPresetDescription: null,
        targetText: '',
        resultText: '',
        thinkingText: '',
        generationPhase: 'idle',
        lastError: null,
        sampleQualityLevel: 'empty',
        sampleQualityMessage: null,
        sampleSavedAt: null,
        hasSeenGuide: false,
        updatedAt: nowIsoString(),
        savedSampleBefore: null,
        savedSampleAfter: null,
    };
}

function trimToString(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function countMeaningfulChars(text: string): number {
    return text.replace(/\s+/g, '').length;
}

function buildCharacterBigrams(text: string): Set<string> {
    const normalized = text.replace(/\s+/g, '');
    const grams = new Set<string>();

    if (normalized.length < 2) {
        if (normalized.length === 1) {
            grams.add(normalized);
        }
        return grams;
    }

    for (let index = 0; index < normalized.length - 1; index += 1) {
        grams.add(normalized.slice(index, index + 2));
    }

    return grams;
}

function calculateSimilarity(before: string, after: string): number {
    const beforeBigrams = buildCharacterBigrams(before);
    const afterBigrams = buildCharacterBigrams(after);

    if (beforeBigrams.size === 0 && afterBigrams.size === 0) {
        return 1;
    }

    let intersectionCount = 0;

    for (const token of beforeBigrams) {
        if (afterBigrams.has(token)) {
            intersectionCount += 1;
        }
    }

    const unionCount = beforeBigrams.size + afterBigrams.size - intersectionCount;
    return unionCount === 0 ? 1 : intersectionCount / unionCount;
}

export function createAigcRewriteStorageKey(workspaceSlug: string): string {
    return `aicontext:aigc-rewrite:${workspaceSlug}`;
}

export function evaluateAigcRewriteSampleQuality(
    sampleBefore: string,
    sampleAfter: string
): AigcRewriteSampleQuality {
    const before = sampleBefore.trim();
    const after = sampleAfter.trim();

    if (!before || !after) {
        return {
            level: 'empty',
            message: '请先补全改写前文本和改写后文本。',
            canSave: false,
            issues: [],
        };
    }

    if (before === after) {
        return {
            level: 'empty',
            message: '两段样本不能完全相同，否则模型学不到改写差异。',
            canSave: false,
            issues: [],
        };
    }

    const beforeChars = countMeaningfulChars(before);
    const afterChars = countMeaningfulChars(after);
    const shorter = Math.min(beforeChars, afterChars);
    const longer = Math.max(beforeChars, afterChars);
    const similarity = calculateSimilarity(before, after);
    const issues: string[] = [];

    if (beforeChars < MIN_SAMPLE_CHAR_COUNT || afterChars < MIN_SAMPLE_CHAR_COUNT) {
        issues.push('当前样本偏短，建议至少提供一段完整自然段。');
    }

    if (longer > 0 && shorter / longer < MIN_LENGTH_RATIO) {
        issues.push('改写前后长度差异过大，结果可能更像删减而不是仿写。');
    }

    if (similarity > MAX_SIMILARITY_THRESHOLD) {
        issues.push('当前样本改写差异较小，生成结果可能仍偏 AI 腔。');
    }

    if (beforeChars > 0 && afterChars / beforeChars < MIN_AFTER_RATIO) {
        issues.push('改写后明显短于原文，模型可能倾向于压缩内容。');
    }

    if (issues.length > 0) {
        return {
            level: 'warning',
            message: issues[0],
            canSave: true,
            issues,
        };
    }

    return {
        level: 'ready',
        message: '样本差异清晰，可以直接用于改写。',
        canSave: true,
        issues: [],
    };
}

export function countAigcRewriteSampleChars(sample: SavedAigcRewriteSample): number {
    return countMeaningfulChars(sample.before) + countMeaningfulChars(sample.after);
}

export function getSavedAigcRewriteSample(draft: AigcRewriteDraft): SavedAigcRewriteSample | null {
    if (!draft.sampleSavedAt) {
        return null;
    }

    const before = draft.savedSampleBefore?.trim() || '';
    const after = draft.savedSampleAfter?.trim() || '';

    if (!before || !after) {
        return null;
    }

    return {
        before,
        after,
        savedAt: draft.sampleSavedAt,
    };
}

export function computeAigcRewriteDraftState(
    draft: Omit<AigcRewriteDraft, 'sampleQualityLevel' | 'sampleQualityMessage' | 'updatedAt'>,
    updatedAt = nowIsoString()
): AigcRewriteDraft {
    const quality = evaluateAigcRewriteSampleQuality(draft.sampleBefore, draft.sampleAfter);

    return {
        ...draft,
        sampleQualityLevel: quality.level,
        sampleQualityMessage: quality.message,
        updatedAt,
    };
}

export function createDefaultAigcRewriteDraft(): AigcRewriteDraft {
    return createDefaultDraftBase();
}

export function mergeAigcRewriteDraft(
    current: AigcRewriteDraft,
    patch: Partial<Omit<AigcRewriteDraft, 'sampleQualityLevel' | 'sampleQualityMessage' | 'updatedAt'>>
): AigcRewriteDraft {
    const has = <Key extends keyof typeof patch>(key: Key) =>
        Object.prototype.hasOwnProperty.call(patch, key);

    return computeAigcRewriteDraftState({
        sampleBefore: has('sampleBefore') ? patch.sampleBefore ?? '' : current.sampleBefore,
        sampleAfter: has('sampleAfter') ? patch.sampleAfter ?? '' : current.sampleAfter,
        selectedPresetId: has('selectedPresetId') ? patch.selectedPresetId ?? null : current.selectedPresetId,
        selectedPresetName: has('selectedPresetName') ? patch.selectedPresetName ?? null : current.selectedPresetName,
        selectedPresetDescription: has('selectedPresetDescription')
            ? patch.selectedPresetDescription ?? null
            : current.selectedPresetDescription,
        targetText: has('targetText') ? patch.targetText ?? '' : current.targetText,
        resultText: has('resultText') ? patch.resultText ?? '' : current.resultText,
        thinkingText: has('thinkingText') ? patch.thinkingText ?? '' : current.thinkingText,
        generationPhase: has('generationPhase') ? patch.generationPhase ?? 'idle' : current.generationPhase,
        lastError: has('lastError') ? patch.lastError ?? null : current.lastError,
        sampleSavedAt: has('sampleSavedAt') ? patch.sampleSavedAt ?? null : current.sampleSavedAt,
        hasSeenGuide: has('hasSeenGuide') ? patch.hasSeenGuide === true : current.hasSeenGuide,
        savedSampleBefore: has('savedSampleBefore') ? patch.savedSampleBefore ?? null : current.savedSampleBefore,
        savedSampleAfter: has('savedSampleAfter') ? patch.savedSampleAfter ?? null : current.savedSampleAfter,
    });
}

export function normalizeAigcRewriteDraft(value: unknown): AigcRewriteDraft {
    if (!isRecord(value)) {
        return createDefaultDraftBase();
    }

    const nextGenerationPhase = trimToString(value.generationPhase);
    const generationPhase: AigcRewriteGenerationPhase =
        nextGenerationPhase === 'idle' ||
        nextGenerationPhase === 'streaming' ||
        nextGenerationPhase === 'succeeded' ||
        nextGenerationPhase === 'stopped' ||
        nextGenerationPhase === 'failed'
            ? nextGenerationPhase
            : 'idle';

    const sampleBefore = trimToString(value.sampleBefore);
    const sampleAfter = trimToString(value.sampleAfter);
    const selectedPresetId = trimToString(value.selectedPresetId) || null;
    const selectedPresetName = trimToString(value.selectedPresetName) || null;
    const selectedPresetDescription = trimToString(value.selectedPresetDescription) || null;
    const sampleSavedAt = trimToString(value.sampleSavedAt) || null;
    const savedSampleBefore =
        trimToString(value.savedSampleBefore) || (sampleSavedAt ? sampleBefore : '');
    const savedSampleAfter =
        trimToString(value.savedSampleAfter) || (sampleSavedAt ? sampleAfter : '');

    return computeAigcRewriteDraftState({
        sampleBefore,
        sampleAfter,
        selectedPresetId,
        selectedPresetName,
        selectedPresetDescription,
        targetText: trimToString(value.targetText),
        resultText: trimToString(value.resultText),
        thinkingText: trimToString(value.thinkingText),
        generationPhase: generationPhase === 'streaming' ? 'idle' : generationPhase,
        lastError: trimToString(value.lastError) || null,
        sampleSavedAt,
        hasSeenGuide: value.hasSeenGuide === true,
        savedSampleBefore: savedSampleBefore || null,
        savedSampleAfter: savedSampleAfter || null,
    }, trimToString(value.updatedAt) || nowIsoString());
}
