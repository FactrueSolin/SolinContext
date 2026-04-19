import { NextRequest } from 'next/server';
import { apiErrorResponse, apiSuccess, parseJsonBody, parseSearchParams } from '../../../../../../lib/api/http';
import { resolvePrincipal, requirePermission } from '../../../../../../lib/auth/principal';
import { getPromptAssetService } from '../../../../../../lib/prompt-assets/service';
import {
    createPromptAssetVersionSchema,
    promptAssetVersionsQuerySchema,
} from '../../../../../../lib/prompt-assets/validators';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ workspaceSlug: string; id: string }> }
) {
    try {
        const { workspaceSlug, id } = await params;
        const principal = await resolvePrincipal(request, { workspaceSlug });
        requirePermission(principal, 'prompt_asset:read');
        const query = parseSearchParams(request.nextUrl.searchParams, promptAssetVersionsQuerySchema);
        const data = await getPromptAssetService().listPromptAssetVersions(principal, id, query);
        return apiSuccess(data);
    } catch (error) {
        return apiErrorResponse(request, error);
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ workspaceSlug: string; id: string }> }
) {
    try {
        const { workspaceSlug, id } = await params;
        const principal = await resolvePrincipal(request, { workspaceSlug });
        requirePermission(principal, 'prompt_asset:write');
        const body = await parseJsonBody(request, createPromptAssetVersionSchema);
        const data = await getPromptAssetService().createPromptAssetVersion(principal, id, body);
        return apiSuccess(data, { status: 201 });
    } catch (error) {
        return apiErrorResponse(request, error);
    }
}
