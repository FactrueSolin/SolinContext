import { sql } from 'drizzle-orm';
import {
    AnySQLiteColumn,
    check,
    index,
    integer,
    sqliteTable,
    text,
    uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { users, workspaces } from './auth';

export const promptAssetStatuses = ['active', 'archived'] as const;
export const promptAssetOperationTypes = ['create', 'update', 'restore', 'import'] as const;

export const promptAssets = sqliteTable(
    'prompt_assets',
    {
        id: text('id').primaryKey(),
        workspaceId: text('workspace_id')
            .notNull()
            .references(() => workspaces.id, { onDelete: 'cascade' }),
        name: text('name').notNull(),
        normalizedName: text('normalized_name').notNull(),
        description: text('description').notNull().default(''),
        currentVersionNumber: integer('current_version_number').notNull().default(1),
        status: text('status', { enum: promptAssetStatuses }).notNull().default('active'),
        createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
        updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
        createdAt: integer('created_at').notNull(),
        updatedAt: integer('updated_at').notNull(),
        archivedAt: integer('archived_at'),
    },
    (table) => [
        index('idx_prompt_assets_workspace_status_updated_at').on(
            table.workspaceId,
            table.status,
            table.updatedAt
        ),
        uniqueIndex('uq_prompt_assets_workspace_normalized_name').on(
            table.workspaceId,
            table.normalizedName
        ),
        index('idx_prompt_assets_workspace_name').on(table.workspaceId, table.name),
        index('idx_prompt_assets_created_at').on(table.createdAt),
        check('ck_prompt_assets_name_length', sql`length(trim(${table.name})) between 1 and 120`),
        check(
            'ck_prompt_assets_normalized_name_length',
            sql`length(trim(${table.normalizedName})) between 1 and 120`
        ),
        check('ck_prompt_assets_current_version', sql`${table.currentVersionNumber} >= 1`),
        check('ck_prompt_assets_status', sql`${table.status} in ('active', 'archived')`),
        check(
            'ck_prompt_assets_archive_state',
            sql`(
                (${table.status} = 'archived' and ${table.archivedAt} is not null)
                or
                (${table.status} = 'active' and ${table.archivedAt} is null)
            )`
        ),
    ]
);

export const promptAssetVersions = sqliteTable(
    'prompt_asset_versions',
    {
        id: text('id').primaryKey(),
        assetId: text('asset_id')
            .notNull()
            .references(() => promptAssets.id, { onDelete: 'cascade' }),
        workspaceId: text('workspace_id')
            .notNull()
            .references(() => workspaces.id, { onDelete: 'cascade' }),
        versionNumber: integer('version_number').notNull(),
        nameSnapshot: text('name_snapshot').notNull(),
        descriptionSnapshot: text('description_snapshot').notNull().default(''),
        content: text('content').notNull(),
        changeNote: text('change_note'),
        contentHash: text('content_hash').notNull(),
        operationType: text('operation_type', { enum: promptAssetOperationTypes }).notNull(),
        sourceVersionId: text('source_version_id').references(
            (): AnySQLiteColumn => promptAssetVersions.id,
            { onDelete: 'set null' }
        ),
        createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
        createdAt: integer('created_at').notNull(),
    },
    (table) => [
        uniqueIndex('uq_prompt_asset_versions_asset_version').on(table.assetId, table.versionNumber),
        index('idx_prompt_asset_versions_workspace_asset_created_at').on(
            table.workspaceId,
            table.assetId,
            table.createdAt
        ),
        index('idx_prompt_asset_versions_source_version_id').on(table.sourceVersionId),
        index('idx_prompt_asset_versions_content_hash').on(table.contentHash),
        check('ck_prompt_asset_versions_version_number', sql`${table.versionNumber} >= 1`),
        check(
            'ck_prompt_asset_versions_name_length',
            sql`length(trim(${table.nameSnapshot})) between 1 and 120`
        ),
        check('ck_prompt_asset_versions_content', sql`length(${table.content}) > 0`),
        check(
            'ck_prompt_asset_versions_operation_type',
            sql`${table.operationType} in ('create', 'update', 'restore', 'import')`
        ),
    ]
);
