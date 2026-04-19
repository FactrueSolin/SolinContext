import { apiErrorResponse, apiSuccess, parseJsonBody, parseSearchParams } from '../../../../lib/api/http';
import { resolvePrincipal, requirePermission } from '../../../../lib/auth/principal';
import { getProjectService } from '../../../../lib/projects/service';
import {
    createProjectSchema,
    listProjectsQuerySchema,
} from '../../../../lib/projects/validators';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ workspaceSlug: string }> }
) {
    try {
        const { workspaceSlug } = await params;
        const principal = await resolvePrincipal(request, { workspaceSlug });
        requirePermission(principal, 'project:read');
        const query = parseSearchParams(request.url ? new URL(request.url).searchParams : new URLSearchParams(), listProjectsQuerySchema);
        const data = getProjectService().listProjects(principal, query);
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
        requirePermission(principal, 'project:write');
        const body = await parseJsonBody(request, createProjectSchema);
        const data = getProjectService().createProject(principal, body);
        return apiSuccess(data, { status: 201 });
    } catch (error) {
        return apiErrorResponse(request, error);
    }
}
