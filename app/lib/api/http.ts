import { ulid } from 'ulid';
import { NextResponse } from 'next/server';
import { type ZodError, type ZodType } from 'zod';
import { ApiError, badRequest, internalError, isApiError, validationFailed } from './errors';

export function getRequestId(request: Request): string {
    return request.headers.get('x-request-id')?.trim() || ulid();
}

export function apiSuccess<T>(data: T, init: { status?: number; requestId?: string } = {}): NextResponse {
    const headers = init.requestId ? { 'x-request-id': init.requestId } : undefined;
    return NextResponse.json({ data }, { status: init.status ?? 200, headers });
}

export function apiNoContent(init: { requestId?: string } = {}): NextResponse {
    return new NextResponse(null, {
        status: 204,
        headers: init.requestId ? { 'x-request-id': init.requestId } : undefined,
    });
}

export function apiErrorResponse(
    request: Request,
    error: unknown,
    fallbackMessage = 'Internal server error'
): NextResponse {
    const requestId = getRequestId(request);
    const normalized = isApiError(error)
        ? error
        : internalError(error instanceof Error ? error.message : fallbackMessage);

    return NextResponse.json(
        {
            error: {
                code: normalized.code,
                message: normalized.message,
                details: normalized.details,
                requestId,
            },
        },
        {
            status: normalized.status,
            headers: { 'x-request-id': requestId },
        }
    );
}

export async function parseJsonBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
    let payload: unknown;

    try {
        payload = await request.json();
    } catch {
        throw badRequest('Invalid JSON request body');
    }

    const result = schema.safeParse(payload);

    if (!result.success) {
        throw validationFailed('Validation failed', formatZodFieldErrors(result.error));
    }

    return result.data;
}

export function parseSearchParams<T>(searchParams: URLSearchParams, schema: ZodType<T>): T {
    const raw = Object.fromEntries(searchParams.entries());
    const result = schema.safeParse(raw);

    if (!result.success) {
        throw badRequest('Invalid query parameters', formatZodFieldErrors(result.error));
    }

    return result.data;
}

export function formatZodFieldErrors(error: ZodError): Record<string, string[]> {
    return error.flatten().fieldErrors as Record<string, string[]>;
}

export function mapValidationError(code: string, message: string, details: unknown): ApiError {
    return new ApiError(422, code, message, details);
}
