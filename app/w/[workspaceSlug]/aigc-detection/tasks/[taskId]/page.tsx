import type { Metadata } from 'next';
import WorkspaceTopbar from '../../../../../components/WorkspaceTopbar';
import AigcDetectionWorkspace from '../../../../../components/AigcDetectionWorkspace';

export const metadata: Metadata = {
    title: 'AIGC 检测任务详情',
    description: '查看单个 AIGC 检测任务的状态、结果摘要与明细。',
};

export default async function WorkspaceAigcDetectionTaskDetailPage({
    params,
}: {
    params: Promise<{ taskId: string }>;
}) {
    const resolvedParams = await params;

    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
            <WorkspaceTopbar />
            <AigcDetectionWorkspace taskId={resolvedParams.taskId} />
        </div>
    );
}
