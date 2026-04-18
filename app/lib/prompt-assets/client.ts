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

export function listPromptAssets(params: ListPromptAssetsParams = {}) {
    return request<PaginatedData<PromptAssetSummary>>(
        `/api/prompt-assets${buildSearch({
            query: params.query,
            status: params.status,
            page: params.page,
            pageSize: params.pageSize,
        })}`
    );
}

export function getPromptAssetDetail(assetId: string) {
    return request<PromptAssetDetail>(`/api/prompt-assets/${assetId}`);
}

export function createPromptAsset(payload: CreatePromptAssetPayload) {
    return request<PromptAssetDetail>('/api/prompt-assets', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
}

export function createPromptAssetVersion(assetId: string, payload: CreatePromptAssetVersionPayload) {
    return request<PromptAssetDetail>(`/api/prompt-assets/${assetId}/versions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
}

export function listPromptAssetVersions(assetId: string, params: ListPromptAssetVersionsParams = {}) {
    return request<PaginatedData<PromptAssetVersionItem>>(
        `/api/prompt-assets/${assetId}/versions${buildSearch({
            page: params.page,
            pageSize: params.pageSize,
        })}`
    );
}

export function restorePromptAssetVersion(assetId: string, payload: RestorePromptAssetVersionPayload) {
    return request<PromptAssetDetail>(`/api/prompt-assets/${assetId}/restore`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
}

export function archivePromptAsset(assetId: string) {
    return request<PromptAssetSummary>(`/api/prompt-assets/${assetId}/archive`, {
        method: 'POST',
    });
}

export function unarchivePromptAsset(assetId: string) {
    return request<PromptAssetSummary>(`/api/prompt-assets/${assetId}/unarchive`, {
        method: 'POST',
    });
}
