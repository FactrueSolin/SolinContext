import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
    ArrowRight,
    Blocks,
    Building2,
    CheckCircle2,
    Database,
    FolderKanban,
    GitBranch,
    LockKeyhole,
    ShieldCheck,
    Sparkles,
    Users,
    Workflow,
} from 'lucide-react';
import { getDefaultWorkspaceProjectsPath } from './lib/auth/workspace-home';

interface FeatureCard {
    title: string;
    body: string;
    icon: LucideIcon;
}

interface MetricCard {
    label: string;
    value: string;
    detail: string;
}

interface JourneyStep {
    step: string;
    title: string;
    body: string;
}

const featureCards: FeatureCard[] = [
    {
        title: '工作区级上下文',
        body: '项目、提示词资产和成员访问范围全部挂在同一工作区语义下，减少跨团队协作时的上下文混线。',
        icon: Building2,
    },
    {
        title: 'Prompt Asset 资产化',
        body: '提示词不再只是聊天记录里的临时文本，而是支持版本、归档、恢复与持续维护的业务资产。',
        icon: Blocks,
    },
    {
        title: '项目交付工作台',
        body: '在统一界面编排 system prompt、消息块、模型配置和输出，适合真实项目迭代，而不是演示级玩具。',
        icon: Workflow,
    },
    {
        title: '权限与治理边界',
        body: '登录、角色摘要和工作区路由共同约束协作边界，让编辑权限、查看范围和成员职责更清晰。',
        icon: ShieldCheck,
    },
];

const metricCards: MetricCard[] = [
    {
        label: 'Workspace First',
        value: '统一工作区入口',
        detail: '默认登录后进入工作区，不再混用单用户路由。',
    },
    {
        label: 'Asset Lifecycle',
        value: '版本 / 归档 / 恢复',
        detail: '围绕 Prompt Asset 建立稳定的生命周期管理。',
    },
    {
        label: 'Project Delivery',
        value: '编辑 / 保存 / 复制',
        detail: '核心项目流程已切到工作区接口和存储模型。',
    },
    {
        label: 'Deployment Ready',
        value: '本地与私有化友好',
        detail: '支持 Docker 部署与本地持久化，适合企业内网环境。',
    },
];

const governancePoints: FeatureCard[] = [
    {
        title: '协作结构明确',
        body: '成员、角色与模块入口围绕工作区展开，团队协作从第一天开始就具备组织结构。',
        icon: Users,
    },
    {
        title: '数据持久化可控',
        body: '项目与提示词资产统一落到 SQLite 数据库与运行时目录，便于备份、迁移和部署治理。',
        icon: Database,
    },
    {
        title: '版本演进可追踪',
        body: '提示词资产版本和项目历史为迭代提供对照基础，避免关键策略在多人改动中失真。',
        icon: GitBranch,
    },
    {
        title: '访问边界更安全',
        body: '登录、工作区上下文与权限摘要共同形成最基础的企业访问控制面。',
        icon: LockKeyhole,
    },
];

const journeySteps: JourneyStep[] = [
    {
        step: '01',
        title: '定义上下文',
        body: '整理 system prompt、用户消息和工具结果，让项目上下文可视化、可维护。',
    },
    {
        step: '02',
        title: '沉淀资产',
        body: '把可复用提示词整理进 Prompt Asset，形成跨项目共享的策略资产。',
    },
    {
        step: '03',
        title: '团队协作',
        body: '基于工作区进行路由、权限和模块切换，保障多人协作时的边界稳定。',
    },
    {
        step: '04',
        title: '持续交付',
        body: '在同一平台里迭代项目、回看版本并进入下一轮模型实验与产品交付。',
    },
];

export const metadata: Metadata = {
    title: 'AI Context Editor | 企业级 AI 上下文工程平台',
    description:
        '面向企业团队的 AI 上下文工程平台，统一管理项目编辑、Prompt Asset、工作区协作和访问治理。',
};

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
        <main className="relative isolate min-h-screen overflow-hidden bg-[#edf2ec] px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(15,118,110,0.18),transparent_28%),radial-gradient(circle_at_82%_16%,rgba(37,99,235,0.14),transparent_20%),linear-gradient(180deg,rgba(255,255,255,0.72)_0%,rgba(237,242,236,0.96)_100%)]"
            />
            <div aria-hidden="true" className="design-grid pointer-events-none absolute inset-0 opacity-60" />
            <div
                aria-hidden="true"
                className="design-float pointer-events-none absolute left-[-6rem] top-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(15,118,110,0.24)_0%,rgba(15,118,110,0)_72%)] blur-3xl"
            />
            <div
                aria-hidden="true"
                className="design-float pointer-events-none absolute right-[-4rem] top-40 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.18)_0%,rgba(37,99,235,0)_72%)] blur-3xl [animation-delay:2s]"
            />

            <div className="relative mx-auto flex max-w-7xl flex-col gap-6 lg:gap-8">
                <header className="home-shell design-rise px-5 py-4 sm:px-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_100%)] text-white shadow-[0_18px_40px_-22px_rgba(15,23,42,0.8)]">
                                <Sparkles size={20} />
                            </div>
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                                    AI Context Editor
                                </p>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-medium text-emerald-800">
                                        Enterprise Workspace Edition
                                    </span>
                                    <span>面向企业团队的 AI 上下文工程平台</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <div className="rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-sm text-slate-600">
                                工作区、Prompt Asset、项目编辑统一运营
                            </div>
                            <Link
                                href="/sign-in"
                                className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_-22px_rgba(15,23,42,0.75)] transition-transform hover:-translate-y-0.5"
                            >
                                登录并进入工作区
                                <ArrowRight size={16} />
                            </Link>
                        </div>
                    </div>
                </header>

                <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                    <div className="home-shell design-rise px-6 py-8 sm:px-8 sm:py-10">
                        <div className="max-w-4xl">
                            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-900">
                                <Building2 size={14} />
                                Enterprise AI Delivery
                            </div>
                            <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-tight tracking-[-0.04em] text-slate-950 sm:text-5xl lg:text-6xl">
                                让 AI 项目、提示词资产与工作区治理形成同一套交付系统
                            </h1>
                            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 sm:text-lg">
                                AI Context Editor
                                不再只是一个本地编辑器，而是一个具备组织结构、访问边界和资产沉淀能力的企业型平台。它把项目编辑、Prompt
                                Asset、权限上下文和工作区路由纳入同一操作面，适合长期维护而不是短期试验。
                            </p>
                        </div>

                        <div className="mt-8 flex flex-wrap gap-3">
                            <Link
                                href="/sign-in"
                                className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_-22px_rgba(15,23,42,0.75)] transition-transform hover:-translate-y-0.5"
                            >
                                进入企业工作台
                                <ArrowRight size={16} />
                            </Link>
                            <Link
                                href="#capabilities"
                                className="inline-flex items-center justify-center rounded-full border border-slate-300/80 bg-white/80 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-white"
                            >
                                查看平台能力
                            </Link>
                        </div>

                        <div className="home-rule my-8" />

                        <div className="grid gap-3 sm:grid-cols-3">
                            {[
                                '以工作区为入口组织团队协作',
                                '以 Prompt Asset 为中心沉淀可复用策略',
                                '以项目编辑器驱动持续实验与交付',
                            ].map((item) => (
                                <div
                                    key={item}
                                    className="rounded-[24px] border border-white/80 bg-white/72 px-4 py-4 text-sm font-medium text-slate-700 shadow-[0_20px_60px_-50px_rgba(15,23,42,0.7)]"
                                >
                                    <div className="flex items-start gap-3">
                                        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-700" />
                                        <span>{item}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid gap-6">
                        <section className="home-shell design-rise px-6 py-6 [animation-delay:120ms]">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                        Operating Snapshot
                                    </p>
                                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                                        平台现在已经具备企业化骨架
                                    </h2>
                                </div>
                                <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">
                                    active
                                </div>
                            </div>

                            <div className="mt-6 grid gap-3 sm:grid-cols-2">
                                {metricCards.map((item) => (
                                    <article
                                        key={item.label}
                                        className="rounded-[24px] border border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(241,245,249,0.82)_100%)] p-4 shadow-[0_20px_60px_-50px_rgba(15,23,42,0.75)]"
                                    >
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                            {item.label}
                                        </p>
                                        <p className="mt-3 text-lg font-semibold tracking-tight text-slate-950">
                                            {item.value}
                                        </p>
                                        <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
                                    </article>
                                ))}
                            </div>
                        </section>

                        <section className="home-shell design-rise px-6 py-6 [animation-delay:220ms]">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                What This Homepage Says
                            </p>
                            <div className="mt-4 space-y-3">
                                {[
                                    '这不是单纯的 AI 对话测试页，而是围绕项目交付建立的操作平台。',
                                    '它强调角色、资产、版本和环境边界，而不是只强调一次性生成结果。',
                                    '首页传达的是“平台运营中”的状态，而不是“功能开发中”的状态。',
                                ].map((item) => (
                                    <div
                                        key={item}
                                        className="rounded-[22px] border border-white/80 bg-white/72 px-4 py-3 text-sm leading-7 text-slate-700"
                                    >
                                        {item}
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                </section>

                <section id="capabilities" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {featureCards.map((item, index) => {
                        const Icon = item.icon;

                        return (
                            <article
                                key={item.title}
                                className="home-shell design-rise px-6 py-6"
                                style={{ animationDelay: `${index * 90}ms` }}
                            >
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f766e_0%,#1d4ed8_100%)] text-white shadow-[0_20px_45px_-24px_rgba(29,78,216,0.7)]">
                                    <Icon size={22} />
                                </div>
                                <h2 className="mt-6 text-xl font-semibold tracking-tight text-slate-950">
                                    {item.title}
                                </h2>
                                <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
                            </article>
                        );
                    })}
                </section>

                <section className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
                    <section className="home-shell design-rise px-6 py-8 sm:px-8">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Platform Positioning
                        </p>
                        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                            首页要传达的，不是一个功能合集，而是一套被企业持续运营的 AI 系统
                        </h2>
                        <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">
                            因此这次改版的核心不是堆更多入口，而是先建立信号密度。品牌、治理、资产、交付链路和登录动作要在第一屏同时成立，让用户一眼知道这是平台，不是实验页面。
                        </p>
                        <div className="home-rule my-8" />
                        <div className="space-y-4">
                            {[
                                '用更正式的标题、结构和语气强调“平台定位”。',
                                '把工作区、权限、版本和资产管理显式写进首页信息架构。',
                                '保留登录入口作为唯一主行动作，减少营销页常见的噪音按钮。',
                            ].map((item) => (
                                <div
                                    key={item}
                                    className="rounded-[24px] border border-white/80 bg-white/72 px-4 py-4 text-sm leading-7 text-slate-700"
                                >
                                    {item}
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="grid gap-4 sm:grid-cols-2">
                        {governancePoints.map((item, index) => {
                            const Icon = item.icon;

                            return (
                                <article
                                    key={item.title}
                                    className="home-shell design-rise px-5 py-5"
                                    style={{ animationDelay: `${index * 80}ms` }}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200/70 bg-white/90 text-slate-900">
                                            <Icon size={20} />
                                        </div>
                                        <span className="rounded-full border border-slate-200/80 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                            Governance
                                        </span>
                                    </div>
                                    <h3 className="mt-5 text-lg font-semibold tracking-tight text-slate-950">
                                        {item.title}
                                    </h3>
                                    <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
                                </article>
                            );
                        })}
                    </section>
                </section>

                <section className="home-shell design-rise px-6 py-8 sm:px-8">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-3xl">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Delivery Journey
                            </p>
                            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                                从上下文编排到团队交付，首页直接说明这套系统怎样工作
                            </h2>
                        </div>
                        <p className="max-w-2xl text-sm leading-7 text-slate-600">
                            信息架构围绕真实工作流展开，而不是按功能菜单罗列，这样企业用户能更快判断平台是否适合纳入团队流程。
                        </p>
                    </div>

                    <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {journeySteps.map((item, index) => (
                            <article
                                key={item.step}
                                className="rounded-[28px] border border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(240,244,248,0.8)_100%)] p-5 shadow-[0_24px_60px_-48px_rgba(15,23,42,0.75)] design-rise"
                                style={{ animationDelay: `${index * 90}ms` }}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-3xl font-semibold tracking-[-0.05em] text-slate-300">
                                        {item.step}
                                    </span>
                                    <FolderKanban size={18} className="text-slate-400" />
                                </div>
                                <h3 className="mt-6 text-lg font-semibold tracking-tight text-slate-950">
                                    {item.title}
                                </h3>
                                <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="home-shell design-rise overflow-hidden px-6 py-8 sm:px-8 sm:py-10">
                    <div
                        aria-hidden="true"
                        className="home-beam pointer-events-none absolute inset-x-[-20%] top-0 h-px"
                    />
                    <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                        <div className="max-w-3xl">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Ready To Operate
                            </p>
                            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                                进入工作区，开始以平台方式管理你的 AI 项目上下文
                            </h2>
                            <p className="mt-4 text-base leading-8 text-slate-600">
                                如果你要的是一个能够长期维护、方便团队协作并具备资产沉淀能力的 AI
                                Context 平台，这里就是正式入口。
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <Link
                                href="/sign-in"
                                className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_-22px_rgba(15,23,42,0.75)] transition-transform hover:-translate-y-0.5"
                            >
                                登录并进入工作区
                                <ArrowRight size={16} />
                            </Link>
                            <Link
                                href="#capabilities"
                                className="inline-flex items-center justify-center rounded-full border border-slate-300/80 bg-white/80 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-white"
                            >
                                重新查看能力概览
                            </Link>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}
