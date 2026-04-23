import type { GenerateRequest } from '../../types';
import { ApiError } from '../api/errors';
import type { Principal } from '../auth/principal';
import { requestGenerateUpstream, readGenerateUpstreamError } from '../ai/generate';
import { iterateSseFrames, encodeJsonSseEvent } from '../ai/stream-events';
import { parseAnthropicStreamEventData } from '../ai/providers/anthropic';
import type { AigcRewriteGenerateInput } from './validators';
import { getAigcRewritePresetById } from './presets';
import { buildAigcRewriteSystemPrompt, buildAigcRewriteUserMessage } from './prompt';

interface AigcRewriteRuntimeConfig {
    provider: 'anthropic';
    apiKey: string;
    baseUrl: string;
    model: string;
    thinkingBudget: number;
    requestTimeoutMs: number;
    rateLimitWindowMs: number;
    rateLimitMaxRequests: number;
    maxConcurrentRequests: number;
}

interface AigcRewriteUsage {
    inputTokens: number;
    outputTokens: number;
}

interface RateLimitWindow {
    startedAt: number;
    count: number;
}

interface ResolvedAigcRewriteSample {
    sampleBefore: string;
    sampleAfter: string;
}

const ROUTE_PATH = '/api/workspaces/[workspaceSlug]/aigc-rewrite/generate';
const DEFAULT_THINKING_BUDGET = 10000;
const DEFAULT_TIMEOUT_MS = 120000;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60000;
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 5;
const DEFAULT_MAX_CONCURRENT_REQUESTS = 1;

const rateLimitWindows = new Map<string, RateLimitWindow>();
const concurrentExecutions = new Map<string, number>();

function readEnv(name: string): string | undefined {
    const value = process.env[name]?.trim();
    return value && value.length > 0 ? value : undefined;
}

function readBooleanEnv(name: string): boolean | undefined {
    const value = readEnv(name);
    if (!value) {
        return undefined;
    }

    if (value === 'true') {
        return true;
    }

    if (value === 'false') {
        return false;
    }

    return undefined;
}

function readPositiveIntEnv(name: string, fallback: number): number {
    const value = readEnv(name);
    if (!value) {
        return fallback;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getRuntimeConfig(): AigcRewriteRuntimeConfig {
    const isEnabled = readBooleanEnv('AIGC_REWRITE_ENABLED') ?? true;
    if (!isEnabled) {
        throw new ApiError(500, 'AIGC_REWRITE_DISABLED', 'AIGC rewrite is disabled');
    }

    const provider = readEnv('AIGC_REWRITE_PROVIDER') ?? 'anthropic';
    if (provider !== 'anthropic') {
        throw new ApiError(
            500,
            'AIGC_REWRITE_CONFIG_MISSING',
            'AIGC rewrite provider is not supported'
        );
    }

    const apiKey = readEnv('AIGC_REWRITE_API_KEY') ?? readEnv('AI_API_KEY');
    const baseUrl = readEnv('AIGC_REWRITE_BASE_URL') ?? readEnv('AI_BASE_URL');
    const model = readEnv('AIGC_REWRITE_MODEL') ?? readEnv('AI_MODEL');

    if (!apiKey || !baseUrl || !model) {
        throw new ApiError(
            500,
            'AIGC_REWRITE_CONFIG_MISSING',
            'AIGC rewrite configuration is incomplete'
        );
    }

    return {
        provider: 'anthropic',
        apiKey,
        baseUrl: baseUrl.replace(/\/+$/, ''),
        model,
        thinkingBudget: readPositiveIntEnv(
            'AIGC_REWRITE_THINKING_BUDGET',
            DEFAULT_THINKING_BUDGET
        ),
        requestTimeoutMs: readPositiveIntEnv(
            'AIGC_REWRITE_REQUEST_TIMEOUT_MS',
            DEFAULT_TIMEOUT_MS
        ),
        rateLimitWindowMs: readPositiveIntEnv(
            'AIGC_REWRITE_RATE_LIMIT_WINDOW_MS',
            DEFAULT_RATE_LIMIT_WINDOW_MS
        ),
        rateLimitMaxRequests: readPositiveIntEnv(
            'AIGC_REWRITE_RATE_LIMIT_MAX_REQUESTS',
            DEFAULT_RATE_LIMIT_MAX_REQUESTS
        ),
        maxConcurrentRequests: readPositiveIntEnv(
            'AIGC_REWRITE_MAX_CONCURRENT_REQUESTS',
            DEFAULT_MAX_CONCURRENT_REQUESTS
        ),
    };
}

function assertActiveWorkspace(principal: Principal): void {
    if (principal.activeWorkspaceStatus === 'archived') {
        throw new ApiError(
            403,
            'WORKSPACE_FORBIDDEN',
            'The workspace is archived and cannot use AIGC rewrite'
        );
    }
}

function reserveExecutionSlot(
    key: string,
    config: Pick<AigcRewriteRuntimeConfig, 'rateLimitWindowMs' | 'rateLimitMaxRequests' | 'maxConcurrentRequests'>
): () => void {
    const now = Date.now();
    const window = rateLimitWindows.get(key);

    if (!window || now - window.startedAt >= config.rateLimitWindowMs) {
        rateLimitWindows.set(key, { startedAt: now, count: 1 });
    } else {
        if (window.count >= config.rateLimitMaxRequests) {
            throw new ApiError(429, 'AIGC_REWRITE_RATE_LIMITED', 'Too many requests');
        }

        window.count += 1;
        rateLimitWindows.set(key, window);
    }

    const activeCount = concurrentExecutions.get(key) ?? 0;
    if (activeCount >= config.maxConcurrentRequests) {
        const currentWindow = rateLimitWindows.get(key);
        if (currentWindow) {
            currentWindow.count = Math.max(0, currentWindow.count - 1);
            if (currentWindow.count === 0) {
                rateLimitWindows.delete(key);
            } else {
                rateLimitWindows.set(key, currentWindow);
            }
        }

        throw new ApiError(429, 'AIGC_REWRITE_RATE_LIMITED', 'Too many concurrent requests');
    }

    concurrentExecutions.set(key, activeCount + 1);

    return () => {
        const nextCount = Math.max(0, (concurrentExecutions.get(key) ?? 1) - 1);
        if (nextCount === 0) {
            concurrentExecutions.delete(key);
        } else {
            concurrentExecutions.set(key, nextCount);
        }
    };
}

function createUpstreamAbortController(
    requestSignal: AbortSignal | undefined,
    timeoutMs: number
): { controller: AbortController; cleanup: () => void } {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        controller.abort(new Error('AIGC rewrite request timed out'));
    }, timeoutMs);

    const abortFromClient = () => {
        controller.abort(new Error('Client disconnected'));
    };

    requestSignal?.addEventListener('abort', abortFromClient, { once: true });

    return {
        controller,
        cleanup: () => {
            clearTimeout(timeoutId);
            requestSignal?.removeEventListener('abort', abortFromClient);
        },
    };
}

function getAbortMessage(error: unknown): string | null {
    if (error instanceof Error) {
        return error.message;
    }

    return null;
}

function emitLog(payload: Record<string, unknown>): void {
    console.info(
        JSON.stringify({
            route: ROUTE_PATH,
            ...payload,
        })
    );
}

function toGenerateRequest(
    input: AigcRewriteGenerateInput,
    sample: ResolvedAigcRewriteSample,
    runtimeConfig: AigcRewriteRuntimeConfig
): GenerateRequest {
    return {
        systemPrompt: buildAigcRewriteSystemPrompt({
            sampleBefore: sample.sampleBefore,
            sampleAfter: sample.sampleAfter,
            targetText: input.targetText,
        }),
        messages: [
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: buildAigcRewriteUserMessage(input.targetText),
                    },
                ],
            },
        ],
        stream: true,
        thinking: true,
        thinkingBudget: runtimeConfig.thinkingBudget,
    };
}

function resolveAigcRewriteSample(input: AigcRewriteGenerateInput): ResolvedAigcRewriteSample {
    if (input.presetId) {
        const preset = getAigcRewritePresetById(input.presetId);

        if (!preset) {
            throw new ApiError(422, 'AIGC_REWRITE_PRESET_NOT_FOUND', 'Preset template does not exist');
        }

        return {
            sampleBefore: preset.sampleBefore,
            sampleAfter: preset.sampleAfter,
        };
    }

    if (!input.sampleBefore || !input.sampleAfter) {
        throw new ApiError(422, 'AIGC_REWRITE_VALIDATION_FAILED', 'Manual sample texts are required');
    }

    return {
        sampleBefore: input.sampleBefore,
        sampleAfter: input.sampleAfter,
    };
}

export class AigcRewriteService {
    async generate(
        principal: Principal,
        input: AigcRewriteGenerateInput,
        context: { requestId: string; requestSignal?: AbortSignal }
    ): Promise<Response> {
        assertActiveWorkspace(principal);

        const runtimeConfig = getRuntimeConfig();
        const resolvedSample = resolveAigcRewriteSample(input);
        const executionKey = `${principal.activeWorkspaceId}:${principal.userId}`;
        const release = reserveExecutionSlot(executionKey, runtimeConfig);
        const startedAt = Date.now();
        const { controller, cleanup } = createUpstreamAbortController(
            context.requestSignal,
            runtimeConfig.requestTimeoutMs
        );

        let released = false;

        const finalize = () => {
            if (released) {
                return;
            }

            released = true;
            cleanup();
            release();
        };

        try {
            const upstreamResponse = await requestGenerateUpstream(
                runtimeConfig,
                toGenerateRequest(input, resolvedSample, runtimeConfig),
                { signal: controller.signal }
            );

            if (!upstreamResponse.ok) {
                const upstreamMessage = await readGenerateUpstreamError(upstreamResponse);
                emitLog({
                    request_id: context.requestId,
                    user_id: principal.userId,
                    workspace_id: principal.activeWorkspaceId,
                    workspace_slug: principal.activeWorkspaceSlug,
                    provider: runtimeConfig.provider,
                    model: runtimeConfig.model,
                    status_code: 502,
                    latency_ms: Date.now() - startedAt,
                    input_chars: resolvedSample.sampleBefore.length + resolvedSample.sampleAfter.length + input.targetText.length,
                    output_chars: 0,
                    upstream_error: upstreamMessage.slice(0, 200),
                });

                finalize();
                throw new ApiError(502, 'AIGC_REWRITE_UPSTREAM_ERROR', 'Model request failed');
            }

            if (!upstreamResponse.body) {
                finalize();
                throw new ApiError(502, 'AIGC_REWRITE_UPSTREAM_ERROR', 'Model request failed');
            }

            const upstreamBody = upstreamResponse.body;

            const stream = new ReadableStream<Uint8Array>({
                async start(outputController) {
                    const usage: AigcRewriteUsage = { inputTokens: 0, outputTokens: 0 };
                    let stopReason = 'unknown';
                    let outputChars = 0;
                    let doneSent = false;
                    let streamErrored = false;

                    outputController.enqueue(
                        encodeJsonSseEvent('meta', {
                            requestId: context.requestId,
                            workspaceSlug: principal.activeWorkspaceSlug,
                            model: runtimeConfig.model,
                            provider: runtimeConfig.provider,
                        })
                    );

                    try {
                        for await (const frame of iterateSseFrames(upstreamBody)) {
                            if (!frame.data) {
                                continue;
                            }

                            const event = parseAnthropicStreamEventData(frame.data);
                            if (!event) {
                                continue;
                            }

                            switch (event.type) {
                                case 'message_start': {
                                    usage.inputTokens = event.message?.usage?.input_tokens ?? usage.inputTokens;
                                    usage.outputTokens = event.message?.usage?.output_tokens ?? usage.outputTokens;
                                    break;
                                }
                                case 'message_delta': {
                                    stopReason = event.delta?.stop_reason ?? stopReason;
                                    usage.inputTokens = event.usage?.input_tokens ?? usage.inputTokens;
                                    usage.outputTokens = event.usage?.output_tokens ?? usage.outputTokens;
                                    break;
                                }
                                case 'content_block_delta': {
                                    if (event.delta?.type === 'thinking_delta' && event.delta.thinking) {
                                        outputController.enqueue(
                                            encodeJsonSseEvent('delta', {
                                                channel: 'thinking',
                                                text: event.delta.thinking,
                                            })
                                        );
                                    } else if (event.delta?.type === 'text_delta' && event.delta.text) {
                                        outputChars += event.delta.text.length;
                                        outputController.enqueue(
                                            encodeJsonSseEvent('delta', {
                                                channel: 'output',
                                                text: event.delta.text,
                                            })
                                        );
                                    }
                                    break;
                                }
                                case 'message_stop': {
                                    doneSent = true;
                                    outputController.enqueue(
                                        encodeJsonSseEvent('done', {
                                            stopReason,
                                            usage,
                                        })
                                    );
                                    break;
                                }
                                case 'error': {
                                    streamErrored = true;
                                    outputController.enqueue(
                                        encodeJsonSseEvent('error', {
                                            code: 'AIGC_REWRITE_UPSTREAM_ERROR',
                                            message: 'Model request failed',
                                            requestId: context.requestId,
                                            retryable: true,
                                        })
                                    );
                                    break;
                                }
                                default:
                                    break;
                            }

                            if (doneSent || streamErrored) {
                                break;
                            }
                        }

                        if (!doneSent && !streamErrored && !context.requestSignal?.aborted) {
                            outputController.enqueue(
                                encodeJsonSseEvent('done', {
                                    stopReason,
                                    usage,
                                })
                            );
                        }
                    } catch (error) {
                        const abortMessage = getAbortMessage(error);
                        const wasClientAbort =
                            context.requestSignal?.aborted === true ||
                            abortMessage === 'Client disconnected';

                        if (!wasClientAbort) {
                            outputController.enqueue(
                                encodeJsonSseEvent('error', {
                                    code: 'AIGC_REWRITE_UPSTREAM_ERROR',
                                    message: abortMessage === 'AIGC rewrite request timed out'
                                        ? 'Model request timed out'
                                        : 'Model request failed',
                                    requestId: context.requestId,
                                    retryable: true,
                                })
                            );
                        }
                    } finally {
                        emitLog({
                            request_id: context.requestId,
                            user_id: principal.userId,
                            workspace_id: principal.activeWorkspaceId,
                            workspace_slug: principal.activeWorkspaceSlug,
                            provider: runtimeConfig.provider,
                            model: runtimeConfig.model,
                            status_code: streamErrored ? 502 : 200,
                            latency_ms: Date.now() - startedAt,
                            input_chars:
                                resolvedSample.sampleBefore.length +
                                resolvedSample.sampleAfter.length +
                                input.targetText.length,
                            output_chars: outputChars,
                        });
                        finalize();
                        outputController.close();
                    }
                },
            });

            return new Response(stream, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    Connection: 'keep-alive',
                    'x-request-id': context.requestId,
                },
            });
        } catch (error) {
            finalize();

            const abortMessage = getAbortMessage(error);
            if (abortMessage === 'AIGC rewrite request timed out') {
                throw new ApiError(502, 'AIGC_REWRITE_UPSTREAM_ERROR', 'Model request timed out');
            }

            if (error instanceof ApiError) {
                throw error;
            }

            throw new ApiError(502, 'AIGC_REWRITE_UPSTREAM_ERROR', 'Model request failed');
        }
    }
}

let singleton: AigcRewriteService | null = null;

export function getAigcRewriteService(): AigcRewriteService {
    if (!singleton) {
        singleton = new AigcRewriteService();
    }

    return singleton;
}

export function resetAigcRewriteServiceStateForTests(): void {
    rateLimitWindows.clear();
    concurrentExecutions.clear();
}
