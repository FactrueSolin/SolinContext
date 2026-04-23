export interface AigcRewriteGeneratePayload {
    sampleBefore?: string;
    sampleAfter?: string;
    presetId?: string;
    targetText: string;
}

export interface AigcRewritePresetSummary {
    id: string;
    name: string;
    description: string;
    recommendedUsage: string;
}

export interface AigcRewriteApiErrorBody {
    error?: {
        code?: string;
        message?: string;
        details?: unknown;
        requestId?: string;
    };
}

export interface AigcRewriteMetaEvent {
    requestId: string;
    workspaceSlug: string;
    model: string;
    provider: string;
}

export interface AigcRewriteDeltaEvent {
    channel: 'thinking' | 'output';
    text: string;
}

export interface AigcRewriteDoneEvent {
    stopReason: string;
    usage?: {
        inputTokens: number;
        outputTokens: number;
    };
}

export interface AigcRewriteErrorEvent {
    code: string;
    message: string;
    requestId?: string;
    retryable?: boolean;
}

interface ParsedSseFrame {
    event: string;
    data: string;
}

export class AigcRewriteClientError extends Error {
    readonly status: number;
    readonly code: string;
    readonly details: unknown;
    readonly requestId: string | null;

    constructor(
        status: number,
        code: string,
        message: string,
        details: unknown = null,
        requestId: string | null = null
    ) {
        super(message);
        this.name = 'AigcRewriteClientError';
        this.status = status;
        this.code = code;
        this.details = details;
        this.requestId = requestId;
    }
}

async function parseJsonSafely(response: Response): Promise<unknown> {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

function parseSseFrame(rawFrame: string): ParsedSseFrame | null {
    const lines = rawFrame.split('\n');
    let event = 'message';
    const dataLines: string[] = [];

    for (const line of lines) {
        if (line.startsWith('event:')) {
            event = line.slice(6).trim();
            continue;
        }

        if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trim());
        }
    }

    if (dataLines.length === 0) {
        return null;
    }

    return {
        event,
        data: dataLines.join('\n'),
    };
}

export async function requestAigcRewriteStream(
    workspaceSlug: string,
    payload: AigcRewriteGeneratePayload,
    signal: AbortSignal
): Promise<Response> {
    const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceSlug)}/aigc-rewrite/generate`, {
        method: 'POST',
        headers: {
            Accept: 'text/event-stream',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal,
    });

    if (response.ok) {
        return response;
    }

    const body = await parseJsonSafely(response);
    const payloadError = body as AigcRewriteApiErrorBody | null;

    throw new AigcRewriteClientError(
        response.status,
        payloadError?.error?.code ?? 'AIGC_REWRITE_REQUEST_FAILED',
        payloadError?.error?.message ?? '改写请求失败，请稍后再试。',
        payloadError?.error?.details ?? null,
        payloadError?.error?.requestId ?? null
    );
}

export async function listAigcRewritePresets(workspaceSlug: string): Promise<AigcRewritePresetSummary[]> {
    const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceSlug)}/aigc-rewrite/presets`);
    const body = await parseJsonSafely(response);
    const payload = body as { data?: AigcRewritePresetSummary[] } & AigcRewriteApiErrorBody;

    if (!response.ok) {
        throw new AigcRewriteClientError(
            response.status,
            payload?.error?.code ?? 'AIGC_REWRITE_PRESET_REQUEST_FAILED',
            payload?.error?.message ?? '读取预设模板失败，请稍后再试。',
            payload?.error?.details ?? null,
            payload?.error?.requestId ?? null
        );
    }

    return payload.data ?? [];
}

export async function consumeAigcRewriteStream(
    response: Response,
    handlers: {
        onMeta?: (payload: AigcRewriteMetaEvent) => void;
        onDelta?: (payload: AigcRewriteDeltaEvent) => void;
        onDone?: (payload: AigcRewriteDoneEvent) => void;
        onError?: (payload: AigcRewriteErrorEvent) => void;
    },
    signal?: AbortSignal
): Promise<void> {
    if (!response.body) {
        throw new Error('改写响应为空。');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            if (signal?.aborted) {
                break;
            }

            const { done, value } = await reader.read();
            if (done) {
                break;
            }

            if (signal?.aborted) {
                break;
            }

            buffer += decoder.decode(value, { stream: true });
            const frames = buffer.split('\n\n');
            buffer = frames.pop() ?? '';

            for (const frame of frames) {
                const parsedFrame = parseSseFrame(frame);
                if (!parsedFrame) {
                    continue;
                }

                let data: unknown;

                try {
                    data = JSON.parse(parsedFrame.data) as unknown;
                } catch {
                    continue;
                }

                if (parsedFrame.event === 'meta') {
                    handlers.onMeta?.(data as AigcRewriteMetaEvent);
                    continue;
                }

                if (parsedFrame.event === 'delta') {
                    handlers.onDelta?.(data as AigcRewriteDeltaEvent);
                    continue;
                }

                if (parsedFrame.event === 'done') {
                    handlers.onDone?.(data as AigcRewriteDoneEvent);
                    continue;
                }

                if (parsedFrame.event === 'error') {
                    handlers.onError?.(data as AigcRewriteErrorEvent);
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
}
