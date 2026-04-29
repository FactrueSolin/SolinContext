import type { Metadata } from 'next';
import WorkspaceTopbar from '../../../components/WorkspaceTopbar';
import AigcDetectionWorkspace from '../../../components/AigcDetectionWorkspace';

export const metadata: Metadata = {
    title: '工作区 AIGC 检测',
    description: '上传文档并在工作区内持续跟踪 AIGC 检测任务、进度与结果。',
};

export default function WorkspaceAigcDetectionPage() {
    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
            <WorkspaceTopbar />
            <AigcDetectionWorkspace />
        </div>
    );
}
