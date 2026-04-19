import { describe, it } from 'vitest';

describe('Multi-user Logto API contract', () => {
    describe('Session and workspace discovery', () => {
        it.todo('POST /api/workspaces creates a team workspace and returns the first owner membership');
        it.todo('POST /api/workspaces replays the first result when Idempotency-Key is retried');
        it.todo('GET /api/workspaces returns 401 UNAUTHENTICATED when the session cookie is missing');
    });

    describe('Workspace project APIs', () => {
        it.todo('POST /api/workspaces/:workspaceSlug/projects rejects injected defaultCredentialId values outside the active workspace');
        it.todo('GET /api/workspaces/:workspaceSlug/projects/:projectId/revisions never returns revisions from another workspace');
        it.todo('POST /api/workspaces/:workspaceSlug/projects/:projectId/restore rejects cross-workspace revision restore attempts');
    });

    describe('Workspace prompt asset APIs', () => {
        it.todo('GET /api/workspaces/:workspaceSlug/prompt-assets/:assetId returns 404 RESOURCE_NOT_FOUND for cross-tenant asset ids');
        it.todo('POST /api/workspaces/:workspaceSlug/prompt-assets/:assetId/archive records actor context and blocks archived replays');
    });

    describe('Credential APIs', () => {
        it.todo('GET /api/workspaces/:workspaceSlug/credentials never returns the full decrypted secret');
        it.todo('POST /api/workspaces/:workspaceSlug/credentials rejects workspace-scoped secrets without credential:manage');
        it.todo('POST /api/workspaces/:workspaceSlug/credentials validates provider, baseUrl, model, and secret fields');
        it.todo('POST /api/workspaces/:workspaceSlug/credentials/:credentialId/rotate-secret keeps secretLast4 but does not echo the new secret');
        it.todo('DELETE /api/workspaces/:workspaceSlug/credentials/:credentialId only soft-deletes workspace-owned credentials');
    });

    describe('Membership APIs', () => {
        it.todo('GET /api/workspaces/:workspaceSlug/members returns role and status for each membership');
        it.todo('POST /api/workspaces/:workspaceSlug/members rejects duplicate invitations when Idempotency-Key is reused');
        it.todo('POST /api/workspaces/:workspaceSlug/members validates email and role before calling Logto');
        it.todo('PATCH /api/workspaces/:workspaceSlug/members/:membershipId blocks privilege escalation without member:manage');
        it.todo('DELETE /api/workspaces/:workspaceSlug/members/:membershipId prevents removing the last owner');
    });

    describe('Cross-cutting error contract', () => {
        it.todo('all successful responses wrap payloads in { data } and optionally include meta.requestId');
        it.todo('all failed responses include error.code, error.message, error.details, and error.requestId');
        it.todo('all workspace routes resolve membership server-side instead of trusting workspace_id from the client body');
        it.todo('invalid JSON bodies return 400 BAD_REQUEST without leaking internal stack traces');
        it.todo('unexpected dependency failures return 502 UPSTREAM_ERROR for Logto management calls');
    });
});
