import { apiErrorResponse, getRequestId } from '../../../../../lib/api/http';
import { resolvePrincipal, requirePermission } from '../../../../../lib/auth/principal';
import { getAigcRewriteService } from '../../../../../lib/aigc-rewrite/service';
import { parseAigcRewriteGenerateRequest } from '../../../../../lib/aigc-rewrite/validators';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ workspaceSlug: string }> }
) {
    try {
        const { workspaceSlug } = await params;
        const principal = await resolvePrincipal(request, { workspaceSlug });
        requirePermission(principal, 'credential:use');
        const body = await parseAigcRewriteGenerateRequest(request);
        const requestId = getRequestId(request);

        return await getAigcRewriteService().generate(principal, body, {
            requestId,
            requestSignal: request.signal,
        });
    } catch (error) {
        return apiErrorResponse(request, error);
    }
}
