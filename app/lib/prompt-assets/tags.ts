export const MAX_PROMPT_ASSET_TAGS = 10;
export const MAX_PROMPT_ASSET_TAG_LENGTH = 32;

function collapseWhitespace(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
}

export function normalizePromptAssetTag(tag: string): string {
    return collapseWhitespace(tag).toLocaleLowerCase();
}

export function sanitizePromptAssetTags(tags: string[]): string[] {
    const uniqueTags = new Map<string, string>();

    for (const tag of tags) {
        const displayTag = collapseWhitespace(tag);
        const normalizedTag = normalizePromptAssetTag(displayTag);

        if (!displayTag || !normalizedTag || uniqueTags.has(normalizedTag)) {
            continue;
        }

        uniqueTags.set(normalizedTag, displayTag);
    }

    return Array.from(uniqueTags.values());
}

export function serializePromptAssetTags(tags: string[]): string {
    return JSON.stringify(sanitizePromptAssetTags(tags));
}

export function parsePromptAssetTags(raw: string): string[] {
    try {
        const value: unknown = JSON.parse(raw);

        if (!Array.isArray(value)) {
            return [];
        }

        return sanitizePromptAssetTags(
            value.filter((item): item is string => typeof item === 'string')
        );
    } catch {
        return [];
    }
}

export function buildPromptAssetNormalizedTags(tags: string[]): string {
    const normalizedTags = sanitizePromptAssetTags(tags)
        .map((tag) => normalizePromptAssetTag(tag))
        .sort((left, right) => left.localeCompare(right, 'zh-CN'));

    if (normalizedTags.length === 0) {
        return '';
    }

    return `|${normalizedTags.join('|')}|`;
}

export function buildPromptAssetNormalizedTagToken(tag: string): string {
    return `|${normalizePromptAssetTag(tag)}|`;
}

export function arePromptAssetTagSetsEqual(left: string[], right: string[]): boolean {
    return buildPromptAssetNormalizedTags(left) === buildPromptAssetNormalizedTags(right);
}
