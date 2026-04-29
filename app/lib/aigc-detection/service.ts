import { ulid } from 'ulid';
import type { Principal } from '../auth/principal';
import { getAppDatabaseContext, type AppDatabaseContext } from '../db/client';
import type {
    AigcDetectionCleanedMarkdownDto,
    AigcDetectionMarkdownDocumentDto,
    AigcDetectionMarkedMarkdownDto,
    AigcDetectionResultDto,
    AigcDetectionTaskDetail,
    AigcDetectionTaskListDto,
    AigcDetectionTaskSummary,
    AigcDetectionTextDetectionDto,
} from './dto';
import { getAigcDetectionClient, type AigcDetectionClientLike } from './client';
import {
    aigcDetectionFileTooLarge,
    aigcDetectionExternalSyncFailed,
    aigcDetectionTaskNotCompleted,
    aigcDetectionTaskNotFound,
    aigcDetectionTaskNotRetryable,
    aigcDetectionUnsupportedFileType,
    aigcDetectionValidationFailed,
} from './errors';
import {
    AigcDetectionRepository,
    type CreateAigcDetectionTaskRowInput,
    type AigcDetectionTaskRow,
} from './repository';
import { persistAigcDetectionFile, readAigcDetectionFile } from './storage';
import { syncAigcDetectionTask } from './sync';
import type { ListAigcDetectionTasksQuery } from './validators';

const SUPPORTED_EXTENSIONS = new Set(['pdf', 'doc', 'docx']);
const DEFAULT_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const DEFAULT_SYNC_STALE_MS = 5000;
const DEFAULT_SYNC_LOCK_MS = 15000;
const DEFAULT_TEXT_MIN_TOKENS = 0;

function readPositiveIntEnv(name: string, fallback: number): number {
    const value = process.env[name]?.trim();
    if (!value) {
        return fallback;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getMaxUploadBytes(): number {
    return readPositiveIntEnv('AIGC_DETECTION_MAX_UPLOAD_BYTES', DEFAULT_MAX_UPLOAD_BYTES);
}

function getSyncStaleMs(): number {
    return readPositiveIntEnv('AIGC_DETECTION_SYNC_STALE_MS', DEFAULT_SYNC_STALE_MS);
}

function getSyncLockMs(): number {
    return readPositiveIntEnv('AIGC_DETECTION_SYNC_LOCK_MS', DEFAULT_SYNC_LOCK_MS);
}

function parseFileExtension(fileName: string): 'pdf' | 'doc' | 'docx' {
    const parts = fileName.split('.');
    const extension = parts.length > 1 ? parts.at(-1)?.toLowerCase() : '';

    if (!extension || !SUPPORTED_EXTENSIONS.has(extension)) {
        throw aigcDetectionUnsupportedFileType(extension || 'unknown');
    }

    return extension as 'pdf' | 'doc' | 'docx';
}

function mapTaskSummary(task: AigcDetectionTaskRow): AigcDetectionTaskSummary {
    return {
        id: task.id,
        workspaceId: task.workspaceId,
        sourceFileName: task.sourceFileName,
        sourceFileExt: task.sourceFileExt,
        sourceFileSize: task.sourceFileSize,
        sourceFileSha256: task.sourceFileSha256,
        status: task.status,
        externalStatus: task.externalStatus,
        progressCurrent: task.progressCurrent,
        progressTotal: task.progressTotal,
        progressUnit: task.progressUnit,
        overallScore: task.resultOverallScore,
        errorCode: task.errorCode,
        errorMessage: task.errorMessage,
        retryCount: task.retryCount,
        deduplicated: task.deduplicated,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        completedAt: task.completedAt,
    };
}

function mapTaskDetail(task: AigcDetectionTaskRow): AigcDetectionTaskDetail {
    return {
        ...mapTaskSummary(task),
        canRetry: task.status === 'submit_failed' || task.status === 'failed',
        resultAvailable: task.status === 'succeeded' && task.resultJson !== null,
        submittedAt: task.submittedAt,
        lastSyncedAt: task.lastSyncedAt,
    };
}

function readCachedMarkdownDocument(task: AigcDetectionTaskRow): AigcDetectionMarkdownDocumentDto | null {
    if (!task.resultJson) {
        return null;
    }

    const result = JSON.parse(task.resultJson) as Partial<AigcDetectionResultDto>;
    return result.markdownDocument ?? null;
}

function normalizeTextMinTokens(value: number | null | undefined): number {
    if (value === null || value === undefined) {
        return DEFAULT_TEXT_MIN_TOKENS;
    }

    if (!Number.isInteger(value) || value < 0) {
        throw aigcDetectionValidationFailed('minTokens must be a non-negative integer');
    }

    return value;
}

async function fileToBytes(file: File): Promise<Uint8Array> {
    return new Uint8Array(await file.arrayBuffer());
}

function buildCreateTaskSeed(options: {
    principal: Principal;
    taskId: string;
    createdAt: number;
    fileName: string;
    mimeType: string;
    extension: 'pdf' | 'doc' | 'docx';
    fileSize: number;
    sha256: string;
    storagePath: string;
    idempotencyKey: string;
}): CreateAigcDetectionTaskRowInput {
    return {
        id: options.taskId,
        workspaceId: options.principal.activeWorkspaceId,
        createdBy: options.principal.userId,
        updatedBy: options.principal.userId,
        status: 'queued_local',
        sourceFileName: options.fileName,
        sourceFileExt: options.extension,
        sourceMimeType: options.mimeType,
        sourceFileSize: options.fileSize,
        sourceFileSha256: options.sha256,
        storagePath: options.storagePath,
        idempotencyKey: options.idempotencyKey,
        deduplicated: false,
        createdAt: options.createdAt,
        updatedAt: options.createdAt,
    };
}

export class AigcDetectionService {
    private readonly repository: AigcDetectionRepository;

    constructor(
        private readonly database: AppDatabaseContext = getAppDatabaseContext(),
        private readonly client: AigcDetectionClientLike = getAigcDetectionClient()
    ) {
        this.repository = new AigcDetectionRepository(this.database.db);
    }

    async createTask(
        principal: Principal,
        input: { file: File; forceReprocess: boolean }
    ): Promise<{ task: AigcDetectionTaskDetail; reusedResult: boolean }> {
        if (!input.file || input.file.size === 0) {
            throw aigcDetectionValidationFailed('Uploaded file is required');
        }

        const maxBytes = getMaxUploadBytes();
        if (input.file.size > maxBytes) {
            throw aigcDetectionFileTooLarge(maxBytes);
        }

        const extension = parseFileExtension(input.file.name);
        const bytes = await fileToBytes(input.file);
        const now = Date.now();
        const taskId = ulid();
        const storedFile = await persistAigcDetectionFile({
            taskId,
            workspaceId: principal.activeWorkspaceId,
            fileName: input.file.name,
            mimeType: input.file.type || 'application/octet-stream',
            extension,
            bytes,
        });
        const idempotencyKey = ulid();
        const taskSeed = buildCreateTaskSeed({
            principal,
            taskId,
            createdAt: now,
            fileName: input.file.name,
            mimeType: storedFile.mimeType,
            extension,
            fileSize: storedFile.size,
            sha256: storedFile.sha256,
            storagePath: storedFile.relativePath,
            idempotencyKey,
        });

        const existingTask =
            !input.forceReprocess
                ? this.repository.findSucceededTaskBySha256(principal.activeWorkspaceId, storedFile.sha256)
                : null;

        if (existingTask) {
            this.database.db.transaction((tx) => {
                const repository = new AigcDetectionRepository(tx);
                repository.createTask({
                    ...taskSeed,
                    status: 'succeeded',
                    deduplicated: true,
                    externalTaskId: null,
                    externalStatus: existingTask.externalStatus,
                    progressCurrent: existingTask.progressCurrent,
                    progressTotal: existingTask.progressTotal,
                    progressUnit: existingTask.progressUnit,
                    resultOverallScore: existingTask.resultOverallScore,
                    resultHumanScore: existingTask.resultHumanScore,
                    resultSummary: existingTask.resultSummary,
                    resultJson: existingTask.resultJson,
                    rawResultJson: existingTask.rawResultJson,
                    submittedAt: now,
                    completedAt: now,
                    lastSyncedAt: existingTask.lastSyncedAt,
                });
                repository.appendEvent({
                    taskId,
                    workspaceId: principal.activeWorkspaceId,
                    eventType: 'task_created',
                    toStatus: 'succeeded',
                    payloadJson: JSON.stringify({ reusedFromTaskId: existingTask.id }),
                    operatorType: 'user',
                    createdBy: principal.userId,
                    createdAt: now,
                });
            });

            const detail = this.requireTask(principal.activeWorkspaceId, taskId);
            return {
                task: mapTaskDetail(detail),
                reusedResult: true,
            };
        }

        this.database.db.transaction((tx) => {
            const repository = new AigcDetectionRepository(tx);
            repository.createTask(taskSeed);
            repository.appendEvent({
                taskId,
                workspaceId: principal.activeWorkspaceId,
                eventType: 'task_created',
                toStatus: 'queued_local',
                operatorType: 'user',
                createdBy: principal.userId,
                createdAt: now,
            });
            repository.appendEvent({
                taskId,
                workspaceId: principal.activeWorkspaceId,
                eventType: 'file_saved',
                toStatus: 'queued_local',
                payloadJson: JSON.stringify({
                    sha256: storedFile.sha256,
                    storagePath: storedFile.relativePath,
                    size: storedFile.size,
                }),
                operatorType: 'user',
                createdBy: principal.userId,
                createdAt: now,
            });
        });

        try {
            const created = await this.client.createTask({
                fileName: storedFile.originalFileName,
                mimeType: storedFile.mimeType,
                bytes,
                idempotencyKey,
                forceReprocess: input.forceReprocess,
                metadata: {
                    workspaceId: principal.activeWorkspaceId,
                    userId: principal.userId,
                    localTaskId: taskId,
                },
            });

            const nextStatus = created.status === 'succeeded' ? 'processing' : 'submitted';
            this.database.db.transaction((tx) => {
                const repository = new AigcDetectionRepository(tx);
                repository.updateTask(taskId, principal.activeWorkspaceId, {
                    updatedBy: principal.userId,
                    status: nextStatus,
                    externalTaskId: created.taskId,
                    externalStatus: created.status,
                    deduplicated: created.deduplicated,
                    submittedAt: now,
                    updatedAt: now,
                });
                repository.appendEvent({
                    taskId,
                    workspaceId: principal.activeWorkspaceId,
                    eventType: 'submit_succeeded',
                    fromStatus: 'queued_local',
                    toStatus: nextStatus,
                    payloadJson: JSON.stringify({
                        externalTaskId: created.taskId,
                        externalStatus: created.status,
                        deduplicated: created.deduplicated,
                    }),
                    operatorType: 'user',
                    createdBy: principal.userId,
                    createdAt: now,
                });
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to submit task';
            this.database.db.transaction((tx) => {
                const repository = new AigcDetectionRepository(tx);
                repository.updateTask(taskId, principal.activeWorkspaceId, {
                    updatedBy: principal.userId,
                    status: 'submit_failed',
                    errorCode:
                        typeof error === 'object' &&
                        error !== null &&
                        'code' in error &&
                        typeof error.code === 'string'
                            ? error.code
                            : 'AIGC_DETECTION_EXTERNAL_SUBMIT_FAILED',
                    errorMessage: message,
                    updatedAt: now,
                });
                repository.appendEvent({
                    taskId,
                    workspaceId: principal.activeWorkspaceId,
                    eventType: 'submit_failed',
                    fromStatus: 'queued_local',
                    toStatus: 'submit_failed',
                    payloadJson: JSON.stringify({ message }),
                    operatorType: 'user',
                    createdBy: principal.userId,
                    createdAt: now,
                });
            });

            throw error;
        }

        const task = this.requireTask(principal.activeWorkspaceId, taskId);
        return {
            task: mapTaskDetail(task),
            reusedResult: false,
        };
    }

    listTasks(principal: Principal, query: ListAigcDetectionTasksQuery): AigcDetectionTaskListDto {
        const result = this.repository.listTasks({
            workspaceId: principal.activeWorkspaceId,
            page: query.page,
            pageSize: query.pageSize,
            status: query.status,
            keyword: query.keyword,
            createdBy: query.createdBy,
        });

        return {
            items: result.items.map(mapTaskSummary),
            pagination: {
                page: query.page,
                pageSize: query.pageSize,
                total: result.total,
            },
        };
    }

    async detectText(
        principal: Principal,
        input: { text: string; minTokens?: number | null }
    ): Promise<AigcDetectionTextDetectionDto> {
        void principal;
        const text = input.text.trim();
        if (!text) {
            throw aigcDetectionValidationFailed('Text is required');
        }

        const minTokens = normalizeTextMinTokens(input.minTokens);
        return this.client.detectText({
            text,
            minTokens,
        });
    }

    async getTaskDetail(principal: Principal, taskId: string): Promise<AigcDetectionTaskDetail> {
        let task = this.requireTask(principal.activeWorkspaceId, taskId);
        task = await this.syncIfNeeded(task);
        return mapTaskDetail(task);
    }

    async getTaskResult(principal: Principal, taskId: string): Promise<AigcDetectionResultDto> {
        let task = this.requireTask(principal.activeWorkspaceId, taskId);
        task = await this.syncIfNeeded(task);

        if (task.status !== 'succeeded' || !task.resultJson || task.completedAt === null) {
            throw aigcDetectionTaskNotCompleted();
        }

        return JSON.parse(task.resultJson) as AigcDetectionResultDto;
    }

    async getTaskCleanedMarkdown(principal: Principal, taskId: string): Promise<AigcDetectionCleanedMarkdownDto> {
        let task = this.requireTask(principal.activeWorkspaceId, taskId);
        task = await this.syncIfNeeded(task);

        if (task.status !== 'succeeded') {
            throw aigcDetectionTaskNotCompleted();
        }

        const cachedDocument = readCachedMarkdownDocument(task);
        if (cachedDocument) {
            return {
                taskId: task.id,
                status: 'succeeded',
                markdown: cachedDocument.cleanedMarkdown,
            };
        }

        if (!task.externalTaskId) {
            throw aigcDetectionExternalSyncFailed('AIGC detection task is missing external task id');
        }

        const markdown = await this.client.getTaskCleanedMarkdown(task.externalTaskId);
        return {
            ...markdown,
            taskId: task.id,
        };
    }

    async getTaskMarkedMarkdown(principal: Principal, taskId: string): Promise<AigcDetectionMarkedMarkdownDto> {
        let task = this.requireTask(principal.activeWorkspaceId, taskId);
        task = await this.syncIfNeeded(task);

        if (task.status !== 'succeeded') {
            throw aigcDetectionTaskNotCompleted();
        }

        const cachedDocument = readCachedMarkdownDocument(task);
        if (cachedDocument) {
            return {
                taskId: task.id,
                status: 'succeeded',
                markdown: cachedDocument.markedMarkdown,
                markerStart: cachedDocument.markerStart,
                markerEnd: cachedDocument.markerEnd,
                markedAiSentenceCount: cachedDocument.markedAiSentenceCount,
                unmatchedAiSentenceCount: cachedDocument.unmatchedAiSentenceCount,
                spans: cachedDocument.spans,
            };
        }

        if (!task.externalTaskId) {
            throw aigcDetectionExternalSyncFailed('AIGC detection task is missing external task id');
        }

        const markdown = await this.client.getTaskMarkedMarkdown(task.externalTaskId);
        return {
            ...markdown,
            taskId: task.id,
        };
    }

    async retryTask(principal: Principal, taskId: string): Promise<AigcDetectionTaskDetail> {
        const task = this.requireTask(principal.activeWorkspaceId, taskId);
        if (task.status !== 'submit_failed' && task.status !== 'failed') {
            throw aigcDetectionTaskNotRetryable();
        }

        const now = Date.now();
        const bytes = await readAigcDetectionFile(task.storagePath);
        const idempotencyKey = ulid();

        this.database.db.transaction((tx) => {
            const repository = new AigcDetectionRepository(tx);
            repository.appendEvent({
                taskId,
                workspaceId: principal.activeWorkspaceId,
                eventType: 'retry_requested',
                fromStatus: task.status,
                operatorType: 'user',
                createdBy: principal.userId,
                createdAt: now,
            });
        });

        const created = await this.client.createTask({
            fileName: task.sourceFileName,
            mimeType: task.sourceMimeType,
            bytes,
            idempotencyKey,
            forceReprocess: true,
            metadata: {
                workspaceId: principal.activeWorkspaceId,
                userId: principal.userId,
                localTaskId: taskId,
                retryCount: String(task.retryCount + 1),
            },
        });

        const nextStatus = created.status === 'succeeded' ? 'processing' : 'submitted';
        this.database.db.transaction((tx) => {
            const repository = new AigcDetectionRepository(tx);
            repository.updateTask(taskId, principal.activeWorkspaceId, {
                updatedBy: principal.userId,
                status: nextStatus,
                idempotencyKey,
                externalTaskId: created.taskId,
                externalStatus: created.status,
                deduplicated: created.deduplicated,
                progressCurrent: null,
                progressTotal: null,
                progressUnit: null,
                resultOverallScore: null,
                resultHumanScore: null,
                resultSummary: null,
                resultJson: null,
                rawResultJson: null,
                errorCode: null,
                errorMessage: null,
                submittedAt: now,
                completedAt: null,
                lastSyncedAt: null,
                lastSyncErrorAt: null,
                retryCount: task.retryCount + 1,
                updatedAt: now,
            });
            repository.appendEvent({
                taskId,
                workspaceId: principal.activeWorkspaceId,
                eventType: 'retry_submitted',
                fromStatus: task.status,
                toStatus: nextStatus,
                payloadJson: JSON.stringify({
                    externalTaskId: created.taskId,
                    deduplicated: created.deduplicated,
                }),
                operatorType: 'user',
                createdBy: principal.userId,
                createdAt: now,
            });
        });

        return mapTaskDetail(this.requireTask(principal.activeWorkspaceId, taskId));
    }

    private requireTask(workspaceId: string, taskId: string): AigcDetectionTaskRow {
        const task = this.repository.findTaskById(workspaceId, taskId);
        if (!task) {
            throw aigcDetectionTaskNotFound(taskId);
        }

        return task;
    }

    private async syncIfNeeded(task: AigcDetectionTaskRow): Promise<AigcDetectionTaskRow> {
        if (task.status !== 'submitted' && task.status !== 'processing') {
            return task;
        }

        const staleMs = getSyncStaleMs();
        const now = Date.now();
        if (task.lastSyncedAt !== null && now - task.lastSyncedAt <= staleMs) {
            return task;
        }

        const lockAcquired = this.repository.claimSyncLock(
            task.id,
            task.workspaceId,
            now,
            now + getSyncLockMs()
        );

        if (!lockAcquired) {
            return this.requireTask(task.workspaceId, task.id);
        }

        try {
            await syncAigcDetectionTask({
                client: this.client,
                repository: this.repository,
                task,
                now,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to sync task';
            this.database.db.transaction((tx) => {
                const repository = new AigcDetectionRepository(tx);
                repository.updateTask(task.id, task.workspaceId, {
                    errorCode:
                        typeof error === 'object' &&
                        error !== null &&
                        'code' in error &&
                        typeof error.code === 'string'
                            ? error.code
                            : 'AIGC_DETECTION_EXTERNAL_SYNC_FAILED',
                    errorMessage: message,
                    lastSyncErrorAt: now,
                    updatedAt: now,
                    syncingUntil: null,
                });
                repository.appendEvent({
                    taskId: task.id,
                    workspaceId: task.workspaceId,
                    eventType: 'sync_failed',
                    fromStatus: task.status,
                    payloadJson: JSON.stringify({ message }),
                    operatorType: 'system',
                    createdAt: now,
                });
            });
        } finally {
            this.repository.releaseSyncLock(task.id, task.workspaceId, Date.now());
        }

        return this.requireTask(task.workspaceId, task.id);
    }
}

let aigcDetectionService: AigcDetectionService | null = null;

export function getAigcDetectionService(): AigcDetectionService {
    if (!aigcDetectionService) {
        aigcDetectionService = new AigcDetectionService();
    }

    return aigcDetectionService;
}
