import { apiErrorResponse, apiSuccess, parseJsonBody } from '../../../../lib/api/http';
import { resolvePrincipal, requirePermission } from '../../../../lib/auth/principal';
import { getPromptAssetService } from '../../../../lib/prompt-assets/service';
import { restorePromptAssetVersionSchema } from '../../../../lib/prompt-assets/validators';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const principal = await resolvePrincipal(request);
        requirePermission(principal, 'prompt_asset:write');
        const body = await parseJsonBody(request, restorePromptAssetVersionSchema);
        const data = await getPromptAssetService().restorePromptAssetVersion(principal, id, body);
        return apiSuccess(data);
    } catch (error) {
        return apiErrorResponse(request, error);
    }
}
