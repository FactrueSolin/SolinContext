import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const userStatuses = ['active', 'disabled'] as const;
export const workspaceTypes = ['personal', 'organization'] as const;
export const workspaceStatuses = ['active', 'archived'] as const;
export const workspaceRoles = ['owner', 'admin', 'editor', 'viewer'] as const;
export const membershipStatuses = ['active', 'invited', 'suspended'] as const;

export const users = sqliteTable(
    'users',
    {
        id: text('id').primaryKey(),
        logtoUserId: text('logto_user_id').notNull(),
        email: text('email'),
        name: text('name'),
        avatarUrl: text('avatar_url'),
        status: text('status', { enum: userStatuses }).notNull().default('active'),
        lastLoginAt: integer('last_login_at'),
        createdAt: integer('created_at').notNull(),
        updatedAt: integer('updated_at').notNull(),
    },
    (table) => [
        uniqueIndex('uq_users_logto_user_id').on(table.logtoUserId),
        index('idx_users_email').on(table.email),
        check('ck_users_status', sql`${table.status} in ('active', 'disabled')`),
    ]
);

export const workspaces = sqliteTable(
    'workspaces',
    {
        id: text('id').primaryKey(),
        type: text('type', { enum: workspaceTypes }).notNull(),
        name: text('name').notNull(),
        slug: text('slug').notNull(),
        ownerUserId: text('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
        logtoOrganizationId: text('logto_organization_id'),
        status: text('status', { enum: workspaceStatuses }).notNull().default('active'),
        createdAt: integer('created_at').notNull(),
        updatedAt: integer('updated_at').notNull(),
    },
    (table) => [
        uniqueIndex('uq_workspaces_slug').on(table.slug),
        uniqueIndex('uq_workspaces_logto_organization_id').on(table.logtoOrganizationId),
        index('idx_workspaces_owner_user_id').on(table.ownerUserId),
        check('ck_workspaces_type', sql`${table.type} in ('personal', 'organization')`),
        check('ck_workspaces_status', sql`${table.status} in ('active', 'archived')`),
        check(
            'ck_workspaces_personal_owner',
            sql`(
                (${table.type} = 'personal' and ${table.ownerUserId} is not null)
                or
                (${table.type} = 'organization')
            )`
        ),
        check(
            'ck_workspaces_organization_logto_id',
            sql`(
                (${table.type} = 'organization' and ${table.logtoOrganizationId} is not null)
                or
                (${table.type} = 'personal')
            )`
        ),
    ]
);

export const workspaceMemberships = sqliteTable(
    'workspace_memberships',
    {
        id: text('id').primaryKey(),
        workspaceId: text('workspace_id')
            .notNull()
            .references(() => workspaces.id, { onDelete: 'cascade' }),
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        role: text('role', { enum: workspaceRoles }).notNull(),
        status: text('status', { enum: membershipStatuses }).notNull().default('active'),
        joinedAt: integer('joined_at').notNull(),
        invitedBy: text('invited_by').references(() => users.id, { onDelete: 'set null' }),
        createdAt: integer('created_at').notNull(),
        updatedAt: integer('updated_at').notNull(),
    },
    (table) => [
        uniqueIndex('uq_workspace_memberships_workspace_user').on(table.workspaceId, table.userId),
        index('idx_workspace_memberships_user_status').on(table.userId, table.status),
        index('idx_workspace_memberships_workspace_role_status').on(
            table.workspaceId,
            table.role,
            table.status
        ),
        check('ck_workspace_memberships_role', sql`${table.role} in ('owner', 'admin', 'editor', 'viewer')`),
        check(
            'ck_workspace_memberships_status',
            sql`${table.status} in ('active', 'invited', 'suspended')`
        ),
    ]
);

export const auditLogs = sqliteTable(
    'audit_logs',
    {
        id: text('id').primaryKey(),
        workspaceId: text('workspace_id')
            .notNull()
            .references(() => workspaces.id, { onDelete: 'cascade' }),
        actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
        entityType: text('entity_type').notNull(),
        entityId: text('entity_id').notNull(),
        action: text('action').notNull(),
        payloadJson: text('payload_json').notNull(),
        createdAt: integer('created_at').notNull(),
    },
    (table) => [index('idx_audit_logs_workspace_created_at').on(table.workspaceId, table.createdAt)]
);
