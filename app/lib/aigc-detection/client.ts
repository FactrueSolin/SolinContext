import { ExternalTaskResultResponse, ExternalTaskStatusResponse, type ExternalCreateTaskResponse } from './dto';
import {
    parseExternalCreateTaskResponse,
    parseExternalTaskResultResponse,
    parseExternalTaskStatusResponse,
} from './mapper';
import { aigcDetectionExternalSubmitFailed, aigcDetectionExternalSyncFailed } from './errors';

interface AigcDetectionClientConfig {
    baseUrl: string;
    timeoutMs: number;
}

export interface AigcDetectionClientLike {
    createTask(options: {
        fileName: string;
        mimeType: string;
        bytes: Uint8Array;
        idempotencyKey: string;
        forceReprocess: boolean;
        metadata: Record<string, string>;
    }): Promise<ExternalCreateTaskResponse>;
    getTaskStatus(taskId: string): Promise<ExternalTaskStatusResponse>;
    getTaskResult(taskId: string): Promise<ExternalTaskResultResponse>;
}

const DEFAULT_TIMEOUT_MS = 30000;

function readEnv(name: string): string | undefined {
    const value = process.env[name]?.trim();
    return value && value.length > 0 ? value : undefined;
}

function readPositiveIntEnv(name: string, fallback: number): number {
    const value = readEnv(name);
    if (!value) {
        return fallback;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getConfig(): AigcDetectionClientConfig {
    const baseUrl = readEnv('AIGC_DETECTION_API_BASE_URL');
    if (!baseUrl) {
        throw aigcDetectionExternalSubmitFailed('AIGC detection API base URL is not configured');
    }

    return {
        baseUrl: baseUrl.replace(/\/+$/, ''),
        timeoutMs: readPositiveIntEnv('AIGC_DETECTION_API_TIMEOUT_MS', DEFAULT_TIMEOUT_MS),
    };
}

async function parseJsonResponse(response: Response): Promise<unknown> {
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
        return null;
    }

    return response.json();
}

async function requestWithTimeout(input: string, init: RequestInit, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(input, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
}

async function throwExternalError(response: Response, fallbackMessage: string, type: 'submit' | 'sync'): Promise<never> {
    const payload = await parseJsonResponse(response);
    const message =
        typeof payload === 'object' &&
        payload !== null &&
        'error' in payload &&
        typeof payload.error === 'object' &&
        payload.error !== null &&
        'message' in payload.error &&
        typeof payload.error.message === 'string'
            ? payload.error.message
            : fallbackMessage;

    const details =
        typeof payload === 'object' && payload !== null && 'error' in payload ? payload : { status: response.status };

    if (type === 'submit') {
        throw aigcDetectionExternalSubmitFailed(message, details);
    }

    throw aigcDetectionExternalSyncFailed(message, details);
}

export class AigcDetectionClient implements AigcDetectionClientLike {
    private readonly config = getConfig();

    async createTask(options: {
        fileName: string;
        mimeType: string;
        bytes: Uint8Array;
        idempotencyKey: string;
        forceReprocess: boolean;
        metadata: Record<string, string>;
    }): Promise<ExternalCreateTaskResponse> {
        const form = new FormData();
        form.set(
            'file',
            new File([options.bytes], options.fileName, {
                type: options.mimeType,
            })
        );
        form.set('force_reprocess', String(options.forceReprocess));
        form.set('metadata', JSON.stringify(options.metadata));

        const response = await requestWithTimeout(
            `${this.config.baseUrl}/api/v1/aigc-detection/tasks`,
            {
                method: 'POST',
                headers: {
                    'Idempotency-Key': options.idempotencyKey,
                },
                body: form,
            },
            this.config.timeoutMs
        );

        if (!response.ok) {
            await throwExternalError(response, 'Failed to submit AIGC detection task', 'submit');
        }

        return parseExternalCreateTaskResponse(await response.json());
    }

    async getTaskStatus(taskId: string): Promise<ExternalTaskStatusResponse> {
        const response = await requestWithTimeout(
            `${this.config.baseUrl}/api/v1/aigc-detection/tasks/${encodeURIComponent(taskId)}`,
            {
                method: 'GET',
            },
            this.config.timeoutMs
        );

        if (!response.ok) {
            await throwExternalError(response, 'Failed to fetch AIGC detection task status', 'sync');
        }

        return parseExternalTaskStatusResponse(await response.json());
    }

    async getTaskResult(taskId: string): Promise<ExternalTaskResultResponse> {
        const response = await requestWithTimeout(
            `${this.config.baseUrl}/api/v1/aigc-detection/tasks/${encodeURIComponent(taskId)}/result`,
            {
                method: 'GET',
            },
            this.config.timeoutMs
        );

        if (!response.ok) {
            await throwExternalError(response, 'Failed to fetch AIGC detection task result', 'sync');
        }

        return parseExternalTaskResultResponse(await response.json());
    }
}

let aigcDetectionClient: AigcDetectionClient | null = null;

export function getAigcDetectionClient(): AigcDetectionClient {
    if (!aigcDetectionClient) {
        aigcDetectionClient = new AigcDetectionClient();
    }

    return aigcDetectionClient;
}
