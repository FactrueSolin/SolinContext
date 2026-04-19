import { redirect } from 'next/navigation';
import { getDefaultWorkspacePromptAssetsPath } from '../lib/auth/workspace-home';

export default async function PromptAssetsPage({
    searchParams,
}: {
    searchParams: Promise<{ entry?: string | string[] | undefined }>;
}) {
    const resolvedSearchParams = await searchParams;
    const entry =
        typeof resolvedSearchParams.entry === 'string' ? resolvedSearchParams.entry : null;
    let target = '/';

    try {
        target = await getDefaultWorkspacePromptAssetsPath(entry);
    } catch {
        target = '/';
    }

    redirect(target);
}
