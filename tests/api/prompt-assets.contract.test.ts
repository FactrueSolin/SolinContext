import { describe, it } from 'vitest';

describe('Prompt Assets API Contract From Spec', () => {
    it.todo('GET /api/prompt-assets validates query params and returns { data: { items, pagination } }');
    it.todo('POST /api/prompt-assets creates v1 and returns 201 with PromptAssetDetail');
    it.todo('GET /api/prompt-assets/:id returns 404 PROMPT_ASSET_NOT_FOUND for unknown asset ids');
    it.todo('POST /api/prompt-assets/:id/versions rejects mismatched expectedVersionNumber with 409 PROMPT_ASSET_VERSION_CONFLICT');
    it.todo('POST /api/prompt-assets/:id/versions rejects unchanged content with 409 PROMPT_ASSET_NO_CHANGES');
    it.todo('GET /api/prompt-assets/:id/versions returns items sorted by versionNumber desc with pagination');
    it.todo('GET /api/prompt-assets/:id/versions/:versionId rejects cross-asset version access with 404 PROMPT_ASSET_VERSION_NOT_FOUND');
    it.todo('POST /api/prompt-assets/:id/restore creates a new restore version using sourceVersionId');
    it.todo('POST /api/prompt-assets/:id/archive and /unarchive are idempotent and update status correctly');
    it.todo('all prompt-assets routes reject malformed or injection-style input with normalized error codes and response shapes');
});
