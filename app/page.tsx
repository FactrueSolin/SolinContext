import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Blocks, Building2, LogIn, ShieldCheck, Sparkles } from 'lucide-react';
import { getDefaultWorkspaceProjectsPath } from './lib/auth/workspace-home';

export default async function HomePage() {
    let workspacePath: string | null = null;

    try {
        workspacePath = await getDefaultWorkspaceProjectsPath();
    } catch {
    }

    if (workspacePath) {
        redirect(workspacePath);
    }

    return (
        <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#ecfeff_100%)] px-4 py-10 text-slate-950 sm:px-6">
            <div className="mx-auto flex max-w-6xl flex-col gap-8">
                <section className="overflow-hidden rounded-[36px] border border-white/70 bg-white/80 p-8 shadow-[0_32px_100px_-50px_rgba(15,23,42,0.55)] backdrop-blur sm:p-10">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-3xl">
                            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-800">
                                <Building2 size={14} />
                                Multi-Workspace
                            </div>
                            <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
                                AI Context Editor 已切到工作区模式
                            </h1>
                            <p className="mt-4 text-base leading-8 text-slate-600">
                                登录后会直接进入你的默认工作区。项目列表、提示词资产和后续团队能力都以当前工作区作为上下文，不再混用单用户路由。
                            </p>
                        </div>
                        <Link
                            href="/sign-in"
                            className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/15"
                        >
                            <LogIn size={16} />
                            登录并进入工作区
                        </Link>
                    </div>
                </section>

                <section className="grid gap-4 md:grid-cols-3">
                    {[
                        {
                            title: '工作区上下文',
                            body: '顶部导航持续展示当前 workspace、角色和权限提示，切换时保持当前模块不变。',
                            icon: Building2,
                        },
                        {
                            title: '项目与资产隔离',
                            body: '编辑器项目与 Prompt Asset 全部按 `/w/:workspaceSlug/*` 路由组织，刷新与分享不丢上下文。',
                            icon: Blocks,
                        },
                        {
                            title: '权限感知',
                            body: '前端消费服务端返回的角色和权限摘要，区分可编辑、可管理成员和只读状态。',
                            icon: ShieldCheck,
                        },
                    ].map((item) => {
                        const Icon = item.icon;

                        return (
                            <article
                                key={item.title}
                                className="rounded-[28px] border border-white/70 bg-white/75 p-6 shadow-[0_24px_60px_-48px_rgba(15,23,42,0.5)] backdrop-blur"
                            >
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f766e_0%,#2563eb_100%)] text-white">
                                    <Icon size={20} />
                                </div>
                                <h2 className="mt-5 text-lg font-semibold">{item.title}</h2>
                                <p className="mt-2 text-sm leading-7 text-slate-600">{item.body}</p>
                            </article>
                        );
                    })}
                </section>

                <section className="rounded-[32px] border border-white/70 bg-white/75 p-6 shadow-[0_24px_60px_-48px_rgba(15,23,42,0.5)] backdrop-blur">
                    <div className="flex items-center gap-3 text-slate-900">
                        <Sparkles size={18} />
                        <h2 className="text-lg font-semibold">当前已落地</h2>
                    </div>
                    <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                        <p>工作区路由：`/w/:workspaceSlug/projects`、`/w/:workspaceSlug/prompt-assets`</p>
                        <p>工作区切换器、角色徽章、权限摘要和登出入口</p>
                        <p>项目列表、详情、保存、删除、复制切换到工作区接口</p>
                        <p>提示词资产页面切换到工作区接口并保留当前编辑器上下文</p>
                    </div>
                </section>
            </div>
        </main>
    );
}
