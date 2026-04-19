import { apiErrorResponse } from '../../../../lib/api/http';
import { resolvePrincipal, requirePermission } from '../../../../lib/auth/principal';
import { getProjectService } from '../../../../lib/projects/service';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const principal = await resolvePrincipal(request);
        requirePermission(principal, 'project:read');
        return Response.json(getProjectService().listCompatHistory(principal, id));
    } catch (error) {
        return apiErrorResponse(request, error);
    }
}
