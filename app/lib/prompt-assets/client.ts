import type {
    PaginatedData,
    PromptAssetDetail,
    PromptAssetStatus,
    PromptAssetSummary,
    PromptAssetVersionItem,
} from './dto';

export type PromptAssetApiErrorCode =
    | 'PROMPT_ASSET_BAD_REQUEST'
    | 'PROMPT_ASSET_NOT_FOUND'
    | 'PROMPT_ASSET_VERSION_NOT_FOUND'
    | 'PROMPT_ASSET_ARCHIVED'
    | 'PROMPT_ASSET_NO_CHANGES'
    | 'PROMPT_ASSET_VERSION_CONFLICT'
    | 'PROMPT_ASSET_VALIDATION_FAILED'
    | 'PROMPT_ASSET_INTERNAL_ERROR';

export interface ListPromptAssetsParams {
    query?: string;
    status?: PromptAssetStatus | 'all';
    page?: number;
    pageSize?: number;
}

export interface ListPromptAssetVersionsParams {
    page?: number;
    pageSize?: number;
}

export interface CreatePromptAssetPayload {
    name: string;
    description?: string;
    content: string;
    changeNote?: string;
}

export interface CreatePromptAssetVersionPayload extends CreatePromptAssetPayload {
    expectedVersionNumber: number;
}

export interface RestorePromptAssetVersionPayload {
    versionId: string;
    changeNote?: string;
    expectedVersionNumber: number;
}

interface PromptAssetApiErrorBody {
    error: {
        code: PromptAssetApiErrorCode;
        message: string;
        details: unknown;
    };
}

interface PromptAssetApiSuccessBody<T> {
    data: T;
}

export class PromptAssetApiError extends Error {
    readonly status: number;
    readonly code: PromptAssetApiErrorCode;
    readonly details: unknown;

    constructor(status: number, code: PromptAssetApiErrorCode, message: string, details: unknown = null) {
        super(message);
        this.name = 'PromptAssetApiError';
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

function buildSearch(params: Record<string, string | number | undefined>) {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === '') {
            return;
        }

        searchParams.set(key, String(value));
    });

    const query = searchParams.toString();
    return query ? `?${query}` : '';
}

async function parseJsonSafely(response: Response): Promise<unknown> {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
    const response = await fetch(input, init);
    const body = await parseJsonSafely(response);

    if (!response.ok) {
        const payload = body as PromptAssetApiErrorBody | null;
        const error = payload?.error;

        throw new PromptAssetApiError(
            response.status,
            error?.code ?? 'PROMPT_ASSET_INTERNAL_ERROR',
            error?.message ?? 'Prompt asset request failed',
            error?.details ?? null
        );
    }

    return (body as PromptAssetApiSuccessBody<T>).data;
}

function getPromptAssetBasePath(workspaceSlug?: string | null) {
    return workspaceSlug
        ? `/api/workspaces/${encodeURIComponent(workspaceSlug)}/prompt-assets`
        : '/api/prompt-assets';
}

export function listPromptAssets(params?: ListPromptAssetsParams): Promise<PaginatedData<PromptAssetSummary>>;
export function listPromptAssets(
    workspaceSlug: string | null | undefined,
    params?: ListPromptAssetsParams
): Promise<PaginatedData<PromptAssetSummary>>;
export function listPromptAssets(
    workspaceSlugOrParams?: string | null | ListPromptAssetsParams,
    maybeParams: ListPromptAssetsParams = {}
) {
    const workspaceSlug =
        typeof workspaceSlugOrParams === 'string' || workspaceSlugOrParams == null
            ? workspaceSlugOrParams
            : undefined;
    const params =
        typeof workspaceSlugOrParams === 'string' || workspaceSlugOrParams == null
            ? maybeParams
            : workspaceSlugOrParams;

    return request<PaginatedData<PromptAssetSummary>>(
        `${getPromptAssetBasePath(workspaceSlug)}${buildSearch({
            query: params.query,
            status: params.status,
            page: params.page,
            pageSize: params.pageSize,
        })}`
    );
}

export function getPromptAssetDetail(assetId: string): Promise<PromptAssetDetail>;
export function getPromptAssetDetail(
    workspaceSlug: string | null | undefined,
    assetId: string
): Promise<PromptAssetDetail>;
export function getPromptAssetDetail(
    workspaceSlugOrAssetId: string | null | undefined,
    maybeAssetId?: string
) {
    const workspaceSlug = maybeAssetId === undefined ? undefined : workspaceSlugOrAssetId;
    const assetId = maybeAssetId ?? (workspaceSlugOrAssetId as string);
    return request<PromptAssetDetail>(`${getPromptAssetBasePath(workspaceSlug)}/${assetId}`);
}

export function createPromptAsset(payload: CreatePromptAssetPayload): Promise<PromptAssetDetail>;
export function createPromptAsset(
    workspaceSlug: string | null | undefined,
    payload: CreatePromptAssetPayload
): Promise<PromptAssetDetail>;
export function createPromptAsset(
    workspaceSlugOrPayload: string | null | undefined | CreatePromptAssetPayload,
    maybePayload?: CreatePromptAssetPayload
) {
    const workspaceSlug = maybePayload ? (workspaceSlugOrPayload as string | null | undefined) : undefined;
    const payload = maybePayload ?? (workspaceSlugOrPayload as CreatePromptAssetPayload);
    return request<PromptAssetDetail>(getPromptAssetBasePath(workspaceSlug), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
}

export function createPromptAssetVersion(
    assetId: string,
    payload: CreatePromptAssetVersionPayload
): Promise<PromptAssetDetail>;
export function createPromptAssetVersion(
    workspaceSlug: string | null | undefined,
    assetId: string,
    payload: CreatePromptAssetVersionPayload
) : Promise<PromptAssetDetail>;
export function createPromptAssetVersion(
    workspaceSlugOrAssetId: string | null | undefined,
    assetIdOrPayload: string | CreatePromptAssetVersionPayload,
    maybePayload?: CreatePromptAssetVersionPayload
) {
    const workspaceSlug = maybePayload ? workspaceSlugOrAssetId : undefined;
    const assetId = maybePayload ? (assetIdOrPayload as string) : (workspaceSlugOrAssetId as string);
    const payload = maybePayload ?? (assetIdOrPayload as CreatePromptAssetVersionPayload);
    return request<PromptAssetDetail>(`${getPromptAssetBasePath(workspaceSlug)}/${assetId}/versions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
}

export function listPromptAssetVersions(
    assetId: string,
    params?: ListPromptAssetVersionsParams
): Promise<PaginatedData<PromptAssetVersionItem>>;
export function listPromptAssetVersions(
    workspaceSlug: string | null | undefined,
    assetId: string,
    params: ListPromptAssetVersionsParams = {}
) : Promise<PaginatedData<PromptAssetVersionItem>>;
export function listPromptAssetVersions(
    workspaceSlugOrAssetId: string | null | undefined,
    assetIdOrParams?: string | ListPromptAssetVersionsParams,
    maybeParams: ListPromptAssetVersionsParams = {}
) {
    const workspaceSlug =
        typeof assetIdOrParams === 'string' ? workspaceSlugOrAssetId : undefined;
    const assetId =
        typeof assetIdOrParams === 'string'
            ? assetIdOrParams
            : (workspaceSlugOrAssetId as string);
    const params =
        typeof assetIdOrParams === 'string'
            ? maybeParams
            : (assetIdOrParams ?? {});

    return request<PaginatedData<PromptAssetVersionItem>>(
        `${getPromptAssetBasePath(workspaceSlug)}/${assetId}/versions${buildSearch({
            page: params.page,
            pageSize: params.pageSize,
        })}`
    );
}

export function restorePromptAssetVersion(
    assetId: string,
    payload: RestorePromptAssetVersionPayload
): Promise<PromptAssetDetail>;
export function restorePromptAssetVersion(
    workspaceSlug: string | null | undefined,
    assetId: string,
    payload: RestorePromptAssetVersionPayload
) : Promise<PromptAssetDetail>;
export function restorePromptAssetVersion(
    workspaceSlugOrAssetId: string | null | undefined,
    assetIdOrPayload: string | RestorePromptAssetVersionPayload,
    maybePayload?: RestorePromptAssetVersionPayload
) {
    const workspaceSlug = maybePayload ? workspaceSlugOrAssetId : undefined;
    const assetId = maybePayload ? (assetIdOrPayload as string) : (workspaceSlugOrAssetId as string);
    const payload = maybePayload ?? (assetIdOrPayload as RestorePromptAssetVersionPayload);
    return request<PromptAssetDetail>(`${getPromptAssetBasePath(workspaceSlug)}/${assetId}/restore`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
}

export function archivePromptAsset(assetId: string): Promise<PromptAssetSummary>;
export function archivePromptAsset(
    workspaceSlug: string | null | undefined,
    assetId: string
): Promise<PromptAssetSummary>;
export function archivePromptAsset(
    workspaceSlugOrAssetId: string | null | undefined,
    maybeAssetId?: string
) {
    const workspaceSlug = maybeAssetId === undefined ? undefined : workspaceSlugOrAssetId;
    const assetId = maybeAssetId ?? (workspaceSlugOrAssetId as string);
    return request<PromptAssetSummary>(`${getPromptAssetBasePath(workspaceSlug)}/${assetId}/archive`, {
        method: 'POST',
    });
}

export function unarchivePromptAsset(assetId: string): Promise<PromptAssetSummary>;
export function unarchivePromptAsset(
    workspaceSlug: string | null | undefined,
    assetId: string
): Promise<PromptAssetSummary>;
export function unarchivePromptAsset(
    workspaceSlugOrAssetId: string | null | undefined,
    maybeAssetId?: string
) {
    const workspaceSlug = maybeAssetId === undefined ? undefined : workspaceSlugOrAssetId;
    const assetId = maybeAssetId ?? (workspaceSlugOrAssetId as string);
    return request<PromptAssetSummary>(`${getPromptAssetBasePath(workspaceSlug)}/${assetId}/unarchive`, {
        method: 'POST',
    });
}
