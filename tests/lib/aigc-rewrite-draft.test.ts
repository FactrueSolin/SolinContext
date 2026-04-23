import { describe, expect, it } from 'vitest';
import {
    createAigcRewriteStorageKey,
    evaluateAigcRewriteSampleQuality,
    getSavedAigcRewriteSample,
    normalizeAigcRewriteDraft,
} from '../../app/lib/aigc-rewrite/draft';

describe('AIGC rewrite draft helpers', () => {
    it('builds workspace-scoped storage keys', () => {
        expect(createAigcRewriteStorageKey('team-alpha')).toBe('aicontext:aigc-rewrite:team-alpha');
    });

    it('marks incomplete samples as unsavable', () => {
        const quality = evaluateAigcRewriteSampleQuality('', '改写后');

        expect(quality.level).toBe('empty');
        expect(quality.canSave).toBe(false);
        expect(quality.message).toContain('补全');
    });

    it('warns when samples are too similar', () => {
        const quality = evaluateAigcRewriteSampleQuality(
            '这是一个非常接近的原始段落，主要只是替换了几个词语，整体结构和句式几乎保持一致，而且结尾仍然沿用了原本的论述顺序与表达方式。',
            '这是一个非常相近的原始段落，主要只是更换了几个词语，整体结构和句式几乎保持一致，而且结尾依旧沿用了原来的论述顺序与表达方式。'
        );

        expect(quality.level).toBe('warning');
        expect(quality.canSave).toBe(true);
        expect(quality.issues[0]).toContain('差异较小');
    });

    it('accepts clear and sufficiently long rewritten samples', () => {
        const quality = evaluateAigcRewriteSampleQuality(
            '本文尝试从课堂参与、作业反馈和阶段复盘三个维度分析学习效果，并结合个人经历解释为什么前期准备不足会影响后续执行质量，同时说明时间分配失衡如何逐步放大问题。',
            '如果换成我平时写作的方式，我会先交代自己在课堂上到底跟没跟住，再把作业里暴露出的拖延和准备不足说清楚，最后补一段复盘，把前面的原因、过程里的犹豫以及后面结果为什么会变差连起来写。'
        );

        expect(quality.level).toBe('ready');
        expect(quality.canSave).toBe(true);
        expect(quality.issues).toEqual([]);
    });

    it('normalizes persisted drafts and recovers saved sample snapshots', () => {
        const draft = normalizeAigcRewriteDraft({
            sampleBefore: '原文',
            sampleAfter: '改文',
            targetText: '目标',
            resultText: '结果',
            thinkingText: '思考',
            generationPhase: 'streaming',
            lastError: 'error',
            sampleSavedAt: '2026-04-23T12:00:00.000Z',
            hasSeenGuide: true,
            updatedAt: '2026-04-23T12:01:00.000Z',
        });

        expect(draft.generationPhase).toBe('idle');
        expect(draft.sampleSavedAt).toBe('2026-04-23T12:00:00.000Z');
        expect(getSavedAigcRewriteSample(draft)).toEqual({
            before: '原文',
            after: '改文',
            savedAt: '2026-04-23T12:00:00.000Z',
        });
    });
});
