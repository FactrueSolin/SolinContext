import { apiErrorResponse, apiSuccess } from '../../lib/api/http';
import { getCurrentUserSummary } from '../../lib/auth/principal';

export async function GET(request: Request) {
    try {
        const data = await getCurrentUserSummary(request);
        return apiSuccess(data);
    } catch (error) {
        return apiErrorResponse(request, error);
    }
}
