import { and, desc, eq, like, or, sql } from 'drizzle-orm';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { ulid } from 'ulid';
import {
    aigcDetectionTaskEvents,
    aigcDetectionTasks,
    aigcDetectionTaskEventOperatorTypes,
    aigcDetectionTaskEventTypes,
    aigcDetectionTaskStatuses,
} from '../db/schema/aigc-detection';
import * as schema from '../db/schema';

type AigcDetectionDatabase = BetterSQLite3Database<typeof schema>;

export type AigcDetectionTaskStatus = (typeof aigcDetectionTaskStatuses)[number];
export type AigcDetectionTaskEventType = (typeof aigcDetectionTaskEventTypes)[number];
export type AigcDetectionTaskEventOperatorType = (typeof aigcDetectionTaskEventOperatorTypes)[number];

export interface AigcDetectionTaskRow {
    id: string;
    workspaceId: string;
    createdBy: string;
    updatedBy: string | null;
    status: AigcDetectionTaskStatus;
    externalTaskId: string | null;
    externalStatus: string | null;
    sourceFileName: string;
    sourceFileExt: 'pdf' | 'doc' | 'docx';
    sourceMimeType: string;
    sourceFileSize: number;
    sourceFileSha256: string;
    storagePath: string;
    storageStatus: 'active' | 'deleted';
    idempotencyKey: string;
    deduplicated: boolean;
    progressCurrent: number | null;
    progressTotal: number | null;
    progressUnit: string | null;
    resultOverallScore: number | null;
    resultHumanScore: number | null;
    resultSummary: string | null;
    resultJson: string | null;
    rawResultJson: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    submittedAt: number | null;
    completedAt: number | null;
    lastSyncedAt: number | null;
    lastSyncErrorAt: number | null;
    retryCount: number;
    syncingUntil: number | null;
    createdAt: number;
    updatedAt: number;
}

export interface ListAigcDetectionTasksParams {
    workspaceId: string;
    page: number;
    pageSize: number;
    status: AigcDetectionTaskStatus | 'all';
    keyword?: string;
    createdBy?: string;
}

export interface CreateAigcDetectionTaskRowInput {
    id: string;
    workspaceId: string;
    createdBy: string;
    updatedBy: string | null;
    status: AigcDetectionTaskStatus;
    externalTaskId?: string | null;
    externalStatus?: string | null;
    sourceFileName: string;
    sourceFileExt: 'pdf' | 'doc' | 'docx';
    sourceMimeType: string;
    sourceFileSize: number;
    sourceFileSha256: string;
    storagePath: string;
    idempotencyKey: string;
    deduplicated: boolean;
    progressCurrent?: number | null;
    progressTotal?: number | null;
    progressUnit?: string | null;
    resultOverallScore?: number | null;
    resultHumanScore?: number | null;
    resultSummary?: string | null;
    resultJson?: string | null;
    rawResultJson?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    submittedAt?: number | null;
    completedAt?: number | null;
    lastSyncedAt?: number | null;
    lastSyncErrorAt?: number | null;
    retryCount?: number;
    syncingUntil?: number | null;
    createdAt: number;
    updatedAt: number;
}

export interface UpdateAigcDetectionTaskInput {
    updatedBy?: string | null;
    status?: AigcDetectionTaskStatus;
    idempotencyKey?: string;
    externalTaskId?: string | null;
    externalStatus?: string | null;
    deduplicated?: boolean;
    progressCurrent?: number | null;
    progressTotal?: number | null;
    progressUnit?: string | null;
    resultOverallScore?: number | null;
    resultHumanScore?: number | null;
    resultSummary?: string | null;
    resultJson?: string | null;
    rawResultJson?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    submittedAt?: number | null;
    completedAt?: number | null;
    lastSyncedAt?: number | null;
    lastSyncErrorAt?: number | null;
    retryCount?: number;
    syncingUntil?: number | null;
    updatedAt: number;
}

function mapTaskRow(row: typeof aigcDetectionTasks.$inferSelect): AigcDetectionTaskRow {
    return {
        ...row,
        deduplicated: Boolean(row.deduplicated),
        externalTaskId: row.externalTaskId ?? null,
        externalStatus: row.externalStatus ?? null,
        updatedBy: row.updatedBy ?? null,
        progressCurrent: row.progressCurrent ?? null,
        progressTotal: row.progressTotal ?? null,
        progressUnit: row.progressUnit ?? null,
        resultOverallScore: row.resultOverallScore ?? null,
        resultHumanScore: row.resultHumanScore ?? null,
        resultSummary: row.resultSummary ?? null,
        resultJson: row.resultJson ?? null,
        rawResultJson: row.rawResultJson ?? null,
        errorCode: row.errorCode ?? null,
        errorMessage: row.errorMessage ?? null,
        submittedAt: row.submittedAt ?? null,
        completedAt: row.completedAt ?? null,
        lastSyncedAt: row.lastSyncedAt ?? null,
        lastSyncErrorAt: row.lastSyncErrorAt ?? null,
        syncingUntil: row.syncingUntil ?? null,
    };
}

export class AigcDetectionRepository {
    constructor(private readonly db: AigcDetectionDatabase) {}

    createTask(input: CreateAigcDetectionTaskRowInput): void {
        this.db.insert(aigcDetectionTasks).values({
            ...input,
            externalTaskId: input.externalTaskId ?? null,
            externalStatus: input.externalStatus ?? null,
            progressCurrent: input.progressCurrent ?? null,
            progressTotal: input.progressTotal ?? null,
            progressUnit: input.progressUnit ?? null,
            resultOverallScore: input.resultOverallScore ?? null,
            resultHumanScore: input.resultHumanScore ?? null,
            resultSummary: input.resultSummary ?? null,
            resultJson: input.resultJson ?? null,
            rawResultJson: input.rawResultJson ?? null,
            errorCode: input.errorCode ?? null,
            errorMessage: input.errorMessage ?? null,
            submittedAt: input.submittedAt ?? null,
            completedAt: input.completedAt ?? null,
            lastSyncedAt: input.lastSyncedAt ?? null,
            lastSyncErrorAt: input.lastSyncErrorAt ?? null,
            retryCount: input.retryCount ?? 0,
            syncingUntil: input.syncingUntil ?? null,
        }).run();
    }

    updateTask(taskId: string, workspaceId: string, input: UpdateAigcDetectionTaskInput): void {
        this.db
            .update(aigcDetectionTasks)
            .set({
                ...input,
                updatedBy: input.updatedBy === undefined ? undefined : input.updatedBy,
                idempotencyKey: input.idempotencyKey === undefined ? undefined : input.idempotencyKey,
                externalTaskId: input.externalTaskId === undefined ? undefined : input.externalTaskId,
                externalStatus: input.externalStatus === undefined ? undefined : input.externalStatus,
                deduplicated: input.deduplicated === undefined ? undefined : input.deduplicated,
                progressCurrent: input.progressCurrent === undefined ? undefined : input.progressCurrent,
                progressTotal: input.progressTotal === undefined ? undefined : input.progressTotal,
                progressUnit: input.progressUnit === undefined ? undefined : input.progressUnit,
                resultOverallScore:
                    input.resultOverallScore === undefined ? undefined : input.resultOverallScore,
                resultHumanScore: input.resultHumanScore === undefined ? undefined : input.resultHumanScore,
                resultSummary: input.resultSummary === undefined ? undefined : input.resultSummary,
                resultJson: input.resultJson === undefined ? undefined : input.resultJson,
                rawResultJson: input.rawResultJson === undefined ? undefined : input.rawResultJson,
                errorCode: input.errorCode === undefined ? undefined : input.errorCode,
                errorMessage: input.errorMessage === undefined ? undefined : input.errorMessage,
                submittedAt: input.submittedAt === undefined ? undefined : input.submittedAt,
                completedAt: input.completedAt === undefined ? undefined : input.completedAt,
                lastSyncedAt: input.lastSyncedAt === undefined ? undefined : input.lastSyncedAt,
                lastSyncErrorAt: input.lastSyncErrorAt === undefined ? undefined : input.lastSyncErrorAt,
                retryCount: input.retryCount === undefined ? undefined : input.retryCount,
                syncingUntil: input.syncingUntil === undefined ? undefined : input.syncingUntil,
            })
            .where(and(eq(aigcDetectionTasks.id, taskId), eq(aigcDetectionTasks.workspaceId, workspaceId)))
            .run();
    }

    findTaskById(workspaceId: string, taskId: string): AigcDetectionTaskRow | null {
        const row =
            this.db
                .select()
                .from(aigcDetectionTasks)
                .where(and(eq(aigcDetectionTasks.workspaceId, workspaceId), eq(aigcDetectionTasks.id, taskId)))
                .get() ?? null;

        return row ? mapTaskRow(row) : null;
    }

    findSucceededTaskBySha256(workspaceId: string, sha256: string): AigcDetectionTaskRow | null {
        const row =
            this.db
                .select()
                .from(aigcDetectionTasks)
                .where(
                    and(
                        eq(aigcDetectionTasks.workspaceId, workspaceId),
                        eq(aigcDetectionTasks.sourceFileSha256, sha256),
                        eq(aigcDetectionTasks.status, 'succeeded')
                    )
                )
                .orderBy(desc(aigcDetectionTasks.completedAt), desc(aigcDetectionTasks.createdAt))
                .get() ?? null;

        return row ? mapTaskRow(row) : null;
    }

    listTasks(params: ListAigcDetectionTasksParams): { items: AigcDetectionTaskRow[]; total: number } {
        const conditions = [eq(aigcDetectionTasks.workspaceId, params.workspaceId)];

        if (params.status !== 'all') {
            conditions.push(eq(aigcDetectionTasks.status, params.status));
        }

        if (params.keyword) {
            conditions.push(like(aigcDetectionTasks.sourceFileName, `%${params.keyword}%`));
        }

        if (params.createdBy) {
            conditions.push(eq(aigcDetectionTasks.createdBy, params.createdBy));
        }

        const whereClause = and(...conditions);
        const offset = (params.page - 1) * params.pageSize;
        const items = this.db
            .select()
            .from(aigcDetectionTasks)
            .where(whereClause)
            .orderBy(desc(aigcDetectionTasks.createdAt), desc(aigcDetectionTasks.id))
            .limit(params.pageSize)
            .offset(offset)
            .all()
            .map(mapTaskRow);

        const totalRow = this.db
            .select({ total: sql<number>`count(*)` })
            .from(aigcDetectionTasks)
            .where(whereClause)
            .get();

        return {
            items,
            total: Number(totalRow?.total ?? 0),
        };
    }

    claimSyncLock(taskId: string, workspaceId: string, now: number, syncingUntil: number): boolean {
        const result = this.db
            .update(aigcDetectionTasks)
            .set({
                syncingUntil,
                updatedAt: now,
            })
            .where(
                and(
                    eq(aigcDetectionTasks.id, taskId),
                    eq(aigcDetectionTasks.workspaceId, workspaceId),
                    or(sql`${aigcDetectionTasks.syncingUntil} is null`, sql`${aigcDetectionTasks.syncingUntil} < ${now}`)!
                )
            )
            .run();

        return result.changes > 0;
    }

    releaseSyncLock(taskId: string, workspaceId: string, updatedAt: number): void {
        this.db
            .update(aigcDetectionTasks)
            .set({
                syncingUntil: null,
                updatedAt,
            })
            .where(and(eq(aigcDetectionTasks.id, taskId), eq(aigcDetectionTasks.workspaceId, workspaceId)))
            .run();
    }

    appendEvent(input: {
        taskId: string;
        workspaceId: string;
        eventType: AigcDetectionTaskEventType;
        fromStatus?: AigcDetectionTaskStatus | null;
        toStatus?: AigcDetectionTaskStatus | null;
        payloadJson?: string | null;
        operatorType: AigcDetectionTaskEventOperatorType;
        createdBy?: string | null;
        createdAt: number;
    }): void {
        this.db.insert(aigcDetectionTaskEvents).values({
            id: ulid(),
            taskId: input.taskId,
            workspaceId: input.workspaceId,
            eventType: input.eventType,
            fromStatus: input.fromStatus ?? null,
            toStatus: input.toStatus ?? null,
            payloadJson: input.payloadJson ?? null,
            operatorType: input.operatorType,
            createdBy: input.createdBy ?? null,
            createdAt: input.createdAt,
        }).run();
    }
}
