import { apiErrorResponse, apiSuccess, parseSearchParams } from '../../../../../lib/api/http';
import { requirePermission, resolvePrincipal } from '../../../../../lib/auth/principal';
import { getAigcDetectionService } from '../../../../../lib/aigc-detection/service';
import { aigcDetectionValidationFailed } from '../../../../../lib/aigc-detection/errors';
import { listAigcDetectionTasksQuerySchema } from '../../../../../lib/aigc-detection/validators';

export const runtime = 'nodejs';

function parseBooleanFormValue(value: FormDataEntryValue | null): boolean {
    if (value === null || value === '') {
        return false;
    }

    if (typeof value !== 'string') {
        throw aigcDetectionValidationFailed('forceReprocess must be a boolean value');
    }

    if (value === 'true') {
        return true;
    }

    if (value === 'false') {
        return false;
    }

    throw aigcDetectionValidationFailed('forceReprocess must be "true" or "false"');
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ workspaceSlug: string }> }
) {
    try {
        const { workspaceSlug } = await params;
        const principal = await resolvePrincipal(request, { workspaceSlug });
        requirePermission(principal, 'aigc_detection:read');
        const query = parseSearchParams(
            request.url ? new URL(request.url).searchParams : new URLSearchParams(),
            listAigcDetectionTasksQuerySchema
        );
        const data = getAigcDetectionService().listTasks(principal, query);
        return apiSuccess(data);
    } catch (error) {
        return apiErrorResponse(request, error);
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ workspaceSlug: string }> }
) {
    try {
        const { workspaceSlug } = await params;
        const principal = await resolvePrincipal(request, { workspaceSlug });
        requirePermission(principal, 'aigc_detection:write');
        const formData = await request.formData();
        const file = formData.get('file');

        if (!(file instanceof File)) {
            throw aigcDetectionValidationFailed('Uploaded file is required', {
                file: ['File is required'],
            });
        }

        const forceReprocess = parseBooleanFormValue(formData.get('forceReprocess'));
        const data = await getAigcDetectionService().createTask(principal, {
            file,
            forceReprocess,
        });
        return apiSuccess(data, { status: 201 });
    } catch (error) {
        return apiErrorResponse(request, error);
    }
}
