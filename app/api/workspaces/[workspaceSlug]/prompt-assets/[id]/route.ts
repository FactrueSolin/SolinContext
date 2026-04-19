import { apiErrorResponse, apiSuccess } from '../../../../../lib/api/http';
import { resolvePrincipal, requirePermission } from '../../../../../lib/auth/principal';
import { getPromptAssetService } from '../../../../../lib/prompt-assets/service';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ workspaceSlug: string; id: string }> }
) {
    try {
        const { workspaceSlug, id } = await params;
        const principal = await resolvePrincipal(request, { workspaceSlug });
        requirePermission(principal, 'prompt_asset:read');
        const data = await getPromptAssetService().getPromptAssetDetail(principal, id);
        return apiSuccess(data);
    } catch (error) {
        return apiErrorResponse(request, error);
    }
}
