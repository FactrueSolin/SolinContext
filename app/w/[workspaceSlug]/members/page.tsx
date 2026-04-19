import WorkspacePlaceholderPage from '../../../components/WorkspacePlaceholderPage';

export default function WorkspaceMembersPage() {
    return (
        <WorkspacePlaceholderPage
            title="成员管理"
            description="成员邀请、角色调整和待接受状态展示仍待后端成员接口落地。当前页面先保留工作区入口，保证多用户信息架构完整。"
            actionLabel="回到当前工作区项目"
            actionHref="../projects"
        />
    );
}
