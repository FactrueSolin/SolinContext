import { promptAssetErrorResponse, promptAssetSuccess } from '../../../../lib/prompt-assets/http';
import { getPromptAssetService } from '../../../../lib/prompt-assets/service';

export const runtime = 'nodejs';

export async function POST(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const data = await getPromptAssetService().archivePromptAsset(id);
        return promptAssetSuccess(data);
    } catch (error) {
        return promptAssetErrorResponse(error);
    }
}
