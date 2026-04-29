import {
    aigcDetectionTaskEventOperatorTypes,
    aigcDetectionTaskEventTypes,
    aigcDetectionTaskStatuses,
} from '../db/schema/aigc-detection';

export type AigcDetectionTaskStatus = (typeof aigcDetectionTaskStatuses)[number];
export type AigcDetectionTaskEventType = (typeof aigcDetectionTaskEventTypes)[number];
export type AigcDetectionTaskEventOperatorType = (typeof aigcDetectionTaskEventOperatorTypes)[number];

export interface AigcDetectionSegmentDto {
    blockId: string;
    order: number;
    pageStart: number;
    pageEnd: number;
    blockType: string;
    sectionPath: string[];
    text: string;
    charCount: number;
    tokenCount: number;
    aiProbability: number;
    label: string;
    probabilityMethod: string;
}

export interface AigcDetectionSentenceDto {
    sentenceId: string;
    blockId: string;
    order: number;
    text: string;
    aiProbability: number;
    label: string;
    probabilityMethod: string;
}

export interface AigcDetectionMarkedMarkdownSpanDto {
    sentenceId: string;
    blockId: string;
    order: number;
    start: number;
    end: number;
    text: string;
    aiProbability: number;
    probabilityMethod: string;
    matched: boolean;
}

export interface AigcDetectionCleanedMarkdownDto {
    taskId: string;
    status: string;
    markdown: string;
}

export interface AigcDetectionMarkedMarkdownDto extends AigcDetectionCleanedMarkdownDto {
    markerStart: string;
    markerEnd: string;
    markedAiSentenceCount: number;
    unmatchedAiSentenceCount: number;
    spans: AigcDetectionMarkedMarkdownSpanDto[];
}

export interface AigcDetectionMarkdownDocumentDto {
    cleanedMarkdown: string;
    markedMarkdown: string;
    markerStart: string;
    markerEnd: string;
    markedAiSentenceCount: number;
    unmatchedAiSentenceCount: number;
    spans: AigcDetectionMarkedMarkdownSpanDto[];
}

export interface AigcDetectionResultDto {
    taskId: string;
    status: 'succeeded';
    overallScore: number;
    humanScore: number | null;
    summary: string | null;
    segments: AigcDetectionSegmentDto[];
    sentences: AigcDetectionSentenceDto[];
    markdownDocument: AigcDetectionMarkdownDocumentDto | null;
    createdAt: number;
    completedAt: number;
}

export interface AigcDetectionTaskSummary {
    id: string;
    workspaceId: string;
    sourceFileName: string;
    sourceFileExt: 'pdf' | 'doc' | 'docx';
    sourceFileSize: number;
    sourceFileSha256: string;
    status: AigcDetectionTaskStatus;
    externalStatus: string | null;
    progressCurrent: number | null;
    progressTotal: number | null;
    progressUnit: string | null;
    overallScore: number | null;
    errorCode: string | null;
    errorMessage: string | null;
    retryCount: number;
    deduplicated: boolean;
    createdAt: number;
    updatedAt: number;
    completedAt: number | null;
}

export interface AigcDetectionTaskDetail extends AigcDetectionTaskSummary {
    canRetry: boolean;
    resultAvailable: boolean;
    submittedAt: number | null;
    lastSyncedAt: number | null;
}

export interface AigcDetectionTaskListDto {
    items: AigcDetectionTaskSummary[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
    };
}

export interface ExternalCreateTaskResponse {
    taskId: string;
    status: string;
    deduplicated: boolean;
    statusUrl: string;
    resultUrl: string;
}

export interface ExternalTaskProgress {
    current: number;
    total: number;
    unit: string;
}

export interface ExternalTaskErrorInfo {
    code: string;
    message: string;
}

export interface ExternalTaskStatusResponse {
    taskId: string;
    status: string;
    stage: string;
    progress: ExternalTaskProgress | null;
    sourceFileName: string;
    createdAt: string;
    updatedAt: string;
    error: ExternalTaskErrorInfo | null;
}

export interface ExternalTaskResultResponse {
    taskId: string;
    status: string;
    documentResult: {
        documentAiProbability: number;
        label: string;
        probabilityMethod: string;
        blockCount: number;
        scoredBlockCount: number;
        skippedBlockCount: number;
        totalCharCount: number;
        totalTokenCount: number;
    };
    cleanedDocument: {
        cleanedFullText: string;
        cleanedBlocks: Array<{
            blockId: string;
            order: number;
            text: string;
        }>;
    };
    markdownDocument: AigcDetectionMarkdownDocumentDto | null;
    aiSentences: AigcDetectionSentenceDto[];
    blocks: AigcDetectionSegmentDto[];
}
