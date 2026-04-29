import { apiErrorResponse, apiSuccess } from '../../../../../../../lib/api/http';
import { requirePermission, resolvePrincipal } from '../../../../../../../lib/auth/principal';
import { getAigcDetectionService } from '../../../../../../../lib/aigc-detection/service';

export const runtime = 'nodejs';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ workspaceSlug: string; taskId: string }> }
) {
    try {
        const { workspaceSlug, taskId } = await params;
        const principal = await resolvePrincipal(request, { workspaceSlug });
        requirePermission(principal, 'aigc_detection:write');
        const data = await getAigcDetectionService().retryTask(principal, taskId);
        return apiSuccess({ task: data });
    } catch (error) {
        return apiErrorResponse(request, error);
    }
}
