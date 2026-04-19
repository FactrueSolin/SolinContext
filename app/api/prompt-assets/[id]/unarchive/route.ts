import { apiErrorResponse, apiSuccess } from '../../../../lib/api/http';
import { resolvePrincipal, requirePermission } from '../../../../lib/auth/principal';
import { getPromptAssetService } from '../../../../lib/prompt-assets/service';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const principal = await resolvePrincipal(request);
        requirePermission(principal, 'prompt_asset:archive');
        const data = await getPromptAssetService().unarchivePromptAsset(principal, id);
        return apiSuccess(data);
    } catch (error) {
        return apiErrorResponse(request, error);
    }
}
