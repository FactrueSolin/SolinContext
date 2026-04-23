import type { ApiConfig, CompareApiConfig } from '../../types';

export interface RuntimeApiConfigMetadata {
    hasCompareModel: boolean;
    primaryModelLabel?: string;
    compareModelLabel?: string;
}

function asObject(value: unknown): Record<string, unknown> {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }

    return value as Record<string, unknown>;
}

function readOptionalNumber(source: Record<string, unknown>, key: string): number | undefined {
    const value = source[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readOptionalBoolean(source: Record<string, unknown>, key: string): boolean | undefined {
    const value = source[key];
    return typeof value === 'boolean' ? value : undefined;
}

function readOptionalString(source: Record<string, unknown>, key: string): string | undefined {
    const value = source[key];
    return typeof value === 'string' ? value : undefined;
}

function readOptionalStringArray(source: Record<string, unknown>, key: string): string[] | undefined {
    const value = source[key];
    if (!Array.isArray(value)) {
        return undefined;
    }

    const normalized = value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

    return normalized.length > 0 ? normalized : undefined;
}

export function sanitizeApiConfig(input: unknown): ApiConfig {
    const source = asObject(input);
    const sanitized: ApiConfig = {};

    const temperature = readOptionalNumber(source, 'temperature');
    const topP = readOptionalNumber(source, 'topP');
    const topK = readOptionalNumber(source, 'topK');
    const maxTokens = readOptionalNumber(source, 'maxTokens');
    const stopSequences = readOptionalStringArray(source, 'stopSequences');
    const stream = readOptionalBoolean(source, 'stream');
    const thinking = readOptionalBoolean(source, 'thinking');
    const thinkingBudget = readOptionalNumber(source, 'thinkingBudget');

    if (temperature !== undefined) {
        sanitized.temperature = temperature;
    }
    if (topP !== undefined) {
        sanitized.topP = topP;
    }
    if (topK !== undefined) {
        sanitized.topK = topK;
    }
    if (maxTokens !== undefined) {
        sanitized.maxTokens = maxTokens;
    }
    if (stopSequences !== undefined) {
        sanitized.stopSequences = stopSequences;
    }
    if (stream !== undefined) {
        sanitized.stream = stream;
    }
    if (thinking !== undefined) {
        sanitized.thinking = thinking;
    }
    if (thinkingBudget !== undefined) {
        sanitized.thinkingBudget = thinkingBudget;
    }

    return sanitized;
}

function hasLegacyCompareModelField(compareModel: CompareApiConfig): boolean {
    return (
        compareModel.baseUrl !== undefined ||
        compareModel.apiKey !== undefined ||
        compareModel.model !== undefined
    );
}

export function extractLegacyApiConfigFields(input: unknown): ApiConfig {
    const source = asObject(input);
    const legacy: ApiConfig = {};
    const baseUrl = readOptionalString(source, 'baseUrl');
    const apiKey = readOptionalString(source, 'apiKey');
    const model = readOptionalString(source, 'model');
    const compareModelSource = asObject(source.compareModel);
    const compareModel: CompareApiConfig = {};

    if (baseUrl !== undefined) {
        legacy.baseUrl = baseUrl;
    }
    if (apiKey !== undefined) {
        legacy.apiKey = apiKey;
    }
    if (model !== undefined) {
        legacy.model = model;
    }

    const compareBaseUrl = readOptionalString(compareModelSource, 'baseUrl');
    const compareApiKey = readOptionalString(compareModelSource, 'apiKey');
    const compareModelName = readOptionalString(compareModelSource, 'model');

    if (compareBaseUrl !== undefined) {
        compareModel.baseUrl = compareBaseUrl;
    }
    if (compareApiKey !== undefined) {
        compareModel.apiKey = compareApiKey;
    }
    if (compareModelName !== undefined) {
        compareModel.model = compareModelName;
    }

    if (hasLegacyCompareModelField(compareModel)) {
        legacy.compareModel = compareModel;
    }

    return legacy;
}

export function normalizePersistedApiConfig(input: unknown): ApiConfig {
    return {
        ...extractLegacyApiConfigFields(input),
        ...sanitizeApiConfig(input),
    };
}

export function mergeApiConfigForPersistence(baseConfig: unknown, nextConfig: unknown): ApiConfig {
    return {
        ...extractLegacyApiConfigFields(baseConfig),
        ...normalizePersistedApiConfig(nextConfig),
    };
}

export function withRuntimeApiConfigMetadata(
    apiConfig: ApiConfig,
    metadata: RuntimeApiConfigMetadata
): ApiConfig {
    return {
        ...sanitizeApiConfig(apiConfig),
        ...metadata,
    };
}
