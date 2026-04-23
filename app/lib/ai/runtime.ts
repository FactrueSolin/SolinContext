import type { RuntimeApiConfigMetadata } from './api-config';

export type AiModelTarget = 'primary' | 'compare';

export interface ServerAiModelConfig {
    apiKey: string;
    baseUrl: string;
    label: string;
    model: string;
}

function readEnv(name: string): string | undefined {
    const value = process.env[name]?.trim();
    return value ? value : undefined;
}

function trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '');
}

function getRequiredEnv(name: string): string {
    const value = readEnv(name);

    if (!value) {
        throw new Error(`Missing required env: ${name}`);
    }

    return value;
}

export function isCompareModelConfigured(): boolean {
    return Boolean(
        readEnv('AI_COMPARE_BASE_URL') &&
            readEnv('AI_COMPARE_API_KEY') &&
            readEnv('AI_COMPARE_MODEL')
    );
}

export function getRuntimeApiConfigMetadata(): RuntimeApiConfigMetadata {
    const primaryModel = readEnv('AI_MODEL');
    const hasCompareModel = isCompareModelConfigured();
    const compareModel = hasCompareModel ? readEnv('AI_COMPARE_MODEL') : undefined;

    return {
        hasCompareModel,
        primaryModelLabel: readEnv('AI_MODEL_LABEL') ?? primaryModel,
        compareModelLabel: hasCompareModel ? readEnv('AI_COMPARE_MODEL_LABEL') ?? compareModel : undefined,
    };
}

export function getServerAiModelConfig(target: AiModelTarget = 'primary'): ServerAiModelConfig {
    if (target === 'compare') {
        return {
            apiKey: getRequiredEnv('AI_COMPARE_API_KEY'),
            baseUrl: trimTrailingSlash(getRequiredEnv('AI_COMPARE_BASE_URL')),
            label: readEnv('AI_COMPARE_MODEL_LABEL') ?? getRequiredEnv('AI_COMPARE_MODEL'),
            model: getRequiredEnv('AI_COMPARE_MODEL'),
        };
    }

    return {
        apiKey: getRequiredEnv('AI_API_KEY'),
        baseUrl: trimTrailingSlash(getRequiredEnv('AI_BASE_URL')),
        label: readEnv('AI_MODEL_LABEL') ?? getRequiredEnv('AI_MODEL'),
        model: getRequiredEnv('AI_MODEL'),
    };
}
