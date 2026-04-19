import { resourceConflict, resourceNotFound } from '../api/errors';

export function projectNotFound(projectId: string) {
    return resourceNotFound(`Project "${projectId}" not found`, 'PROJECT_NOT_FOUND');
}

export function projectRevisionNotFound(revisionId: string) {
    return resourceNotFound(`Project revision "${revisionId}" not found`, 'PROJECT_REVISION_NOT_FOUND');
}

export function projectVersionConflict(expectedRevisionId: string | null, actualRevisionId: string | null) {
    return resourceConflict(
        'Project version conflict',
        {
            expectedRevisionId,
            actualRevisionId,
        },
        'PROJECT_VERSION_CONFLICT'
    );
}
