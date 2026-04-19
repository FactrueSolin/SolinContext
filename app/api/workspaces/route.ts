import { apiErrorResponse, apiSuccess } from '../../lib/api/http';
import { listAccessibleWorkspaces } from '../../lib/auth/principal';

export async function GET(request: Request) {
    try {
        const data = await listAccessibleWorkspaces(request);
        return apiSuccess(data);
    } catch (error) {
        return apiErrorResponse(request, error);
    }
}
