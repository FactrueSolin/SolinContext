import { NextRequest } from 'next/server';
import { apiErrorResponse, apiSuccess, parseJsonBody, parseSearchParams } from '../../../../lib/api/http';
import { resolvePrincipal, requirePermission } from '../../../../lib/auth/principal';
import { getPromptAssetService } from '../../../../lib/prompt-assets/service';
import { createPromptAssetSchema, listPromptAssetsQuerySchema } from '../../../../lib/prompt-assets/validators';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ workspaceSlug: string }> }
) {
    try {
        const { workspaceSlug } = await params;
        const principal = await resolvePrincipal(request, { workspaceSlug });
        requirePermission(principal, 'prompt_asset:read');
        const query = parseSearchParams(request.nextUrl.searchParams, listPromptAssetsQuerySchema);
        const data = await getPromptAssetService().listPromptAssets(principal, query);
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
        requirePermission(principal, 'prompt_asset:write');
        const body = await parseJsonBody(request, createPromptAssetSchema);
        const data = await getPromptAssetService().createPromptAsset(principal, body);
        return apiSuccess(data, { status: 201 });
    } catch (error) {
        return apiErrorResponse(request, error);
    }
}
