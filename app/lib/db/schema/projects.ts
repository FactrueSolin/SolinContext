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
    },
    (table) => [
        index('idx_projects_workspace_deleted_updated_at').on(
            table.workspaceId,
            table.deletedAt,
            table.updatedAt
        ),
        check('ck_projects_name_length', sql`length(trim(${table.name})) between 1 and 120`),
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
        snapshotJson: text('snapshot_json').notNull(),
        createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
        createdAt: integer('created_at').notNull(),
    },
    (table) => [
        uniqueIndex('uq_project_revisions_project_revision').on(table.projectId, table.revisionNumber),
        index('idx_project_revisions_project_created_at').on(table.projectId, table.createdAt),
        check('ck_project_revisions_revision_number', sql`${table.revisionNumber} >= 1`),
    ]
);
