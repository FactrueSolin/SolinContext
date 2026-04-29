'use client';

import Link from 'next/link';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import React, { useEffect, useMemo, useState } from 'react';
import {
    Blocks,
    Building2,
    ChevronDown,
    FileSearch,
    KeyRound,
    LoaderCircle,
    LogOut,
    Search,
    Settings,
    Sparkles,
    Users,
    WandSparkles,
} from 'lucide-react';
import { buildWorkspaceModulePath, getWorkspaceModuleFromPathname, type WorkspaceModule } from '../lib/workspace-routing';
import { getCurrentSession, listWorkspaces, type AccessibleWorkspace, type SessionSummary } from '../lib/workspaces/client';
import Header from './Header';

const moduleMeta: Array<{
    id: WorkspaceModule;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
    { id: 'projects', label: '项目', icon: Blocks },
    { id: 'aigc-detection', label: 'AIGC 检测', icon: FileSearch },
    { id: 'aigc-rewrite', label: '降低 AIGC', icon: WandSparkles },
    { id: 'prompt-assets', label: '提示词资产', icon: Sparkles },
    { id: 'credentials', label: '凭证', icon: KeyRound },
    { id: 'members', label: '成员', icon: Users },
    { id: 'settings', label: '设置', icon: Settings },
];

function roleClass(role: string) {
    if (role === 'owner') return 'border-amber-200 bg-amber-50 text-amber-800';
    if (role === 'admin') return 'border-sky-200 bg-sky-50 text-sky-800';
    if (role === 'editor') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    return 'border-slate-200 bg-slate-50 text-slate-700';
}

function permissionSummary(session: SessionSummary | null) {
    if (!session) {
        return [];
    }

    const items: string[] = [];

    if (session.permissions.includes('workspace:manage')) {
        items.push('可管理工作区');
    }

    if (session.permissions.includes('member:manage')) {
        items.push('可管理成员');
    }

    if (
        session.permissions.includes('project:write') ||
        session.permissions.includes('prompt_asset:write')
    ) {
        items.push('可编辑');
    }

    if (items.length === 0) {
        items.push('只读');
    }

    return items;
}

export default function WorkspaceTopbar() {
    const params = useParams<{ workspaceSlug?: string | string[] }>();
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const workspaceSlug = typeof params.workspaceSlug === 'string' ? params.workspaceSlug : undefined;

    const [session, setSession] = useState<SessionSummary | null>(null);
    const [workspaces, setWorkspaces] = useState<AccessibleWorkspace[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');

    useEffect(() => {
        if (!workspaceSlug) {
            setIsLoading(false);
            return;
        }

        let isCancelled = false;

        async function load() {
            setIsLoading(true);

            try {
                const [nextSession, nextWorkspaces] = await Promise.all([
                    getCurrentSession(workspaceSlug),
                    listWorkspaces(),
                ]);

                if (isCancelled) {
                    return;
                }

                setSession(nextSession);
                setWorkspaces(nextWorkspaces);
            } catch {
                if (isCancelled) {
                    return;
                }

                setSession(null);
                setWorkspaces([]);
            } finally {
                if (!isCancelled) {
                    setIsLoading(false);
                }
            }
        }

        void load();

        return () => {
            isCancelled = true;
        };
    }, [workspaceSlug]);

    const currentModule = useMemo(() => getWorkspaceModuleFromPathname(pathname), [pathname]);
    const currentProjectId = searchParams.get('projectId');
    const currentEntry = searchParams.get('entry');
    const permissionTags = useMemo(() => permissionSummary(session), [session]);

    const visibleModules = useMemo(() => {
        const workspaceType = session?.activeWorkspace.type;

        return moduleMeta.filter((item) => !(workspaceType === 'personal' && item.id === 'members'));
    }, [session?.activeWorkspace.type]);

    const filteredWorkspaces = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();

        if (!normalizedQuery) {
            return workspaces;
        }

        return workspaces.filter((workspace) => {
            return (
                workspace.name.toLowerCase().includes(normalizedQuery) ||
                workspace.slug.toLowerCase().includes(normalizedQuery)
            );
        });
    }, [query, workspaces]);

    const navigateToWorkspace = (nextWorkspaceSlug: string) => {
        const nextPath = buildWorkspaceModulePath(nextWorkspaceSlug, currentModule, {
            projectId: currentModule === 'projects' ? currentProjectId : null,
            entry: currentModule === 'prompt-assets' ? currentEntry : null,
        });

        setIsOpen(false);
        router.push(nextPath);
    };

    return (
        <div className="border-b border-[var(--border)] bg-[linear-gradient(135deg,rgba(236,253,245,0.92),rgba(239,246,255,0.92))] px-3 py-3 backdrop-blur sm:px-4 lg:px-6">
            <div className="mx-auto flex max-w-[1600px] flex-col gap-3">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f766e_0%,#2563eb_100%)] text-white shadow-lg shadow-cyan-950/15">
                            <Building2 size={18} />
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Active Workspace
                            </p>
                            {isLoading ? (
                                <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                                    <LoaderCircle size={14} className="animate-spin" />
                                    正在读取工作区上下文
                                </div>
                            ) : session ? (
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                    <span className="text-xl font-semibold text-slate-950">
                                        {session.activeWorkspace.name}
                                    </span>
                                    <span
                                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${roleClass(
                                            session.activeWorkspace.role
                                        )}`}
                                    >
                                        {session.activeWorkspace.role}
                                    </span>
                                    <span className="rounded-full border border-white/60 bg-white/65 px-2.5 py-1 text-xs font-medium text-slate-700">
                                        {session.activeWorkspace.type === 'organization' ? '团队空间' : '个人空间'}
                                    </span>
                                </div>
                            ) : (
                                <div className="mt-1 text-sm text-rose-700">
                                    无法读取当前工作区，请重新登录。
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {permissionTags.map((item) => (
                            <span
                                key={item}
                                className="rounded-full border border-white/70 bg-white/70 px-2.5 py-1 text-xs font-medium text-slate-700"
                            >
                                {item}
                            </span>
                        ))}
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setIsOpen((current) => !current)}
                                className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-white"
                            >
                                切换工作区
                                <ChevronDown size={15} />
                            </button>
                            {isOpen && (
                                <div className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-[320px] overflow-hidden rounded-[24px] border border-white/80 bg-white/95 shadow-2xl shadow-slate-900/15 backdrop-blur">
                                    <div className="border-b border-slate-200/70 px-4 py-3">
                                        <div className="flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-slate-50 px-3 py-2">
                                            <Search size={14} className="text-slate-400" />
                                            <input
                                                value={query}
                                                onChange={(event) => setQuery(event.target.value)}
                                                placeholder="搜索工作区"
                                                className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                                            />
                                        </div>
                                    </div>
                                    <div className="max-h-[320px] overflow-y-auto p-2">
                                        {filteredWorkspaces.map((workspace) => {
                                            const isActive = workspace.slug === session?.activeWorkspace.slug;

                                            return (
                                                <button
                                                    key={workspace.id}
                                                    type="button"
                                                    onClick={() => navigateToWorkspace(workspace.slug)}
                                                    className={`flex w-full items-start justify-between rounded-2xl px-3 py-3 text-left transition-colors ${
                                                        isActive
                                                            ? 'bg-cyan-50 text-cyan-900'
                                                            : 'hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <div>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="text-sm font-semibold">
                                                                {workspace.name}
                                                            </span>
                                                            <span
                                                                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${roleClass(
                                                                    workspace.role
                                                                )}`}
                                                            >
                                                                {workspace.role}
                                                            </span>
                                                        </div>
                                                        <p className="mt-1 text-xs text-slate-500">
                                                            {workspace.type === 'organization'
                                                                ? '团队空间'
                                                                : '个人空间'}
                                                            {' · '}
                                                            {workspace.slug}
                                                        </p>
                                                    </div>
                                                    {isActive && (
                                                        <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-semibold text-cyan-800">
                                                            当前
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                        {filteredWorkspaces.length === 0 && (
                                            <div className="px-3 py-8 text-center text-sm text-slate-500">
                                                没有匹配的工作区。
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <form action="/sign-out" method="post">
                            <button
                                type="submit"
                                className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-white"
                            >
                                <LogOut size={15} />
                                退出
                            </button>
                        </form>
                    </div>
                </div>

                <nav className="flex flex-wrap items-center gap-2">
                    {visibleModules.map((item) => {
                        const Icon = item.icon;
                        const href = buildWorkspaceModulePath(session?.activeWorkspace.slug ?? workspaceSlug ?? '', item.id);
                        const isActive = currentModule === item.id;

                        return (
                            <Link
                                key={item.id}
                                href={href}
                                className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                                    isActive
                                        ? 'bg-slate-950 text-white shadow-lg shadow-slate-900/10'
                                        : 'border border-white/80 bg-white/70 text-slate-700 hover:bg-white'
                                }`}
                            >
                                <Icon size={15} />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                {currentModule === 'projects' && <Header variant="embedded" />}
            </div>
        </div>
    );
}
