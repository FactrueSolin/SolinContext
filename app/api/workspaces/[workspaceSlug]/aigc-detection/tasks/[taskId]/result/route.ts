import { apiErrorResponse, apiSuccess } from '../../../../../../../lib/api/http';
import { requirePermission, resolvePrincipal } from '../../../../../../../lib/auth/principal';
import { getAigcDetectionService } from '../../../../../../../lib/aigc-detection/service';

export const runtime = 'nodejs';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ workspaceSlug: string; taskId: string }> }
) {
    try {
        const { workspaceSlug, taskId } = await params;
        const principal = await resolvePrincipal(request, { workspaceSlug });
        requirePermission(principal, 'aigc_detection:read');
        const data = await getAigcDetectionService().getTaskResult(principal, taskId);
        return apiSuccess(data);
    } catch (error) {
        return apiErrorResponse(request, error);
    }
}
