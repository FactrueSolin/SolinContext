import { z } from 'zod';
import { badRequest } from '../api/errors';
import { formatZodFieldErrors, mapValidationError } from '../api/http';

const aigcRewriteGenerateSchema = z.object({
    sampleBefore: z.string().trim().max(12000).optional(),
    sampleAfter: z.string().trim().max(12000).optional(),
    presetId: z.string().trim().min(1).max(120).optional(),
    targetText: z.string().trim().min(1).max(20000),
}).strict().superRefine((value, context) => {
    const hasPreset = Boolean(value.presetId);
    const hasSampleBefore = Boolean(value.sampleBefore);
    const hasSampleAfter = Boolean(value.sampleAfter);

    if (hasPreset && (hasSampleBefore || hasSampleAfter)) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['presetId'],
            message: 'Preset mode cannot be mixed with manual sample texts',
        });
        return;
    }

    if (!hasPreset && !hasSampleBefore) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['sampleBefore'],
            message: 'Sample before text is required when presetId is absent',
        });
    }

    if (!hasPreset && !hasSampleAfter) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['sampleAfter'],
            message: 'Sample after text is required when presetId is absent',
        });
    }

    if (hasPreset || !hasSampleBefore || !hasSampleAfter) {
        return;
    }

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
