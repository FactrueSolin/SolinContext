import { type NextRequest } from 'next/server';
import { promptAssetErrorResponse, promptAssetSuccess, parseJsonBody, parseSearchParams } from '../../lib/prompt-assets/http';
import { getPromptAssetService } from '../../lib/prompt-assets/service';
import { createPromptAssetSchema, listPromptAssetsQuerySchema } from '../../lib/prompt-assets/validators';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
    try {
        const query = parseSearchParams(request.nextUrl.searchParams, listPromptAssetsQuerySchema);
        const data = await getPromptAssetService().listPromptAssets(query);
        return promptAssetSuccess(data);
    } catch (error) {
        return promptAssetErrorResponse(error);
    }
}

export async function POST(request: Request) {
    try {
        const body = await parseJsonBody(request, createPromptAssetSchema);
        const data = await getPromptAssetService().createPromptAsset(body);
        return promptAssetSuccess(data, 201);
    } catch (error) {
        return promptAssetErrorResponse(error);
    }
}
