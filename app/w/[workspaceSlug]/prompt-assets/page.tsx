import type { Metadata } from 'next';
import WorkspaceTopbar from '../../../components/WorkspaceTopbar';
import PromptAssetDrawer from '../../../components/PromptAssetDrawer';

export const metadata: Metadata = {
    title: '工作区提示词资产库',
    description: '按工作区浏览、创建与版本化管理提示词资产。',
};

export default async function WorkspacePromptAssetsPage({
    searchParams,
}: {
    searchParams: Promise<{ entry?: string | string[] | undefined }>;
}) {
    const resolvedSearchParams = await searchParams;
    const entry =
        typeof resolvedSearchParams.entry === 'string' ? resolvedSearchParams.entry : null;

    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
            <WorkspaceTopbar />
            <PromptAssetDrawer entry={entry} />
        </div>
    );
}
