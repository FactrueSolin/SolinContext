import { NextResponse } from 'next/server';
import { type ZodType } from 'zod';
import {
    formatZodError,
    isPromptAssetError,
    promptAssetBadRequest,
    promptAssetInternalError,
    promptAssetValidationFailed,
} from './errors';

export async function parseJsonBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
    let body: unknown;

    try {
        body = await request.json();
    } catch {
        throw promptAssetBadRequest('Invalid JSON request body');
    }

    const result = schema.safeParse(body);
    if (!result.success) {
        throw promptAssetValidationFailed(formatZodError(result.error));
    }

    return result.data;
}

export function parseSearchParams<T>(searchParams: URLSearchParams, schema: ZodType<T>): T {
    const raw = Object.fromEntries(searchParams.entries());
    const result = schema.safeParse(raw);

    if (!result.success) {
        throw promptAssetBadRequest('Invalid query parameters', formatZodError(result.error));
    }

    return result.data;
}

export function promptAssetSuccess<T>(data: T, status = 200): NextResponse {
    return NextResponse.json({ data }, { status });
}

export function promptAssetErrorResponse(error: unknown): NextResponse {
    if (isPromptAssetError(error)) {
        return NextResponse.json(
            {
                error: {
                    code: error.code,
                    message: error.message,
                    details: error.details,
                },
            },
            { status: error.status }
        );
    }

    const internalError = promptAssetInternalError(
        error instanceof Error ? error.message : 'Prompt asset internal error'
    );

    return NextResponse.json(
        {
            error: {
                code: internalError.code,
                message: internalError.message,
                details: internalError.details,
            },
        },
        { status: internalError.status }
    );
}
