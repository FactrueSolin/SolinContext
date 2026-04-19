import { ZodError } from 'zod';
import { ApiError } from '../api/errors';

export type PromptAssetErrorCode =
    | 'PROMPT_ASSET_BAD_REQUEST'
    | 'PROMPT_ASSET_NOT_FOUND'
    | 'PROMPT_ASSET_VERSION_NOT_FOUND'
    | 'PROMPT_ASSET_ARCHIVED'
    | 'PROMPT_ASSET_NO_CHANGES'
    | 'PROMPT_ASSET_VERSION_CONFLICT'
    | 'PROMPT_ASSET_VALIDATION_FAILED'
    | 'PROMPT_ASSET_INTERNAL_ERROR';

export class PromptAssetError extends ApiError {
    constructor(status: number, code: PromptAssetErrorCode, message: string, details: unknown = null) {
        super(status, code, message, details);
        this.name = 'PromptAssetError';
    }
}

export function isPromptAssetError(error: unknown): error is PromptAssetError {
    return error instanceof PromptAssetError;
}

export function formatZodError(error: ZodError): Record<string, string[]> {
    return error.flatten().fieldErrors as Record<string, string[]>;
}

export function promptAssetBadRequest(
    message = 'Prompt asset bad request',
    details: unknown = null
): PromptAssetError {
    return new PromptAssetError(400, 'PROMPT_ASSET_BAD_REQUEST', message, details);
}

export function promptAssetNotFound(assetId: string): PromptAssetError {
    return new PromptAssetError(404, 'PROMPT_ASSET_NOT_FOUND', `Prompt asset "${assetId}" not found`);
}

export function promptAssetVersionNotFound(versionId: string): PromptAssetError {
    return new PromptAssetError(
        404,
        'PROMPT_ASSET_VERSION_NOT_FOUND',
        `Prompt asset version "${versionId}" not found`
    );
}

export function promptAssetArchived(assetId: string): PromptAssetError {
    return new PromptAssetError(
        409,
        'PROMPT_ASSET_ARCHIVED',
        `Prompt asset "${assetId}" is archived`
    );
}

export function promptAssetNoChanges(assetId: string): PromptAssetError {
    return new PromptAssetError(
        409,
        'PROMPT_ASSET_NO_CHANGES',
        `Prompt asset "${assetId}" has no changes`
    );
}

export function promptAssetVersionConflict(
    assetId: string,
    expectedVersionNumber: number,
    actualVersionNumber: number
): PromptAssetError {
    return new PromptAssetError(
        409,
        'PROMPT_ASSET_VERSION_CONFLICT',
        `Prompt asset "${assetId}" version conflict`,
        {
            expectedVersionNumber,
            actualVersionNumber,
        }
    );
}

export function promptAssetValidationFailed(details: unknown): PromptAssetError {
    return new PromptAssetError(
        422,
        'PROMPT_ASSET_VALIDATION_FAILED',
        'Prompt asset validation failed',
        details
    );
}

export function promptAssetInternalError(message = 'Prompt asset internal error'): PromptAssetError {
    return new PromptAssetError(500, 'PROMPT_ASSET_INTERNAL_ERROR', message);
}
