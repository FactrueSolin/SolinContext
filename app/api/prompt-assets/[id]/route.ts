import { promptAssetErrorResponse, promptAssetSuccess } from '../../../lib/prompt-assets/http';
import { getPromptAssetService } from '../../../lib/prompt-assets/service';

export const runtime = 'nodejs';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const data = await getPromptAssetService().getPromptAssetDetail(id);
        return promptAssetSuccess(data);
    } catch (error) {
        return promptAssetErrorResponse(error);
    }
}
