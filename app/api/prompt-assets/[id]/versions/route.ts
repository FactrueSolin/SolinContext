import { type NextRequest } from 'next/server';
import {
    parseJsonBody,
    parseSearchParams,
    promptAssetErrorResponse,
    promptAssetSuccess,
} from '../../../../lib/prompt-assets/http';
import { getPromptAssetService } from '../../../../lib/prompt-assets/service';
import {
    createPromptAssetVersionSchema,
    promptAssetVersionsQuerySchema,
} from '../../../../lib/prompt-assets/validators';

export const runtime = 'nodejs';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const query = parseSearchParams(request.nextUrl.searchParams, promptAssetVersionsQuerySchema);
        const data = await getPromptAssetService().listPromptAssetVersions(id, query);
        return promptAssetSuccess(data);
    } catch (error) {
        return promptAssetErrorResponse(error);
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await parseJsonBody(request, createPromptAssetVersionSchema);
        const data = await getPromptAssetService().createPromptAssetVersion(id, body);
        return promptAssetSuccess(data, 201);
    } catch (error) {
        return promptAssetErrorResponse(error);
    }
}
