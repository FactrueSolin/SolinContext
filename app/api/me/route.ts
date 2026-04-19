import { apiErrorResponse, apiSuccess } from '../../lib/api/http';
import { getCurrentUserSummary } from '../../lib/auth/principal';

export async function GET(request: Request) {
    try {
        const workspaceSlug = request.url
            ? new URL(request.url).searchParams.get('workspaceSlug')?.trim() || undefined
            : undefined;
        const data = await getCurrentUserSummary(request, { workspaceSlug });
        return apiSuccess(data);
    } catch (error) {
        return apiErrorResponse(request, error);
    }
}
