import { NextResponse } from 'next/server';
import type { GenerateRequest } from '../../types';
import { requestGenerateUpstream, createGenerateStreamResponse, parseGenerateResponse, readGenerateUpstreamError } from '../../lib/ai/generate';
import { getServerAiModelConfig } from '../../lib/ai/runtime';

export async function POST(request: Request) {
    try {
        const body = await request.json() as GenerateRequest;
        const { stream, targetModel = 'primary' } = body;
        const modelConfig = getServerAiModelConfig(targetModel);

        const response = await requestGenerateUpstream(modelConfig, body);

        if (!response.ok) {
            const errorText = await readGenerateUpstreamError(response);
            return NextResponse.json(
                { error: `API request failed: ${response.status} ${errorText}` },
                { status: response.status }
            );
        }

        if (stream) {
            return createGenerateStreamResponse(response);
        }

        return NextResponse.json(await parseGenerateResponse(response));
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
