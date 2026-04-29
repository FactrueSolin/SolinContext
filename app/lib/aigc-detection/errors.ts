import { ApiError } from '../api/errors';

export function aigcDetectionValidationFailed(message: string, details: unknown = null): ApiError {
    return new ApiError(422, 'AIGC_DETECTION_VALIDATION_FAILED', message, details);
}

export function aigcDetectionUnsupportedFileType(extension: string): ApiError {
    return new ApiError(
        415,
        'AIGC_DETECTION_UNSUPPORTED_FILE_TYPE',
        `Uploaded file type "${extension}" is not supported`
    );
}

export function aigcDetectionFileTooLarge(maxBytes: number): ApiError {
    return new ApiError(
        413,
        'AIGC_DETECTION_FILE_TOO_LARGE',
        `Uploaded file exceeds the ${maxBytes} byte limit`
    );
}

export function aigcDetectionTaskNotFound(taskId: string): ApiError {
    return new ApiError(404, 'AIGC_DETECTION_TASK_NOT_FOUND', `AIGC detection task "${taskId}" was not found`);
}

export function aigcDetectionTaskNotCompleted(): ApiError {
    return new ApiError(409, 'AIGC_DETECTION_TASK_NOT_COMPLETED', 'AIGC detection task is not completed yet');
}

export function aigcDetectionTaskNotRetryable(): ApiError {
    return new ApiError(409, 'AIGC_DETECTION_TASK_NOT_RETRYABLE', 'AIGC detection task cannot be retried in its current state');
}

export function aigcDetectionStorageError(message: string, details: unknown = null): ApiError {
    return new ApiError(500, 'AIGC_DETECTION_STORAGE_ERROR', message, details);
}

export function aigcDetectionExternalSubmitFailed(message: string, details: unknown = null): ApiError {
    return new ApiError(502, 'AIGC_DETECTION_EXTERNAL_SUBMIT_FAILED', message, details);
}

export function aigcDetectionExternalSyncFailed(message: string, details: unknown = null): ApiError {
    return new ApiError(502, 'AIGC_DETECTION_EXTERNAL_SYNC_FAILED', message, details);
}
