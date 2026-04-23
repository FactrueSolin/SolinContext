import type { Metadata } from 'next';
import WorkspaceTopbar from '../../../components/WorkspaceTopbar';
import AigcRewriteWorkspace from '../../../components/AigcRewriteWorkspace';

export const metadata: Metadata = {
    title: '工作区降低 AIGC',
    description: '通过本地样本模仿你的改写习惯，生成更像本人表达的新文本。',
};

export default function WorkspaceAigcRewritePage() {
    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
            <WorkspaceTopbar />
            <AigcRewriteWorkspace />
        </div>
    );
}
