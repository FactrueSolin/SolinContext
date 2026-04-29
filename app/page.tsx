import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getDefaultWorkspaceProjectsPath } from './lib/auth/workspace-home';

export const metadata: Metadata = {
    title: 'AI Context Editor',
    description: '进入 AI Context Editor 工作区。',
    openGraph: {
        title: 'AI Context Editor',
        description: '进入 AI Context Editor 工作区。',
        type: 'website',
        siteName: 'AI Context Editor',
        locale: 'zh_CN',
    },
    twitter: {
        card: 'summary',
        title: 'AI Context Editor',
        description: '进入 AI Context Editor 工作区。',
    },
};

export default async function HomePage() {
    let workspacePath: string | null = null;

    try {
        workspacePath = await getDefaultWorkspaceProjectsPath();
    } catch {
        workspacePath = null;
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 text-[var(--foreground)]">
            <Link
                href={workspacePath ?? '/sign-in'}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
            >
                进入工作区
                <ArrowRight size={17} />
            </Link>
        </main>
    );
}
