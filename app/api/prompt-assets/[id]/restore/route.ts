import { parseJsonBody, promptAssetErrorResponse, promptAssetSuccess } from '../../../../lib/prompt-assets/http';
import { getPromptAssetService } from '../../../../lib/prompt-assets/service';
import { restorePromptAssetVersionSchema } from '../../../../lib/prompt-assets/validators';

export const runtime = 'nodejs';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await parseJsonBody(request, restorePromptAssetVersionSchema);
        const data = await getPromptAssetService().restorePromptAssetVersion(id, body);
        return promptAssetSuccess(data, 201);
    } catch (error) {
        return promptAssetErrorResponse(error);
    }
}
