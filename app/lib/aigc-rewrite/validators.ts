import { z } from 'zod';
import { badRequest } from '../api/errors';
import { formatZodFieldErrors, mapValidationError } from '../api/http';

const aigcRewriteGenerateSchema = z.object({
    sampleBefore: z.string().trim().min(1).max(12000),
    sampleAfter: z.string().trim().min(1).max(12000),
    targetText: z.string().trim().min(1).max(20000),
}).strict().superRefine((value, context) => {
    if (value.sampleBefore === value.sampleAfter) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['sampleAfter'],
            message: 'Sample texts must be different',
        });
    }
});

export type AigcRewriteGenerateInput = z.infer<typeof aigcRewriteGenerateSchema>;

export async function parseAigcRewriteGenerateRequest(
    request: Request
): Promise<AigcRewriteGenerateInput> {
    let payload: unknown;

    try {
        payload = await request.json();
    } catch {
        throw badRequest('Invalid JSON request body');
    }

    const result = aigcRewriteGenerateSchema.safeParse(payload);

    if (!result.success) {
        throw mapValidationError(
            'AIGC_REWRITE_VALIDATION_FAILED',
            'Request body is invalid',
            formatZodFieldErrors(result.error)
        );
    }

    return result.data;
}
