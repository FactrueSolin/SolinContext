import { z } from 'zod';
import { apiErrorResponse, parseJsonBody } from '../../lib/api/http';
import { resolvePrincipal, requirePermission } from '../../lib/auth/principal';
import { getProjectService } from '../../lib/projects/service';
import { createDefaultApiConfig } from '../../lib/utils';

const legacyCreateProjectSchema = z.object({
    name: z.string().trim().min(1).max(120),
    apiConfig: z
        .object({
            baseUrl: z.string().trim().min(1),
            apiKey: z.string(),
            model: z.string().trim().min(1),
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
        })
        .optional(),
});

export async function GET(request: Request) {
    try {
        const principal = await resolvePrincipal(request);
        requirePermission(principal, 'project:read');
        const result = getProjectService().listProjects(principal, {
            query: undefined,
            page: 1,
            pageSize: 100,
            sortBy: 'updatedAt',
            sortOrder: 'desc',
        });

        return Response.json(
            result.items.map((item) => ({
                id: item.id,
                name: item.name,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
            }))
        );
    } catch (error) {
        return apiErrorResponse(request, error);
    }
}

export async function POST(request: Request) {
    try {
        const principal = await resolvePrincipal(request);
        requirePermission(principal, 'project:write');
        const body = await parseJsonBody(request, legacyCreateProjectSchema);
        const data = getProjectService().createLegacyProject(principal, {
            name: body.name,
            systemPrompt: 'You are a helpful assistant.',
            messages: [
                {
                    id: 'legacy-user-message',
                    role: 'user',
                    content: [{ type: 'text', text: 'Hello, how can you help me?' }],
                },
                {
                    id: 'legacy-assistant-message',
                    role: 'assistant',
                    content: [
                        {
                            type: 'text',
                            text: "Hello! I'm a helpful assistant. I can help you with various tasks. How can I assist you today?",
                        },
                    ],
                },
            ],
            apiConfig: body.apiConfig ?? createDefaultApiConfig(),
        });

        return Response.json(data, { status: 201 });
    } catch (error) {
        return apiErrorResponse(request, error);
    }
}
