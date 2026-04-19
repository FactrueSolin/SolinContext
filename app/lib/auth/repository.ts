import { and, asc, eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { getAppDatabaseContext, type AppDatabaseContext } from '../db/client';
import { users, workspaces, workspaceMemberships } from '../db/schema';
import type { SessionIdentity } from './session';
import type { WorkspaceRole } from './permissions';

export interface UserRow {
    id: string;
    logtoUserId: string;
    email: string | null;
    name: string | null;
    avatarUrl: string | null;
    status: 'active' | 'disabled';
    lastLoginAt: number | null;
    createdAt: number;
    updatedAt: number;
}

export interface WorkspaceMembershipRow {
    membershipId: string;
    workspaceId: string;
    workspaceType: 'personal' | 'organization';
    workspaceName: string;
    workspaceSlug: string;
    workspaceStatus: 'active' | 'archived';
    workspaceRole: WorkspaceRole;
    logtoOrganizationId: string | null;
    joinedAt: number;
}

export class AuthRepository {
    constructor(private readonly database: AppDatabaseContext = getAppDatabaseContext()) {}

    findUserByLogtoUserId(logtoUserId: string): UserRow | null {
        return (
            this.database.db
                .select({
                    id: users.id,
                    logtoUserId: users.logtoUserId,
                    email: users.email,
                    name: users.name,
                    avatarUrl: users.avatarUrl,
                    status: users.status,
                    lastLoginAt: users.lastLoginAt,
                    createdAt: users.createdAt,
                    updatedAt: users.updatedAt,
                })
                .from(users)
                .where(eq(users.logtoUserId, logtoUserId))
                .get() ?? null
        );
    }

    upsertUser(identity: SessionIdentity): UserRow {
        const existing = this.findUserByLogtoUserId(identity.logtoUserId);
        const now = Date.now();

        if (existing) {
            this.database.db
                .update(users)
                .set({
                    email: identity.email,
                    name: identity.name,
                    avatarUrl: identity.avatarUrl,
                    lastLoginAt: now,
                    updatedAt: now,
                })
                .where(eq(users.id, existing.id))
                .run();

            return {
                ...existing,
                email: identity.email,
                name: identity.name,
                avatarUrl: identity.avatarUrl,
                lastLoginAt: now,
                updatedAt: now,
            };
        }

        const id = ulid();

        this.database.db.insert(users).values({
            id,
            logtoUserId: identity.logtoUserId,
            email: identity.email,
            name: identity.name,
            avatarUrl: identity.avatarUrl,
            status: 'active',
            lastLoginAt: now,
            createdAt: now,
            updatedAt: now,
        }).run();

        return {
            id,
            logtoUserId: identity.logtoUserId,
            email: identity.email,
            name: identity.name,
            avatarUrl: identity.avatarUrl,
            status: 'active',
            lastLoginAt: now,
            createdAt: now,
            updatedAt: now,
        };
    }

    findPersonalWorkspaceForUser(userId: string): WorkspaceMembershipRow | null {
        return (
            this.database.db
                .select({
                    membershipId: workspaceMemberships.id,
                    workspaceId: workspaces.id,
                    workspaceType: workspaces.type,
                    workspaceName: workspaces.name,
                    workspaceSlug: workspaces.slug,
                    workspaceStatus: workspaces.status,
                    workspaceRole: workspaceMemberships.role,
                    logtoOrganizationId: workspaces.logtoOrganizationId,
                    joinedAt: workspaceMemberships.joinedAt,
                })
                .from(workspaceMemberships)
                .innerJoin(workspaces, eq(workspaceMemberships.workspaceId, workspaces.id))
                .where(
                    and(
                        eq(workspaceMemberships.userId, userId),
                        eq(workspaceMemberships.status, 'active'),
                        eq(workspaces.type, 'personal')
                    )
                )
                .orderBy(asc(workspaces.createdAt))
                .get() ?? null
        );
    }

    createPersonalWorkspace(userId: string, name: string, slug: string): WorkspaceMembershipRow {
        const now = Date.now();
        const workspaceId = ulid();
        const membershipId = ulid();

        this.database.client.transaction(() => {
            this.database.db.insert(workspaces).values({
                id: workspaceId,
                type: 'personal',
                name,
                slug,
                ownerUserId: userId,
                logtoOrganizationId: null,
                status: 'active',
                createdAt: now,
                updatedAt: now,
            }).run();

            this.database.db.insert(workspaceMemberships).values({
                id: membershipId,
                workspaceId,
                userId,
                role: 'owner',
                status: 'active',
                joinedAt: now,
                invitedBy: userId,
                createdAt: now,
                updatedAt: now,
            }).run();
        })();

        return {
            membershipId,
            workspaceId,
            workspaceType: 'personal',
            workspaceName: name,
            workspaceSlug: slug,
            workspaceStatus: 'active',
            workspaceRole: 'owner',
            logtoOrganizationId: null,
            joinedAt: now,
        };
    }

    isWorkspaceSlugTaken(slug: string): boolean {
        const result = this.database.db
            .select({ id: workspaces.id })
            .from(workspaces)
            .where(eq(workspaces.slug, slug))
            .get();

        return Boolean(result);
    }

    listMembershipsForUser(userId: string): WorkspaceMembershipRow[] {
        return this.database.db
            .select({
                membershipId: workspaceMemberships.id,
                workspaceId: workspaces.id,
                workspaceType: workspaces.type,
                workspaceName: workspaces.name,
                workspaceSlug: workspaces.slug,
                workspaceStatus: workspaces.status,
                workspaceRole: workspaceMemberships.role,
                logtoOrganizationId: workspaces.logtoOrganizationId,
                joinedAt: workspaceMemberships.joinedAt,
            })
            .from(workspaceMemberships)
            .innerJoin(workspaces, eq(workspaceMemberships.workspaceId, workspaces.id))
            .where(
                and(eq(workspaceMemberships.userId, userId), eq(workspaceMemberships.status, 'active'))
            )
            .orderBy(asc(workspaces.type), asc(workspaces.name))
            .all();
    }

    findMembershipByWorkspaceSlug(userId: string, slug: string): WorkspaceMembershipRow | null {
        return (
            this.database.db
                .select({
                    membershipId: workspaceMemberships.id,
                    workspaceId: workspaces.id,
                    workspaceType: workspaces.type,
                    workspaceName: workspaces.name,
                    workspaceSlug: workspaces.slug,
                    workspaceStatus: workspaces.status,
                    workspaceRole: workspaceMemberships.role,
                    logtoOrganizationId: workspaces.logtoOrganizationId,
                    joinedAt: workspaceMemberships.joinedAt,
                })
                .from(workspaceMemberships)
                .innerJoin(workspaces, eq(workspaceMemberships.workspaceId, workspaces.id))
                .where(
                    and(
                        eq(workspaceMemberships.userId, userId),
                        eq(workspaceMemberships.status, 'active'),
                        eq(workspaces.slug, slug)
                    )
                )
                .get() ?? null
        );
    }
}
