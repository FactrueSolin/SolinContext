import { z } from 'zod';
import type {
    AigcDetectionCleanedMarkdownDto,
    AigcDetectionMarkedMarkdownDto,
    AigcDetectionMarkedMarkdownSpanDto,
    AigcDetectionResultDto,
    AigcDetectionSegmentDto,
    AigcDetectionSentenceDto,
    ExternalCreateTaskResponse,
    ExternalTaskResultResponse,
    ExternalTaskStatusResponse,
} from './dto';
import { aigcDetectionExternalSubmitFailed, aigcDetectionExternalSyncFailed } from './errors';

const externalCreateTaskSchema = z.object({
    task_id: z.string().min(1),
    status: z.string().min(1),
    deduplicated: z.boolean(),
    status_url: z.string().min(1),
    result_url: z.string().min(1),
});

const externalTaskStatusSchema = z.object({
    task_id: z.string().min(1),
    status: z.string().min(1),
    stage: z.string().min(1),
    progress: z
        .object({
            current: z.number().int().min(0),
            total: z.number().int().min(0),
            unit: z.string().min(1),
        })
        .nullable()
        .default(null),
    source_file_name: z.string().min(1),
    created_at: z.string().min(1),
    updated_at: z.string().min(1),
    error: z
        .object({
            code: z.string().min(1),
            message: z.string().min(1),
        })
        .nullable()
        .default(null),
});

const externalSentenceSchema = z.object({
    sentence_id: z.string().min(1),
    block_id: z.string().min(1),
    order: z.number().int().min(0),
    text: z.string(),
    ai_probability: z.number().min(0).max(1),
    label: z.string(),
    probability_method: z.string(),
});

const externalBlockSchema = z.object({
    block_id: z.string().min(1),
    order: z.number().int().min(0),
    page_start: z.number().int().min(0),
    page_end: z.number().int().min(0),
    block_type: z.string(),
    section_path: z.array(z.string()),
    text: z.string(),
    char_count: z.number().int().min(0),
    token_count: z.number().int().min(0),
    ai_probability: z.number().min(0).max(1),
    label: z.string(),
    probability_method: z.string(),
});

const externalMarkedMarkdownSpanSchema = z.object({
    sentence_id: z.string().min(1),
    block_id: z.string().min(1),
    order: z.number().int().min(0),
    start: z.number().int().min(0),
    end: z.number().int().min(0),
    text: z.string(),
    ai_probability: z.number().min(0).max(1),
    probability_method: z.string(),
    matched: z.boolean(),
});

const externalMarkdownDocumentSchema = z.object({
    cleaned_markdown: z.string(),
    marked_markdown: z.string(),
    marker_start: z.string(),
    marker_end: z.string(),
    marked_ai_sentence_count: z.number().int().min(0),
    unmatched_ai_sentence_count: z.number().int().min(0),
    spans: z.array(externalMarkedMarkdownSpanSchema),
});

const externalTaskResultSchema = z.object({
    task_id: z.string().min(1),
    status: z.string().min(1),
    document_result: z.object({
        document_ai_probability: z.number().min(0).max(1),
        label: z.string(),
        probability_method: z.string(),
        block_count: z.number().int().min(0),
        scored_block_count: z.number().int().min(0),
        skipped_block_count: z.number().int().min(0),
        total_char_count: z.number().int().min(0),
        total_token_count: z.number().int().min(0),
    }),
    cleaned_document: z.object({
        cleaned_full_text: z.string(),
        cleaned_blocks: z.array(
            z.object({
                block_id: z.string().min(1),
                order: z.number().int().min(0),
                text: z.string(),
            })
        ),
    }),
    markdown_document: externalMarkdownDocumentSchema.nullish(),
    ai_sentences: z.array(externalSentenceSchema),
    blocks: z.array(externalBlockSchema),
});

const externalCleanedMarkdownSchema = z.object({
    task_id: z.string().min(1),
    status: z.string().min(1),
    markdown: z.string(),
});

const externalMarkedMarkdownSchema = z.object({
    task_id: z.string().min(1),
    status: z.string().min(1),
    markdown: z.string(),
    marker_start: z.string(),
    marker_end: z.string(),
    marked_ai_sentence_count: z.number().int().min(0),
    unmatched_ai_sentence_count: z.number().int().min(0),
    spans: z.array(externalMarkedMarkdownSpanSchema),
});

function toSentenceDto(sentence: z.infer<typeof externalSentenceSchema>): AigcDetectionSentenceDto {
    return {
        sentenceId: sentence.sentence_id,
        blockId: sentence.block_id,
        order: sentence.order,
        text: sentence.text,
        aiProbability: sentence.ai_probability,
        label: sentence.label,
        probabilityMethod: sentence.probability_method,
    };
}

function toSegmentDto(block: z.infer<typeof externalBlockSchema>): AigcDetectionSegmentDto {
    return {
        blockId: block.block_id,
        order: block.order,
        pageStart: block.page_start,
        pageEnd: block.page_end,
        blockType: block.block_type,
        sectionPath: block.section_path,
        text: block.text,
        charCount: block.char_count,
        tokenCount: block.token_count,
        aiProbability: block.ai_probability,
        label: block.label,
        probabilityMethod: block.probability_method,
    };
}

function toMarkedMarkdownSpanDto(
    span: z.infer<typeof externalMarkedMarkdownSpanSchema>
): AigcDetectionMarkedMarkdownSpanDto {
    return {
        sentenceId: span.sentence_id,
        blockId: span.block_id,
        order: span.order,
        start: span.start,
        end: span.end,
        text: span.text,
        aiProbability: span.ai_probability,
        probabilityMethod: span.probability_method,
        matched: span.matched,
    };
}

function toMarkdownDocumentDto(document: z.infer<typeof externalMarkdownDocumentSchema>) {
    return {
        cleanedMarkdown: document.cleaned_markdown,
        markedMarkdown: document.marked_markdown,
        markerStart: document.marker_start,
        markerEnd: document.marker_end,
        markedAiSentenceCount: document.marked_ai_sentence_count,
        unmatchedAiSentenceCount: document.unmatched_ai_sentence_count,
        spans: document.spans.map(toMarkedMarkdownSpanDto),
    };
}

export function parseExternalCreateTaskResponse(payload: unknown): ExternalCreateTaskResponse {
    const result = externalCreateTaskSchema.safeParse(payload);
    if (!result.success) {
        throw aigcDetectionExternalSubmitFailed('AIGC detection submit response is invalid', result.error.flatten());
    }

    return {
        taskId: result.data.task_id,
        status: result.data.status,
        deduplicated: result.data.deduplicated,
        statusUrl: result.data.status_url,
        resultUrl: result.data.result_url,
    };
}

export function parseExternalTaskStatusResponse(payload: unknown): ExternalTaskStatusResponse {
    const result = externalTaskStatusSchema.safeParse(payload);
    if (!result.success) {
        throw aigcDetectionExternalSyncFailed('AIGC detection status response is invalid', result.error.flatten());
    }

    return {
        taskId: result.data.task_id,
        status: result.data.status,
        stage: result.data.stage,
        progress: result.data.progress,
        sourceFileName: result.data.source_file_name,
        createdAt: result.data.created_at,
        updatedAt: result.data.updated_at,
        error: result.data.error,
    };
}

export function parseExternalTaskResultResponse(payload: unknown): ExternalTaskResultResponse {
    const result = externalTaskResultSchema.safeParse(payload);
    if (!result.success) {
        throw aigcDetectionExternalSyncFailed('AIGC detection result response is invalid', result.error.flatten());
    }

    return {
        taskId: result.data.task_id,
        status: result.data.status,
        documentResult: {
            documentAiProbability: result.data.document_result.document_ai_probability,
            label: result.data.document_result.label,
            probabilityMethod: result.data.document_result.probability_method,
            blockCount: result.data.document_result.block_count,
            scoredBlockCount: result.data.document_result.scored_block_count,
            skippedBlockCount: result.data.document_result.skipped_block_count,
            totalCharCount: result.data.document_result.total_char_count,
            totalTokenCount: result.data.document_result.total_token_count,
        },
        cleanedDocument: {
            cleanedFullText: result.data.cleaned_document.cleaned_full_text,
            cleanedBlocks: result.data.cleaned_document.cleaned_blocks.map((block) => ({
                blockId: block.block_id,
                order: block.order,
                text: block.text,
            })),
        },
        markdownDocument: result.data.markdown_document
            ? toMarkdownDocumentDto(result.data.markdown_document)
            : null,
        aiSentences: result.data.ai_sentences.map(toSentenceDto),
        blocks: result.data.blocks.map(toSegmentDto),
    };
}

export function parseExternalCleanedMarkdownResponse(payload: unknown): AigcDetectionCleanedMarkdownDto {
    const result = externalCleanedMarkdownSchema.safeParse(payload);
    if (!result.success) {
        throw aigcDetectionExternalSyncFailed('AIGC detection cleaned markdown response is invalid', result.error.flatten());
    }

    return {
        taskId: result.data.task_id,
        status: result.data.status,
        markdown: result.data.markdown,
    };
}

export function parseExternalMarkedMarkdownResponse(payload: unknown): AigcDetectionMarkedMarkdownDto {
    const result = externalMarkedMarkdownSchema.safeParse(payload);
    if (!result.success) {
        throw aigcDetectionExternalSyncFailed('AIGC detection marked markdown response is invalid', result.error.flatten());
    }

    return {
        taskId: result.data.task_id,
        status: result.data.status,
        markdown: result.data.markdown,
        markerStart: result.data.marker_start,
        markerEnd: result.data.marker_end,
        markedAiSentenceCount: result.data.marked_ai_sentence_count,
        unmatchedAiSentenceCount: result.data.unmatched_ai_sentence_count,
        spans: result.data.spans.map(toMarkedMarkdownSpanDto),
    };
}

export function toAigcDetectionResultDto(
    externalResult: ExternalTaskResultResponse,
    task: { id: string; createdAt: number; completedAt: number }
): AigcDetectionResultDto {
    return {
        taskId: task.id,
        status: 'succeeded',
        overallScore: externalResult.documentResult.documentAiProbability,
        humanScore: 1 - externalResult.documentResult.documentAiProbability,
        summary: externalResult.documentResult.label,
        segments: externalResult.blocks,
        sentences: externalResult.aiSentences,
        markdownDocument: externalResult.markdownDocument,
        createdAt: task.createdAt,
        completedAt: task.completedAt,
    };
}
