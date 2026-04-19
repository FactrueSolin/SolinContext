import { z } from 'zod';
import { apiErrorResponse, parseJsonBody } from '../../../lib/api/http';
import { resolvePrincipal, requirePermission } from '../../../lib/auth/principal';
import { getProjectService } from '../../../lib/projects/service';

const legacyApiConfigSchema = z.object({
    baseUrl: z.string(),
    apiKey: z.string(),
    model: z.string(),
    temperature: z.number().optional(),
    topP: z.number().optional(),
    topK: z.number().optional(),
    maxTokens: z.number().optional(),
    stopSequences: z.array(z.string()).optional(),
    stream: z.boolean().optional(),
    thinking: z.boolean().optional(),
    thinkingBudget: z.number().optional(),
    compareModel: z
        .object({
            baseUrl: z.string(),
            apiKey: z.string(),
            model: z.string(),
        })
        .optional(),
});

const legacyProjectSchema = z.object({
    meta: z.object({
        id: z.string().trim().min(1),
        name: z.string().trim().min(1).max(120),
        createdAt: z.string(),
        updatedAt: z.string(),
    }),
    systemPrompt: z.string(),
    messages: z.array(z.unknown()),
    apiConfig: legacyApiConfigSchema,
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const principal = await resolvePrincipal(request);
        requirePermission(principal, 'project:read');
        return Response.json(getProjectService().getLegacyProject(principal, id));
    } catch (error) {
        return apiErrorResponse(request, error);
    }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const principal = await resolvePrincipal(request);
        requirePermission(principal, 'project:write');
        const body = await parseJsonBody(request, legacyProjectSchema);
        const data = getProjectService().updateLegacyProject(principal, id, {
            ...body,
            meta: {
                ...body.meta,
                id,
            },
        });

        return Response.json(data.meta);
    } catch (error) {
        return apiErrorResponse(request, error);
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const principal = await resolvePrincipal(request);
        requirePermission(principal, 'project:delete');
        getProjectService().deleteProject(principal, id);
        return Response.json({ success: true });
    } catch (error) {
        return apiErrorResponse(request, error);
    }
}
