import WorkspacePlaceholderPage from '../../../components/WorkspacePlaceholderPage';

export default function WorkspaceCredentialsPage() {
    return (
        <WorkspacePlaceholderPage
            title="凭证中心"
            description="工作区级凭证界面还没接上后端能力。当前导航和上下文已经多工作区化，后续可以在这里区分个人凭证与工作区共享凭证。"
            actionLabel="查看提示词资产"
            actionHref="../prompt-assets"
        />
    );
}
