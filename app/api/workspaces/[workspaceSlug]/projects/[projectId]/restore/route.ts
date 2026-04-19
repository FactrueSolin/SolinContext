import { apiErrorResponse, apiSuccess, parseJsonBody } from '../../../../../../lib/api/http';
import { resolvePrincipal, requirePermission } from '../../../../../../lib/auth/principal';
import { getProjectService } from '../../../../../../lib/projects/service';
import { restoreProjectSchema } from '../../../../../../lib/projects/validators';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ workspaceSlug: string; projectId: string }> }
) {
    try {
        const { workspaceSlug, projectId } = await params;
        const principal = await resolvePrincipal(request, { workspaceSlug });
        requirePermission(principal, 'project:write');
        const body = await parseJsonBody(request, restoreProjectSchema);
        const data = getProjectService().restoreRevision(principal, projectId, body);
        return apiSuccess(data);
    } catch (error) {
        return apiErrorResponse(request, error);
    }
}
