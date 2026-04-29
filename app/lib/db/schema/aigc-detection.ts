import { sql } from 'drizzle-orm';
import { check, index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { users, workspaces } from './auth';

export const aigcDetectionTaskStatuses = [
    'queued_local',
    'submit_failed',
    'submitted',
    'processing',
    'succeeded',
    'failed',
] as const;

export const aigcDetectionStorageStatuses = ['active', 'deleted'] as const;

export const aigcDetectionFileExtensions = ['pdf', 'doc', 'docx'] as const;

export const aigcDetectionTaskEventTypes = [
    'task_created',
    'file_saved',
    'submit_requested',
    'submit_succeeded',
    'submit_failed',
    'status_synced',
    'result_synced',
    'sync_failed',
    'retry_requested',
    'retry_submitted',
    'storage_deleted',
] as const;

export const aigcDetectionTaskEventOperatorTypes = ['user', 'system'] as const;

export const aigcDetectionTasks = sqliteTable(
    'aigc_detection_tasks',
    {
        id: text('id').primaryKey(),
        workspaceId: text('workspace_id')
            .notNull()
            .references(() => workspaces.id, { onDelete: 'cascade' }),
        createdBy: text('created_by')
            .notNull()
            .references(() => users.id, { onDelete: 'restrict' }),
        updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
        status: text('status', { enum: aigcDetectionTaskStatuses }).notNull(),
        externalTaskId: text('external_task_id'),
        externalStatus: text('external_status'),
        sourceFileName: text('source_file_name').notNull(),
        sourceFileExt: text('source_file_ext', { enum: aigcDetectionFileExtensions }).notNull(),
        sourceMimeType: text('source_mime_type').notNull(),
        sourceFileSize: integer('source_file_size').notNull(),
        sourceFileSha256: text('source_file_sha256').notNull(),
        storagePath: text('storage_path').notNull(),
        storageStatus: text('storage_status', { enum: aigcDetectionStorageStatuses }).notNull().default('active'),
        idempotencyKey: text('idempotency_key').notNull(),
        deduplicated: integer('deduplicated', { mode: 'boolean' }).notNull().default(false),
        progressCurrent: integer('progress_current'),
        progressTotal: integer('progress_total'),
        progressUnit: text('progress_unit'),
        resultOverallScore: real('result_overall_score'),
        resultHumanScore: real('result_human_score'),
        resultSummary: text('result_summary'),
        resultJson: text('result_json'),
        rawResultJson: text('raw_result_json'),
        errorCode: text('error_code'),
        errorMessage: text('error_message'),
        submittedAt: integer('submitted_at'),
        completedAt: integer('completed_at'),
        lastSyncedAt: integer('last_synced_at'),
        lastSyncErrorAt: integer('last_sync_error_at'),
        retryCount: integer('retry_count').notNull().default(0),
        syncingUntil: integer('syncing_until'),
        createdAt: integer('created_at').notNull(),
        updatedAt: integer('updated_at').notNull(),
    },
    (table) => [
        uniqueIndex('uq_aigc_detection_tasks_external_task_id').on(table.externalTaskId),
        index('idx_aigc_detection_tasks_workspace_created_at').on(table.workspaceId, table.createdAt),
        index('idx_aigc_detection_tasks_workspace_status_updated_at').on(
            table.workspaceId,
            table.status,
            table.updatedAt
        ),
        index('idx_aigc_detection_tasks_sha256').on(table.sourceFileSha256),
        index('idx_aigc_detection_tasks_workspace_sha256_status_created_at').on(
            table.workspaceId,
            table.sourceFileSha256,
            table.status,
            table.createdAt
        ),
        index('idx_aigc_detection_tasks_status_last_synced_at').on(table.status, table.lastSyncedAt),
        index('idx_aigc_detection_tasks_created_by_created_at').on(table.createdBy, table.createdAt),
        index('idx_aigc_detection_tasks_workspace_source_file_name').on(
            table.workspaceId,
            table.sourceFileName
        ),
        index('idx_aigc_detection_tasks_completed_at').on(table.completedAt),
        check(
            'ck_aigc_detection_tasks_status',
            sql`${table.status} in ('queued_local', 'submit_failed', 'submitted', 'processing', 'succeeded', 'failed')`
        ),
        check(
            'ck_aigc_detection_tasks_storage_status',
            sql`${table.storageStatus} in ('active', 'deleted')`
        ),
        check('ck_aigc_detection_tasks_source_file_ext', sql`${table.sourceFileExt} in ('pdf', 'doc', 'docx')`),
        check('ck_aigc_detection_tasks_sha256', sql`length(${table.sourceFileSha256}) = 64`),
        check('ck_aigc_detection_tasks_source_file_size', sql`${table.sourceFileSize} >= 0`),
        check('ck_aigc_detection_tasks_retry_count', sql`${table.retryCount} >= 0`),
        check('ck_aigc_detection_tasks_progress_current', sql`${table.progressCurrent} is null or ${table.progressCurrent} >= 0`),
        check('ck_aigc_detection_tasks_progress_total', sql`${table.progressTotal} is null or ${table.progressTotal} >= 0`),
        check(
            'ck_aigc_detection_tasks_progress_pair',
            sql`(
                (${table.progressCurrent} is null and ${table.progressTotal} is null)
                or
                (${table.progressCurrent} is not null and ${table.progressTotal} is not null and ${table.progressCurrent} <= ${table.progressTotal})
            )`
        ),
        check(
            'ck_aigc_detection_tasks_result_overall_score',
            sql`${table.resultOverallScore} is null or (${table.resultOverallScore} >= 0 and ${table.resultOverallScore} <= 1)`
        ),
        check(
            'ck_aigc_detection_tasks_result_human_score',
            sql`${table.resultHumanScore} is null or (${table.resultHumanScore} >= 0 and ${table.resultHumanScore} <= 1)`
        ),
        check('ck_aigc_detection_tasks_submitted_at', sql`${table.submittedAt} is null or ${table.submittedAt} >= ${table.createdAt}`),
        check(
            'ck_aigc_detection_tasks_completed_at',
            sql`${table.completedAt} is null or ${table.submittedAt} is null or ${table.completedAt} >= ${table.submittedAt}`
        ),
        check('ck_aigc_detection_tasks_updated_at', sql`${table.updatedAt} >= ${table.createdAt}`),
        check('ck_aigc_detection_tasks_result_json', sql`${table.resultJson} is null or json_valid(${table.resultJson})`),
        check(
            'ck_aigc_detection_tasks_raw_result_json',
            sql`${table.rawResultJson} is null or json_valid(${table.rawResultJson})`
        ),
    ]
);

export const aigcDetectionTaskEvents = sqliteTable(
    'aigc_detection_task_events',
    {
        id: text('id').primaryKey(),
        taskId: text('task_id')
            .notNull()
            .references(() => aigcDetectionTasks.id, { onDelete: 'cascade' }),
        workspaceId: text('workspace_id')
            .notNull()
            .references(() => workspaces.id, { onDelete: 'cascade' }),
        eventType: text('event_type', { enum: aigcDetectionTaskEventTypes }).notNull(),
        fromStatus: text('from_status', { enum: aigcDetectionTaskStatuses }),
        toStatus: text('to_status', { enum: aigcDetectionTaskStatuses }),
        payloadJson: text('payload_json'),
        operatorType: text('operator_type', { enum: aigcDetectionTaskEventOperatorTypes }).notNull(),
        createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
        createdAt: integer('created_at').notNull(),
    },
    (table) => [
        index('idx_aigc_detection_task_events_task_created_at').on(table.taskId, table.createdAt),
        index('idx_aigc_detection_task_events_workspace_created_at').on(table.workspaceId, table.createdAt),
        index('idx_aigc_detection_task_events_event_type_created_at').on(table.eventType, table.createdAt),
        check(
            'ck_aigc_detection_task_events_event_type',
            sql`${table.eventType} in ('task_created', 'file_saved', 'submit_requested', 'submit_succeeded', 'submit_failed', 'status_synced', 'result_synced', 'sync_failed', 'retry_requested', 'retry_submitted', 'storage_deleted')`
        ),
        check(
            'ck_aigc_detection_task_events_operator_type',
            sql`${table.operatorType} in ('user', 'system')`
        ),
        check(
            'ck_aigc_detection_task_events_payload_json',
            sql`${table.payloadJson} is null or json_valid(${table.payloadJson})`
        ),
    ]
);
