import { apiErrorResponse, apiSuccess } from '../../../../../lib/api/http';
import { resolvePrincipal, requirePermission } from '../../../../../lib/auth/principal';
import { getPromptAssetService } from '../../../../../lib/prompt-assets/service';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string; versionId: string }> }
) {
    try {
        const { id, versionId } = await params;
        const principal = await resolvePrincipal(request);
        requirePermission(principal, 'prompt_asset:read');
        const data = await getPromptAssetService().getPromptAssetVersion(principal, id, versionId);
        return apiSuccess(data);
    } catch (error) {
        return apiErrorResponse(request, error);
    }
}
