import { z } from 'zod';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

function defaultedInt(defaultValue: number, max: number) {
    return z.preprocess(
        (value) => {
            if (value === undefined || value === '') {
                return defaultValue;
            }

            return Number(value);
        },
        z.number().int().min(1).max(max)
    );
}

const trimmedOptionalString = z
    .preprocess((value) => (typeof value === 'string' ? value.trim() : value), z.string().optional())
    .transform((value) => (value && value.length > 0 ? value : undefined));

export const listProjectsQuerySchema = z.object({
    query: trimmedOptionalString,
    page: defaultedInt(DEFAULT_PAGE, Number.MAX_SAFE_INTEGER),
    pageSize: defaultedInt(DEFAULT_PAGE_SIZE, 100),
    sortBy: z.enum(['updatedAt', 'createdAt', 'name']).default('updatedAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const createProjectSchema = z.object({
    name: z.string().trim().min(1).max(120),
    systemPrompt: z.string().trim().optional().default('You are a helpful assistant.'),
    defaultCredentialId: z.string().trim().min(1).max(64).optional(),
});

export const updateProjectSchema = z.object({
    name: z.string().trim().min(1).max(120).optional(),
    systemPrompt: z.string().trim().optional(),
    defaultCredentialId: z.string().trim().min(1).max(64).nullable().optional(),
    expectedRevisionId: z.string().trim().min(1).max(64).nullable().optional(),
});

export const restoreProjectSchema = z.object({
    revisionId: z.string().trim().min(1).max(64),
    expectedRevisionId: z.string().trim().min(1).max(64).nullable().optional(),
});

export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type RestoreProjectInput = z.infer<typeof restoreProjectSchema>;
