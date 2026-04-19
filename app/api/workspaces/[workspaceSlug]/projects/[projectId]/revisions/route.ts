import { apiErrorResponse, apiSuccess } from '../../../../../../lib/api/http';
import { resolvePrincipal, requirePermission } from '../../../../../../lib/auth/principal';
import { getProjectService } from '../../../../../../lib/projects/service';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ workspaceSlug: string; projectId: string }> }
) {
    try {
        const { workspaceSlug, projectId } = await params;
        const principal = await resolvePrincipal(request, { workspaceSlug });
        requirePermission(principal, 'project:read');
        const data = getProjectService().listRevisions(principal, projectId);
        return apiSuccess(data);
    } catch (error) {
        return apiErrorResponse(request, error);
    }
}
