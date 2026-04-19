import type { WorkspacePermission, WorkspaceRole } from '../auth/permissions';

export interface WorkspaceSummary {
    id: string;
    slug: string;
    name: string;
    type: 'personal' | 'organization';
    role: WorkspaceRole;
}

export interface AccessibleWorkspace extends WorkspaceSummary {
    isDefault: boolean;
}

export interface SessionUserSummary {
    id: string;
    email: string | null;
    name: string | null;
    avatarUrl: string | null;
}

export interface SessionSummary {
    user: SessionUserSummary;
    activeWorkspace: WorkspaceSummary;
    defaultWorkspace: WorkspaceSummary;
    permissions: WorkspacePermission[];
}

interface ApiSuccess<T> {
    data: T;
}

interface ApiErrorBody {
    error?: {
        code?: string;
        message?: string;
    };
}

export class WorkspaceApiError extends Error {
    readonly status: number;
    readonly code: string;

    constructor(status: number, code: string, message: string) {
        super(message);
        this.name = 'WorkspaceApiError';
        this.status = status;
        this.code = code;
    }
}

async function parseJsonSafely<T>(response: Response): Promise<T | null> {
    try {
        return (await response.json()) as T;
    } catch {
        return null;
    }
}

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
    const response = await fetch(input, init);
    const payload = await parseJsonSafely<ApiSuccess<T> & ApiErrorBody>(response);

    if (!response.ok) {
        throw new WorkspaceApiError(
            response.status,
            payload?.error?.code ?? 'WORKSPACE_REQUEST_FAILED',
            payload?.error?.message ?? 'Workspace request failed'
        );
    }

    return payload?.data as T;
}

export function getCurrentSession(workspaceSlug?: string) {
    const searchParams = new URLSearchParams();

    if (workspaceSlug) {
        searchParams.set('workspaceSlug', workspaceSlug);
    }

    const query = searchParams.toString();
    return request<SessionSummary>(query ? `/api/me?${query}` : '/api/me');
}

export function listWorkspaces() {
    return request<AccessibleWorkspace[]>('/api/workspaces');
}
