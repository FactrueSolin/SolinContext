import { apiErrorResponse } from '../../../../../lib/api/http';
import { resolvePrincipal, requirePermission } from '../../../../../lib/auth/principal';
import { getProjectService } from '../../../../../lib/projects/service';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string; filename: string }> }
) {
    try {
        const { id, filename } = await params;
        const principal = await resolvePrincipal(request);
        requirePermission(principal, 'project:read');
        return Response.json(getProjectService().getRevisionByCompatFilename(principal, id, filename));
    } catch (error) {
        return apiErrorResponse(request, error);
    }
}
