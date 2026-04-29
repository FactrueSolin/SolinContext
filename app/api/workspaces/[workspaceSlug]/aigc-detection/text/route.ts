import { apiErrorResponse, apiSuccess, parseJsonBody } from '../../../../../lib/api/http';
import { requirePermission, resolvePrincipal } from '../../../../../lib/auth/principal';
import { getAigcDetectionService } from '../../../../../lib/aigc-detection/service';
import { detectAigcTextBodySchema } from '../../../../../lib/aigc-detection/validators';

export const runtime = 'nodejs';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ workspaceSlug: string }> }
) {
    try {
        const { workspaceSlug } = await params;
        const principal = await resolvePrincipal(request, { workspaceSlug });
        requirePermission(principal, 'aigc_detection:write');
        const input = await parseJsonBody(request, detectAigcTextBodySchema);
        const data = await getAigcDetectionService().detectText(principal, input);
        return apiSuccess(data);
    } catch (error) {
        return apiErrorResponse(request, error);
    }
}
