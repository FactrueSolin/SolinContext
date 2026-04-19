import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { users, workspaces } from './auth';

export const projects = sqliteTable(
    'projects',
    {
        id: text('id').primaryKey(),
        workspaceId: text('workspace_id')
            .notNull()
            .references(() => workspaces.id, { onDelete: 'cascade' }),
        name: text('name').notNull(),
        systemPrompt: text('system_prompt').notNull().default(''),
        defaultCredentialId: text('default_credential_id'),
        currentRevisionId: text('current_revision_id'),
        createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
        updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
        createdAt: integer('created_at').notNull(),
        updatedAt: integer('updated_at').notNull(),
        deletedAt: integer('deleted_at'),
        rowVersion: integer('row_version').notNull().default(1),
    },
    (table) => [
        index('idx_projects_workspace_deleted_updated_at').on(
            table.workspaceId,
            table.deletedAt,
            table.updatedAt
        ),
        index('idx_projects_workspace_name').on(table.workspaceId, table.name),
        check('ck_projects_name_length', sql`length(trim(${table.name})) between 1 and 120`),
        check('ck_projects_row_version', sql`${table.rowVersion} >= 1`),
        check('ck_projects_updated_ge_created', sql`${table.updatedAt} >= ${table.createdAt}`),
    ]
);

export const projectRevisions = sqliteTable(
    'project_revisions',
    {
        id: text('id').primaryKey(),
        projectId: text('project_id')
            .notNull()
            .references(() => projects.id, { onDelete: 'cascade' }),
        workspaceId: text('workspace_id')
            .notNull()
            .references(() => workspaces.id, { onDelete: 'cascade' }),
        revisionNumber: integer('revision_number').notNull(),
        historyKey: text('history_key').notNull(),
        nameSnapshot: text('name_snapshot').notNull(),
        systemPrompt: text('system_prompt').notNull(),
        messagesJson: text('messages_json').notNull(),
        apiConfigJson: text('api_config_json').notNull(),
        contentHash: text('content_hash').notNull(),
        operationType: text('operation_type').notNull(),
        sourceRevisionId: text('source_revision_id'),
        createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
        createdAt: integer('created_at').notNull(),
        legacySourcePath: text('legacy_source_path'),
    },
    (table) => [
        uniqueIndex('uq_project_revisions_project_revision').on(table.projectId, table.revisionNumber),
        uniqueIndex('uq_project_revisions_project_history_key').on(table.projectId, table.historyKey),
        index('idx_project_revisions_project_created_at').on(table.projectId, table.createdAt),
        index('idx_project_revisions_content_hash').on(table.contentHash),
        index('idx_project_revisions_source_revision_id').on(table.sourceRevisionId),
        check('ck_project_revisions_revision_number', sql`${table.revisionNumber} >= 1`),
        check('ck_project_revisions_name_length', sql`length(trim(${table.nameSnapshot})) between 1 and 120`),
        check('ck_project_revisions_messages_json', sql`json_valid(${table.messagesJson})`),
        check('ck_project_revisions_api_config_json', sql`json_valid(${table.apiConfigJson})`),
        check(
            'ck_project_revisions_operation_type',
            sql`${table.operationType} in ('create', 'update', 'restore', 'duplicate', 'import', 'migrate')`
        ),
    ]
);
