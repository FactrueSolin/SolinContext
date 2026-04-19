import { buildWorkspaceModulePath } from '../workspace-routing';
import { getCurrentUserSummary } from './principal';
import { createServerRequest } from './server-request';

export async function getDefaultWorkspaceProjectsPath() {
    const summary = await getCurrentUserSummary(await createServerRequest());
    return buildWorkspaceModulePath(summary.defaultWorkspace.slug, 'projects');
}

export async function getDefaultWorkspacePromptAssetsPath(entry?: string | null) {
    const summary = await getCurrentUserSummary(await createServerRequest());
    return buildWorkspaceModulePath(summary.defaultWorkspace.slug, 'prompt-assets', {
        entry,
    });
}
