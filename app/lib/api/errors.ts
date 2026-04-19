export interface ApiErrorShape {
    status: number;
    code: string;
    message: string;
    details: unknown;
}

export class ApiError extends Error implements ApiErrorShape {
    readonly status: number;
    readonly code: string;
    readonly details: unknown;

    constructor(status: number, code: string, message: string, details: unknown = null) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

export function isApiError(error: unknown): error is ApiError {
    return error instanceof ApiError;
}

export function badRequest(message = 'Bad request', details: unknown = null): ApiError {
    return new ApiError(400, 'BAD_REQUEST', message, details);
}

export function unauthenticated(message = 'Authentication required'): ApiError {
    return new ApiError(401, 'UNAUTHENTICATED', message);
}

export function workspaceForbidden(message = 'You do not have access to this workspace'): ApiError {
    return new ApiError(403, 'WORKSPACE_FORBIDDEN', message);
}

export function permissionDenied(message = 'You do not have permission to perform this action'): ApiError {
    return new ApiError(403, 'PERMISSION_DENIED', message);
}

export function resourceNotFound(message = 'Resource not found', code = 'RESOURCE_NOT_FOUND'): ApiError {
    return new ApiError(404, code, message);
}

export function resourceConflict(
    message = 'Resource conflict',
    details: unknown = null,
    code = 'RESOURCE_CONFLICT'
): ApiError {
    return new ApiError(409, code, message, details);
}

export function validationFailed(message = 'Validation failed', details: unknown = null): ApiError {
    return new ApiError(422, 'VALIDATION_FAILED', message, details);
}

export function internalError(message = 'Internal server error'): ApiError {
    return new ApiError(500, 'INTERNAL_ERROR', message);
}
