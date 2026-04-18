import { z } from 'zod';

const MAX_NAME_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_CONTENT_LENGTH = 50000;
const MAX_CHANGE_NOTE_LENGTH = 200;
const MAX_QUERY_LENGTH = 50;
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

function optionalTrimmedString(maxLength: number) {
    return z
        .preprocess(
            (value) => (typeof value === 'string' ? value.trim() : value),
            z.string().max(maxLength).optional()
        )
        .transform((value) => (value && value.length > 0 ? value : undefined));
}

function defaultedPaginationField(defaultValue: number, maxValue: number) {
    return z.preprocess(
        (value) => {
            if (value === undefined || value === '') {
                return defaultValue;
            }

            return Number(value);
        },
        z.number().int().min(1).max(maxValue)
    );
}

const contentSchema = z
    .string()
    .max(MAX_CONTENT_LENGTH)
    .superRefine((value, context) => {
        if (value.trim().length === 0) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Content is required',
            });
        }
    });

export const listPromptAssetsQuerySchema = z.object({
    query: optionalTrimmedString(MAX_QUERY_LENGTH),
    status: z.enum(['active', 'archived', 'all']).default('active'),
    page: defaultedPaginationField(DEFAULT_PAGE, Number.MAX_SAFE_INTEGER),
    pageSize: defaultedPaginationField(DEFAULT_PAGE_SIZE, 50),
});

export const promptAssetVersionsQuerySchema = z.object({
    page: defaultedPaginationField(DEFAULT_PAGE, Number.MAX_SAFE_INTEGER),
    pageSize: defaultedPaginationField(DEFAULT_PAGE_SIZE, 50),
});

export const createPromptAssetSchema = z.object({
    name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
    description: z.string().max(MAX_DESCRIPTION_LENGTH).optional().default(''),
    content: contentSchema,
    changeNote: z.string().trim().max(MAX_CHANGE_NOTE_LENGTH).optional(),
});

export const createPromptAssetVersionSchema = z.object({
    name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
    description: z.string().max(MAX_DESCRIPTION_LENGTH).optional().default(''),
    content: contentSchema,
    changeNote: z.string().trim().max(MAX_CHANGE_NOTE_LENGTH).optional(),
    expectedVersionNumber: z.coerce.number().int().min(1),
});

export const restorePromptAssetVersionSchema = z.object({
    versionId: z.string().trim().min(1).max(64),
    changeNote: z.string().trim().max(MAX_CHANGE_NOTE_LENGTH).optional(),
    expectedVersionNumber: z.coerce.number().int().min(1),
});

export type ListPromptAssetsQuery = z.infer<typeof listPromptAssetsQuerySchema>;
export type PromptAssetVersionsQuery = z.infer<typeof promptAssetVersionsQuerySchema>;
export type CreatePromptAssetInput = z.infer<typeof createPromptAssetSchema>;
export type CreatePromptAssetVersionInput = z.infer<typeof createPromptAssetVersionSchema>;
export type RestorePromptAssetVersionInput = z.infer<typeof restorePromptAssetVersionSchema>;
