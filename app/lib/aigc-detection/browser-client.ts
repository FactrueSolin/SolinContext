import type {
    AigcDetectionResultDto,
    AigcDetectionTaskDetail,
    AigcDetectionTaskListDto,
    AigcDetectionTaskStatus,
} from './dto';

export type AigcDetectionApiErrorCode =
    | 'AIGC_DETECTION_VALIDATION_FAILED'
    | 'AIGC_DETECTION_UNSUPPORTED_FILE_TYPE'
    | 'AIGC_DETECTION_FILE_TOO_LARGE'
    | 'AIGC_DETECTION_TASK_NOT_FOUND'
    | 'AIGC_DETECTION_TASK_NOT_COMPLETED'
    | 'AIGC_DETECTION_TASK_NOT_RETRYABLE'
    | 'AIGC_DETECTION_STORAGE_ERROR'
    | 'AIGC_DETECTION_EXTERNAL_SUBMIT_FAILED'
    | 'AIGC_DETECTION_EXTERNAL_SYNC_FAILED'
    | 'AIGC_DETECTION_FORBIDDEN'
    | 'AIGC_DETECTION_INTERNAL_ERROR';

interface AigcDetectionApiErrorBody {
    error?: {
        code?: AigcDetectionApiErrorCode;
        message?: string;
        details?: unknown;
    };
}

interface AigcDetectionApiSuccessBody<T> {
    data: T;
}

export interface ListAigcDetectionTasksParams {
    page?: number;
    pageSize?: number;
    status?: AigcDetectionTaskStatus | 'all';
    keyword?: string;
}

export class AigcDetectionApiError extends Error {
    readonly status: number;
    readonly code: AigcDetectionApiErrorCode;
    readonly details: unknown;

    constructor(status: number, code: AigcDetectionApiErrorCode, message: string, details: unknown = null) {
        super(message);
        this.name = 'AigcDetectionApiError';
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
        const payload = body as AigcDetectionApiErrorBody | null;

        throw new AigcDetectionApiError(
            response.status,
            payload?.error?.code ?? 'AIGC_DETECTION_INTERNAL_ERROR',
            payload?.error?.message ?? 'AIGC detection request failed',
            payload?.error?.details ?? null
        );
    }

    return (body as AigcDetectionApiSuccessBody<T>).data;
}

function getBasePath(workspaceSlug: string) {
    return `/api/workspaces/${encodeURIComponent(workspaceSlug)}/aigc-detection/tasks`;
}

export function listAigcDetectionTasks(workspaceSlug: string, params: ListAigcDetectionTasksParams = {}) {
    return request<AigcDetectionTaskListDto>(
        `${getBasePath(workspaceSlug)}${buildSearch({
            page: params.page,
            pageSize: params.pageSize,
            status: params.status,
            keyword: params.keyword,
        })}`
    );
}

export function getAigcDetectionTaskDetail(workspaceSlug: string, taskId: string) {
    return request<{ task: AigcDetectionTaskDetail }>(`${getBasePath(workspaceSlug)}/${encodeURIComponent(taskId)}`);
}

export function getAigcDetectionTaskResult(workspaceSlug: string, taskId: string) {
    return request<AigcDetectionResultDto>(`${getBasePath(workspaceSlug)}/${encodeURIComponent(taskId)}/result`);
}

export function retryAigcDetectionTask(workspaceSlug: string, taskId: string) {
    return request<{ task: AigcDetectionTaskDetail }>(
        `${getBasePath(workspaceSlug)}/${encodeURIComponent(taskId)}/retry`,
        {
            method: 'POST',
        }
    );
}

export function createAigcDetectionTask(workspaceSlug: string, payload: {
    file: File;
    forceReprocess?: boolean;
}) {
    const formData = new FormData();
    formData.set('file', payload.file);

    if (payload.forceReprocess !== undefined) {
        formData.set('forceReprocess', String(payload.forceReprocess));
    }

    return request<{ task: AigcDetectionTaskDetail; reusedResult: boolean }>(getBasePath(workspaceSlug), {
        method: 'POST',
        body: formData,
    });
}
