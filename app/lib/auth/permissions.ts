export const workspacePermissions = [
    'project:read',
    'project:write',
    'project:delete',
    'prompt_asset:read',
    'prompt_asset:write',
    'prompt_asset:archive',
    'credential:read_meta',
    'credential:use',
    'credential:manage',
    'member:read',
    'member:manage',
    'workspace:manage',
] as const;

export type WorkspacePermission = (typeof workspacePermissions)[number];
export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer';

const permissionMatrix: Record<WorkspaceRole, WorkspacePermission[]> = {
    owner: [...workspacePermissions],
    admin: [...workspacePermissions],
    editor: [
        'project:read',
        'project:write',
        'prompt_asset:read',
        'prompt_asset:write',
        'credential:read_meta',
        'credential:use',
        'member:read',
    ],
    viewer: ['project:read', 'prompt_asset:read', 'member:read'],
};

export function getPermissionsForRole(role: WorkspaceRole): WorkspacePermission[] {
    return permissionMatrix[role];
}

export function hasPermission(role: WorkspaceRole, permission: WorkspacePermission): boolean {
    return permissionMatrix[role].includes(permission);
}
