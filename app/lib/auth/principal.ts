import { AuthRepository, type WorkspaceMembershipRow, type UserRow } from './repository';
import { getPermissionsForRole, hasPermission, type WorkspacePermission, type WorkspaceRole } from './permissions';
import { requireSession } from './session';
import { permissionDenied, workspaceForbidden } from '../api/errors';

export interface Principal {
    userId: string;
    logtoUserId: string;
    email: string | null;
    name: string | null;
    avatarUrl: string | null;
    activeWorkspaceId: string;
    activeWorkspaceSlug: string;
    activeWorkspaceName: string;
    activeWorkspaceType: 'personal' | 'organization';
    workspaceRole: WorkspaceRole;
    permissions: WorkspacePermission[];
}

function slugifySegment(input: string): string {
    const slug = input
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 50);

    return slug || 'workspace';
}

function buildPersonalWorkspaceName(user: UserRow): string {
    const base = user.name?.trim() || user.email?.split('@')[0] || 'Personal';
    return `${base}'s Workspace`;
}

function buildPersonalWorkspaceSlug(user: UserRow): string {
    return slugifySegment(user.email?.split('@')[0] || user.name || user.logtoUserId);
}

async function ensurePersonalWorkspace(
    repository: AuthRepository,
    user: UserRow
): Promise<WorkspaceMembershipRow> {
    const existing = repository.findPersonalWorkspaceForUser(user.id);
    if (existing) {
        return existing;
    }

    const baseSlug = buildPersonalWorkspaceSlug(user);
    let slug = baseSlug;
    let suffix = 1;

    while (repository.isWorkspaceSlugTaken(slug)) {
        suffix += 1;
        slug = `${baseSlug}-${suffix}`;
    }

    return repository.createPersonalWorkspace(user.id, buildPersonalWorkspaceName(user), slug);
}

export async function resolvePrincipal(
    request: Request,
    options: { workspaceSlug?: string } = {}
): Promise<Principal> {
    const session = await requireSession(request);
    const repository = new AuthRepository();
    const user = repository.upsertUser(session);
    const personalWorkspace = await ensurePersonalWorkspace(repository, user);
    const membership =
        (options.workspaceSlug
            ? repository.findMembershipByWorkspaceSlug(user.id, options.workspaceSlug)
            : null) ?? personalWorkspace;

    if (!membership) {
        throw workspaceForbidden();
    }

    return {
        userId: user.id,
        logtoUserId: user.logtoUserId,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        activeWorkspaceId: membership.workspaceId,
        activeWorkspaceSlug: membership.workspaceSlug,
        activeWorkspaceName: membership.workspaceName,
        activeWorkspaceType: membership.workspaceType,
        workspaceRole: membership.workspaceRole,
        permissions: getPermissionsForRole(membership.workspaceRole),
    };
}

export function requirePermission(
    principal: Principal,
    permission: WorkspacePermission
): void {
    if (!hasPermission(principal.workspaceRole, permission)) {
        throw permissionDenied();
    }
}

export async function listAccessibleWorkspaces(request: Request) {
    const session = await requireSession(request);
    const repository = new AuthRepository();
    const user = repository.upsertUser(session);
    const defaultWorkspace = await ensurePersonalWorkspace(repository, user);
    const memberships = repository.listMembershipsForUser(user.id);

    return memberships.map((membership) => ({
        id: membership.workspaceId,
        slug: membership.workspaceSlug,
        name: membership.workspaceName,
        type: membership.workspaceType,
        role: membership.workspaceRole,
        isDefault: membership.workspaceId === defaultWorkspace.workspaceId,
    }));
}

export async function getCurrentUserSummary(request: Request) {
    const principal = await resolvePrincipal(request);

    return {
        user: {
            id: principal.userId,
            email: principal.email,
            name: principal.name,
            avatarUrl: principal.avatarUrl,
        },
        defaultWorkspace: {
            id: principal.activeWorkspaceId,
            slug: principal.activeWorkspaceSlug,
            type: principal.activeWorkspaceType,
            role: principal.workspaceRole,
        },
    };
}
