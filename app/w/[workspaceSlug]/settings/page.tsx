import WorkspacePlaceholderPage from '../../../components/WorkspacePlaceholderPage';

export default function WorkspaceSettingsPage() {
    return (
        <WorkspacePlaceholderPage
            title="工作区设置"
            description="工作区基础设置、危险操作和审计入口会收敛到这里。当前先落工作区级导航结构，避免多租户上下文继续藏在隐式状态里。"
            actionLabel="回到当前工作区项目"
            actionHref="../projects"
        />
    );
}
