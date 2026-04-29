import { z } from 'zod';
import { aigcDetectionTaskStatuses } from '../db/schema/aigc-detection';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

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

export const aigcDetectionTaskStatusFilterSchema = z.enum(aigcDetectionTaskStatuses);

export const listAigcDetectionTasksQuerySchema = z.object({
    page: defaultedInt(DEFAULT_PAGE, Number.MAX_SAFE_INTEGER),
    pageSize: defaultedInt(DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
    status: z.union([z.literal('all'), aigcDetectionTaskStatusFilterSchema]).default('all'),
    keyword: trimmedOptionalString,
    createdBy: trimmedOptionalString,
});

export const retryAigcDetectionTaskParamsSchema = z.object({
    taskId: z.string().trim().min(1).max(64),
});

export type ListAigcDetectionTasksQuery = z.infer<typeof listAigcDetectionTasksQuerySchema>;
