import { apiErrorResponse, apiNoContent, apiSuccess, parseJsonBody } from '../../../../../lib/api/http';
import { resolvePrincipal, requirePermission } from '../../../../../lib/auth/principal';
import { getProjectService } from '../../../../../lib/projects/service';
import { updateProjectSchema } from '../../../../../lib/projects/validators';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ workspaceSlug: string; projectId: string }> }
) {
    try {
        const { workspaceSlug, projectId } = await params;
        const principal = await resolvePrincipal(request, { workspaceSlug });
        requirePermission(principal, 'project:read');
        const data = getProjectService().getProjectDetail(principal, projectId);
        return apiSuccess(data);
    } catch (error) {
        return apiErrorResponse(request, error);
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ workspaceSlug: string; projectId: string }> }
) {
    try {
        const { workspaceSlug, projectId } = await params;
        const principal = await resolvePrincipal(request, { workspaceSlug });
        requirePermission(principal, 'project:write');
        const body = await parseJsonBody(request, updateProjectSchema);
        const data = getProjectService().updateProject(principal, projectId, body);
        return apiSuccess(data);
    } catch (error) {
        return apiErrorResponse(request, error);
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ workspaceSlug: string; projectId: string }> }
) {
    try {
        const { workspaceSlug, projectId } = await params;
        const principal = await resolvePrincipal(request, { workspaceSlug });
        requirePermission(principal, 'project:delete');
        getProjectService().deleteProject(principal, projectId);
        return apiNoContent();
    } catch (error) {
        return apiErrorResponse(request, error);
    }
}
