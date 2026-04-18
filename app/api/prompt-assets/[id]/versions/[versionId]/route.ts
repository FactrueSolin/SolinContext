import { promptAssetErrorResponse, promptAssetSuccess } from '../../../../../lib/prompt-assets/http';
import { getPromptAssetService } from '../../../../../lib/prompt-assets/service';

export const runtime = 'nodejs';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string; versionId: string }> }
) {
    try {
        const { id, versionId } = await params;
        const data = await getPromptAssetService().getPromptAssetVersion(id, versionId);
        return promptAssetSuccess(data);
    } catch (error) {
        return promptAssetErrorResponse(error);
    }
}
