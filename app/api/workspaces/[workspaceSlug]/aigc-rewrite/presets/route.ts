import { apiSuccess, apiErrorResponse, getRequestId } from '../../../../../lib/api/http';
import { resolvePrincipal } from '../../../../../lib/auth/principal';
import { listAigcRewritePresetSummaries } from '../../../../../lib/aigc-rewrite/presets';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ workspaceSlug: string }> }
) {
    try {
        const { workspaceSlug } = await params;
        await resolvePrincipal(request, { workspaceSlug });
        const requestId = getRequestId(request);

        return apiSuccess(listAigcRewritePresetSummaries(), { requestId });
    } catch (error) {
        return apiErrorResponse(request, error);
    }
}
