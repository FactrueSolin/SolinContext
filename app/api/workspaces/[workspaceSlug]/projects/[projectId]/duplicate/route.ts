import { apiErrorResponse, apiSuccess } from '../../../../../../lib/api/http';
import { resolvePrincipal, requirePermission } from '../../../../../../lib/auth/principal';
import { getProjectService } from '../../../../../../lib/projects/service';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ workspaceSlug: string; projectId: string }> }
) {
    try {
        const { workspaceSlug, projectId } = await params;
        const principal = await resolvePrincipal(request, { workspaceSlug });
        requirePermission(principal, 'project:write');
        const data = getProjectService().duplicateProject(principal, projectId);
        return apiSuccess(data.meta, { status: 201 });
    } catch (error) {
        return apiErrorResponse(request, error);
    }
}
