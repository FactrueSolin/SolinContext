'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import React from 'react';
import { ArrowRight, BadgeInfo } from 'lucide-react';
import WorkspaceTopbar from './WorkspaceTopbar';
import { buildWorkspaceModulePath } from '../lib/workspace-routing';

export default function WorkspacePlaceholderPage({
    title,
    description,
    actionLabel,
    actionHref,
}: {
    title: string;
    description: string;
    actionLabel: string;
    actionHref: string;
}) {
    const params = useParams<{ workspaceSlug?: string | string[] }>();
    const workspaceSlug = typeof params.workspaceSlug === 'string' ? params.workspaceSlug : '';

    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
            <WorkspaceTopbar />
            <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
                <section className="overflow-hidden rounded-[32px] border border-white/60 bg-white/80 p-8 shadow-[0_32px_90px_-45px_rgba(15,23,42,0.45)] backdrop-blur">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f766e_0%,#2563eb_100%)] text-white shadow-lg shadow-cyan-950/15">
                        <BadgeInfo size={22} />
                    </div>
                    <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{description}</p>
                    <div className="mt-6 flex flex-wrap gap-3">
                        <Link
                            href={actionHref}
                            className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
                        >
                            {actionLabel}
                            <ArrowRight size={15} />
                        </Link>
                        <Link
                            href={buildWorkspaceModulePath(workspaceSlug, 'projects')}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
                        >
                            返回项目页
                        </Link>
                    </div>
                </section>
            </main>
        </div>
    );
}
