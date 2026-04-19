import { apiErrorResponse } from '../../../../lib/api/http';
import { resolvePrincipal, requirePermission } from '../../../../lib/auth/principal';
import { getProjectService } from '../../../../lib/projects/service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const principal = await resolvePrincipal(request);
        requirePermission(principal, 'project:write');
        const data = getProjectService().duplicateProject(principal, id);
        return Response.json(data.meta);
    } catch (error) {
        return apiErrorResponse(request, error);
    }
}
