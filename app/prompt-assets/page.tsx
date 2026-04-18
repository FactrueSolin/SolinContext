import type { Metadata } from 'next';
import PromptAssetDrawer from '../components/PromptAssetDrawer';

export const metadata: Metadata = {
    title: '提示词资产库',
    description: '浏览、创建、版本化管理并应用可复用的提示词资产。',
};

export default async function PromptAssetsPage({
    searchParams,
}: {
    searchParams: Promise<{ entry?: string | string[] | undefined }>;
}) {
    const resolvedSearchParams = await searchParams;
    const entry =
        typeof resolvedSearchParams.entry === 'string' ? resolvedSearchParams.entry : null;

    return <PromptAssetDrawer entry={entry} />;
}
