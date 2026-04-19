import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  Blocks,
  Building2,
  CheckCheck,
  ChevronDown,
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  Orbit,
  PanelLeft,
  Plus,
  Route,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  Workflow,
} from 'lucide-react';

const navigation = [
  { label: '登录态首页', icon: LayoutDashboard, active: true },
  { label: '工作区切换器', icon: Building2 },
  { label: '项目与资产', icon: FolderKanban },
  { label: '凭证中心', icon: KeyRound },
  { label: '成员管理', icon: Users },
  { label: '审计与告警', icon: ShieldCheck },
];

const workspaceOptions = [
  {
    name: 'Luyi Studio',
    slug: 'luyi-studio',
    type: 'organization',
    role: 'owner',
    members: '12 位成员',
    note: '映射 Logto Organization，支持邀请、角色同步、组织级权限。',
    highlight: true,
  },
  {
    name: '个人空间',
    slug: 'chen-luyi',
    type: 'personal',
    role: 'owner',
    members: '仅本人',
    note: '首次登录自动创建，作为默认落点与私有试验空间。',
    highlight: false,
  },
  {
    name: 'Partner Ops',
    slug: 'partner-ops',
    type: 'organization',
    role: 'viewer',
    members: '5 位成员',
    note: '只读审查空间，默认隐藏高风险操作入口。',
    highlight: false,
  },
];

const keyStats = [
  { label: '登录后默认动作', value: '进入 personal workspace', meta: '首次建档 + 默认空间' },
  { label: '工作区解析优先级', value: '路由 > 偏好 > 默认', meta: 'Active Workspace' },
  { label: '资源请求模型', value: '/api/workspaces/:slug/*', meta: '路径显式携带上下文' },
  { label: '凭证输入方式', value: '选择 Credential Profile', meta: '不再编辑明文 key' },
];

const loginTimeline = [
  '1. Logto 登录成功，服务端建立 Session Cookie。',
  '2. 首次登录时创建本地 user 与 personal workspace。',
  '3. 首页直接落到当前可访问的 active workspace。',
  '4. 所有项目、资产、凭证入口默认带 workspace 上下文。',
];

const projectCards = [
  {
    title: 'Enterprise Support Bot',
    role: 'admin',
    route: '/api/workspaces/luyi-studio/projects/support-bot',
    summary: '项目列表只展示当前工作区内资源，并在切换工作区后整体刷新。',
    footer: '默认凭证: OpenAI Shared Production',
  },
  {
    title: 'Prompt QA Sandbox',
    role: 'editor',
    route: '/api/workspaces/luyi-studio/projects/prompt-qa-sandbox',
    summary: '写入走 `project:write`，高风险操作如删除要走更严格权限判定。',
    footer: '版本冲突时返回 409 VERSION_CONFLICT',
  },
  {
    title: 'Risk Review Flow',
    role: 'viewer',
    route: '/api/workspaces/partner-ops/projects/risk-review-flow',
    summary: 'Viewer 只能看，不给按钮也不能代替服务端鉴权。',
    footer: '只读模式下仍显示历史与审计轨迹',
  },
];

const assetCards = [
  {
    name: 'support-tone-v4',
    status: 'published',
    detail: 'Prompt Asset 创建、归档、恢复都必须按当前工作区过滤。',
  },
  {
    name: 'incident-triage',
    status: 'draft',
    detail: 'PromptAssetDrawer 切空间后重载，不再串数据。',
  },
  {
    name: 'onboarding-checklist',
    status: 'archived',
    detail: '归档动作需要 `prompt_asset:archive`，并写审计日志。',
  },
];

const credentialProfiles = [
  {
    name: 'OpenAI Shared Production',
    scope: 'workspace',
    permission: 'credential:use',
    detail: '被 9 个项目引用，只暴露名称、provider 与 secret_last4。',
  },
  {
    name: 'Anthropic Review Sandbox',
    scope: 'personal',
    permission: 'credential:read_meta',
    detail: '个人空间下可优先选择用户私有凭证，避免滥用团队资源。',
  },
  {
    name: 'Azure Backup EastAsia',
    scope: 'workspace',
    permission: 'credential:manage',
    detail: '轮换 secret 通过独立命令接口完成，不与元数据编辑混在一起。',
  },
];

const members = [
  {
    name: 'Luyi Chen',
    role: 'owner',
    state: '在线',
    detail: '可管理工作区、成员和共享凭证。',
  },
  {
    name: 'Mina Zhao',
    role: 'admin',
    state: '刚刚邀请成员',
    detail: '适合负责成员邀请、角色调整、项目治理。',
  },
  {
    name: 'Howard Xu',
    role: 'editor',
    state: '正在编辑 Prompt',
    detail: '保留写入能力，但不开放成员与凭证管理。',
  },
  {
    name: 'Nora Li',
    role: 'viewer',
    state: '昨日查看',
    detail: '仅查看项目、资产与审计信息。',
  },
];

const permissionMatrix = [
  { role: 'owner', project: '读 / 写 / 删', asset: '读 / 写 / 归档', credential: '读元数据 / 使用 / 管理', member: '读 / 管理' },
  { role: 'admin', project: '读 / 写 / 删', asset: '读 / 写 / 归档', credential: '读元数据 / 使用 / 管理', member: '读 / 管理' },
  { role: 'editor', project: '读 / 写', asset: '读 / 写', credential: '读元数据 / 使用', member: '只读' },
  { role: 'viewer', project: '只读', asset: '只读', credential: '无', member: '只读' },
];

const errorStates = [
  {
    code: 'UNAUTHENTICATED',
    status: '401',
    message: '未登录或 session 已失效，界面回到登录态首页。',
  },
  {
    code: 'WORKSPACE_FORBIDDEN',
    status: '403',
    message: '你不属于该工作区，保留上下文提示但不给出越权数据。',
  },
  {
    code: 'PERMISSION_DENIED',
    status: '403',
    message: '属于工作区但没有当前动作权限，按钮可见性与服务端返回一致。',
  },
  {
    code: 'VERSION_CONFLICT',
    status: '409',
    message: '项目或资产更新冲突，界面提示重新拉取最新版本。',
  },
];

const auditItems = [
  '首次登录后自动建档并创建 personal workspace。',
  '创建 / 删除工作区、邀请 / 移除成员。',
  '创建 / 删除项目，归档 / 恢复 Prompt Asset。',
  '创建 / 更新 / 删除 Credential Profile。',
];

const phases = [
  { label: 'Phase 1', title: '登录接入与个人空间', detail: '让系统从匿名单用户过渡到有账号的默认工作区体验。' },
  { label: 'Phase 2', title: '项目数据库化', detail: '项目列表和详情以 workspace 为边界，不再依赖本地文件系统。' },
  { label: 'Phase 3', title: 'Prompt Asset 多用户化', detail: '资产抽屉和历史版本都强制工作区过滤。' },
  { label: 'Phase 4', title: '凭证中心改造', detail: 'API 配置面板改造成凭证选择与轮换流程。' },
  { label: 'Phase 5', title: '团队空间与成员管理', detail: '工作区切换、成员邀请、角色管理进入成品形态。' },
];

function roleClass(role: string) {
  if (role === 'owner') return 'border-amber-200 bg-amber-100 text-amber-900';
  if (role === 'admin') return 'border-sky-200 bg-sky-100 text-sky-900';
  if (role === 'editor') return 'border-emerald-200 bg-emerald-100 text-emerald-900';
  return 'border-slate-200 bg-slate-100 text-slate-700';
}

function statusClass(status: string) {
  if (status === 'published') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'draft') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (status === 'archived') return 'border-slate-200 bg-slate-100 text-slate-700';
  return 'border-slate-200 bg-slate-100 text-slate-700';
}

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="relative isolate">
        <div className="pointer-events-none absolute inset-0">
          <div className="design-float absolute left-[-8rem] top-20 h-64 w-64 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="design-float absolute right-[-6rem] top-32 h-72 w-72 rounded-full bg-emerald-300/20 blur-3xl [animation-delay:-6s]" />
          <div className="design-grid absolute inset-0 opacity-40" />
        </div>

        <div className="relative mx-auto flex max-w-[1620px] flex-col gap-6 px-4 py-4 lg:px-6 lg:py-6">
          <header className="design-rise rounded-[30px] border border-white/60 bg-white/78 p-4 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur xl:p-5 dark:border-white/10 dark:bg-slate-950/60">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f766e_0%,#2563eb_100%)] text-white shadow-lg shadow-cyan-900/20">
                  <Orbit size={28} />
                </div>
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-800">
                      UX 优化版设计稿
                    </span>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                      Multi-Workspace
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                      BFF + Logto + Workspace
                    </span>
                  </div>
                  <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl dark:text-white">
                      AI Context Editor 多用户体验方案
                    </h1>
                    <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                      以架构文档新增的交互要求为中心，重绘登录态首页、工作区切换、权限反馈、凭证选择和错误回路。重点不再是“能看到哪些模块”，而是“当前是谁、在哪个空间、此刻能做什么、失败时如何解释”。
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/editor"
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  查看现有编辑器
                  <ArrowRight size={16} />
                </Link>
                <div className="rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 text-sm text-white shadow-lg shadow-slate-950/15 dark:border-slate-700">
                  当前工作区
                  <div className="mt-1 flex items-center gap-2 text-base font-semibold">
                    <Building2 size={16} className="text-cyan-300" />
                    Luyi Studio
                  </div>
                </div>
              </div>
            </div>
          </header>

          <div className="grid gap-6 xl:grid-cols-[272px_minmax(0,1fr)_360px]">
            <aside className="design-rise space-y-4 rounded-[28px] border border-white/60 bg-white/78 p-4 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.45)] backdrop-blur dark:border-white/10 dark:bg-slate-950/55">
              <div className="rounded-[24px] border border-cyan-100 bg-[linear-gradient(160deg,rgba(236,254,255,0.92)_0%,rgba(239,246,255,0.86)_100%)] p-4 dark:border-cyan-950/50 dark:bg-[linear-gradient(160deg,rgba(8,47,73,0.58)_0%,rgba(15,23,42,0.8)_100%)]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-[0.24em] text-cyan-700 dark:text-cyan-200">
                    Signed In
                  </span>
                  <BadgeCheck size={16} className="text-cyan-700 dark:text-cyan-300" />
                </div>
                <div className="mt-4">
                  <div className="text-lg font-semibold text-slate-950 dark:text-white">Luyi Chen</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    通过 Logto Session 登录。首页需要同时展示当前用户、当前空间和关键权限，不让用户猜上下文。
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <span className="rounded-full bg-white/75 px-2.5 py-1 dark:bg-white/10">owner</span>
                  <span className="rounded-full bg-white/75 px-2.5 py-1 dark:bg-white/10">12 位成员</span>
                  <span className="rounded-full bg-white/75 px-2.5 py-1 dark:bg-white/10">active workspace</span>
                </div>
              </div>

              <nav className="space-y-2">
                {navigation.map((item) => {
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.label}
                      className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm ${
                        item.active
                          ? 'bg-slate-950 text-white shadow-lg shadow-slate-950/10 dark:bg-white dark:text-slate-950'
                          : 'bg-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'
                      }`}
                    >
                      <Icon size={18} />
                      <span className="font-medium">{item.label}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Workflow size={16} />
                  体验改造重点
                </div>
                <ul className="mt-3 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                  <li>登录后直接进入个人空间或最近访问工作区。</li>
                  <li>工作区作为页面级上下文显式存在，而不是暗藏在状态里。</li>
                  <li>按钮显隐、禁用态、错误态与服务端权限模型保持一致。</li>
                  <li>ApiConfigPanel 改造成凭证选择，不再让用户接触完整 secret。</li>
                </ul>
              </div>
            </aside>

            <section className="space-y-6">
              <section className="design-rise rounded-[32px] border border-slate-200/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.94)_0%,rgba(240,249,255,0.9)_48%,rgba(236,253,245,0.88)_100%)] p-5 shadow-[0_30px_90px_-48px_rgba(14,116,144,0.45)] dark:border-slate-800 dark:bg-[linear-gradient(145deg,rgba(15,23,42,0.96)_0%,rgba(8,47,73,0.86)_52%,rgba(6,78,59,0.84)_100%)] lg:p-6">
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-200">
                        Login Home
                      </p>
                      <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
                        登录后首页先交代身份、空间、入口和下一步
                      </h2>
                      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                        架构文档新增“登录态首页”要求后，首页不该只是列表容器，而应承担 onboarding、空间确认和资源入口分发的职责。
                      </p>
                    </div>

                    <div className="rounded-[24px] border border-white/60 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/45">
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">当前路由</div>
                      <div className="mt-2 font-mono text-sm text-slate-800 dark:text-slate-100">
                        /workspace/luyi-studio/dashboard
                      </div>
                      <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">路由、偏好、默认空间三重兜底</div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {keyStats.map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-[24px] border border-white/65 bg-white/78 p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/45"
                      >
                        <div className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">{stat.label}</div>
                        <div className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">{stat.value}</div>
                        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{stat.meta}</div>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="rounded-[28px] border border-white/60 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/45">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold">首次登录与回流路径</div>
                          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            让用户理解为什么会进入某个空间，而不是突然被带到陌生上下文。
                          </div>
                        </div>
                        <BellRing size={18} className="text-cyan-600 dark:text-cyan-300" />
                      </div>
                      <div className="mt-4 space-y-3">
                        {loginTimeline.map((step) => (
                          <div
                            key={step}
                            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                          >
                            {step}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[28px] border border-white/60 bg-slate-950 p-4 text-white shadow-[0_20px_70px_-42px_rgba(15,23,42,0.8)] dark:border-white/10">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold">首页主 CTA</div>
                          <div className="mt-1 text-xs text-slate-300">明确告诉用户接下来能去哪</div>
                        </div>
                        <Sparkles size={18} className="text-cyan-300" />
                      </div>
                      <div className="mt-5 space-y-3">
                        <button className="flex w-full items-center justify-between rounded-2xl bg-white/10 px-4 py-3 text-left text-sm hover:bg-white/14">
                          <span className="flex items-center gap-2">
                            <FolderKanban size={16} />
                            进入当前工作区项目
                          </span>
                          <ArrowRight size={16} />
                        </button>
                        <button className="flex w-full items-center justify-between rounded-2xl bg-white/10 px-4 py-3 text-left text-sm hover:bg-white/14">
                          <span className="flex items-center gap-2">
                            <UserPlus size={16} />
                            邀请成员加入团队空间
                          </span>
                          <ArrowRight size={16} />
                        </button>
                        <button className="flex w-full items-center justify-between rounded-2xl bg-white/10 px-4 py-3 text-left text-sm hover:bg-white/14">
                          <span className="flex items-center gap-2">
                            <KeyRound size={16} />
                            管理共享凭证配置
                          </span>
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                <div className="design-rise rounded-[28px] border border-white/60 bg-white/80 p-5 shadow-[0_20px_70px_-42px_rgba(15,23,42,0.45)] backdrop-blur dark:border-white/10 dark:bg-slate-950/55">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                        Workspace Switcher
                      </p>
                      <h3 className="mt-2 text-xl font-semibold">把工作区切换做成首屏一级动作</h3>
                    </div>
                    <span className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                      Active Workspace
                    </span>
                  </div>

                  <div className="mt-5 rounded-[26px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-950">
                      <div className="flex items-center gap-3">
                        <Building2 size={18} className="text-cyan-700 dark:text-cyan-300" />
                        <div>
                          <div className="font-semibold">Luyi Studio</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">organization · owner</div>
                        </div>
                      </div>
                      <ChevronDown size={16} className="text-slate-500" />
                    </div>

                    <div className="mt-4 space-y-3">
                      {workspaceOptions.map((workspace) => (
                        <article
                          key={workspace.slug}
                          className={`rounded-[22px] border p-4 ${
                            workspace.highlight
                              ? 'border-cyan-200 bg-cyan-50/70 dark:border-cyan-900 dark:bg-cyan-950/20'
                              : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold">{workspace.name}</div>
                              <div className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">
                                /workspaces/{workspace.slug}
                              </div>
                            </div>
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${roleClass(workspace.role)}`}>
                              {workspace.role}
                            </span>
                          </div>
                          <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">{workspace.note}</div>
                          <div className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                            <span>{workspace.type}</span>
                            <span>{workspace.members}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="design-rise rounded-[28px] border border-white/60 bg-white/80 p-5 shadow-[0_20px_70px_-42px_rgba(15,23,42,0.45)] backdrop-blur dark:border-white/10 dark:bg-slate-950/55">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                      Access Contract
                    </p>
                    <h3 className="mt-2 text-xl font-semibold">把“服务端才可信”解释给用户</h3>
                  </div>
                  <div className="mt-5 space-y-3">
                    {[
                      '路由显式带 workspaceSlug，减少“当前在哪个空间”歧义。',
                      '前端只做展示收敛，权限裁决由服务端完成。',
                      '资源操作前先校验 membership、permission 与 resource workspace 一致性。',
                      '所有失败响应都回到统一 error code 和 requestId。',
                    ].map((item) => (
                      <div
                        key={item}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(248,250,252,0.96)_100%)] p-4 dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96)_0%,rgba(15,23,42,0.72)_100%)]">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Route size={16} />
                      推荐资源路径
                    </div>
                    <div className="mt-3 rounded-2xl bg-slate-950 px-4 py-3 font-mono text-xs text-cyan-200">
                      /api/workspaces/luyi-studio/projects
                    </div>
                  </div>
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                <div className="design-rise rounded-[28px] border border-white/60 bg-white/80 p-5 shadow-[0_20px_70px_-42px_rgba(15,23,42,0.45)] backdrop-blur dark:border-white/10 dark:bg-slate-950/55">
                  <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                        Projects & Assets
                      </p>
                      <h3 className="mt-2 text-xl font-semibold">列表视图天然绑定当前工作区</h3>
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">切换空间时项目列表、资产抽屉和历史记录整体刷新</div>
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-3">
                    {projectCards.map((project) => (
                      <article
                        key={project.title}
                        className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(248,250,252,0.96)_100%)] p-4 shadow-sm dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96)_0%,rgba(15,23,42,0.72)_100%)]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-lg font-semibold">{project.title}</div>
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${roleClass(project.role)}`}>
                            {project.role}
                          </span>
                        </div>
                        <div className="mt-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">{project.route}</div>
                        <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">{project.summary}</div>
                        <div className="mt-4 rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                          {project.footer}
                        </div>
                      </article>
                    ))}
                  </div>

                  <div className="mt-6 rounded-[26px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold">PromptAssetDrawer 预览</div>
                        <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          创建、编辑、归档和恢复都默认带当前工作区归属。
                        </div>
                      </div>
                      <button className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-3 py-2 text-sm text-white dark:bg-white dark:text-slate-950">
                        <Plus size={14} />
                        新建资产
                      </button>
                    </div>
                    <div className="mt-4 space-y-3">
                      {assetCards.map((asset) => (
                        <article
                          key={asset.name}
                          className="flex items-start justify-between gap-4 rounded-[22px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Blocks size={16} className="text-teal-700 dark:text-teal-300" />
                              <span className="font-semibold">{asset.name}</span>
                            </div>
                            <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{asset.detail}</div>
                          </div>
                          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(asset.status)}`}>
                            {asset.status}
                          </span>
                        </article>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="design-rise rounded-[28px] border border-white/60 bg-white/80 p-5 shadow-[0_20px_70px_-42px_rgba(15,23,42,0.45)] backdrop-blur dark:border-white/10 dark:bg-slate-950/55">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                      <LockKeyhole size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                        Credential UX
                      </p>
                      <h3 className="mt-1 text-xl font-semibold">ApiConfigPanel 改成凭证选择器</h3>
                    </div>
                  </div>
                  <div className="mt-5 rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(240,253,250,0.96)_100%)] p-4 dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(6,95,70,0.16)_0%,rgba(15,23,42,0.9)_100%)]">
                    <div className="text-sm font-semibold">项目默认凭证</div>
                    <div className="mt-3 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950">
                      <div>
                        <div className="font-semibold">OpenAI Shared Production</div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">provider: OpenAI · secret_last4: 1a7c</div>
                      </div>
                      <ChevronDown size={16} className="text-slate-500" />
                    </div>
                    <div className="mt-4 space-y-3">
                      {credentialProfiles.map((credential) => (
                        <article
                          key={credential.name}
                          className="rounded-[22px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-semibold">{credential.name}</div>
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
                              {credential.scope}
                            </span>
                          </div>
                          <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{credential.detail}</div>
                          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">{credential.permission}</div>
                        </article>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </section>

            <aside className="space-y-6">
              <section className="design-rise rounded-[28px] border border-white/60 bg-white/80 p-5 shadow-[0_20px_70px_-42px_rgba(15,23,42,0.45)] backdrop-blur dark:border-white/10 dark:bg-slate-950/55">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                      Members
                    </p>
                    <h3 className="mt-2 text-xl font-semibold">邀请入口与角色矩阵并列展示</h3>
                  </div>
                  <button className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-3 py-2 text-sm text-white dark:bg-white dark:text-slate-950">
                    <UserPlus size={14} />
                    邀请成员
                  </button>
                </div>

                <div className="mt-5 space-y-3">
                  {members.map((member) => (
                    <article
                      key={member.name}
                      className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold">{member.name}</div>
                          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{member.detail}</div>
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${roleClass(member.role)}`}>
                          {member.role}
                        </span>
                      </div>
                      <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">{member.state}</div>
                    </article>
                  ))}
                </div>

                <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Users size={16} />
                    权限矩阵
                  </div>
                  <div className="mt-4 space-y-3">
                    {permissionMatrix.map((row) => (
                      <article
                        key={row.role}
                        className="rounded-[20px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${roleClass(row.role)}`}>
                            {row.role}
                          </span>
                          <CheckCheck size={16} className="text-slate-400" />
                        </div>
                        <div className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                          <div>项目: {row.project}</div>
                          <div>资产: {row.asset}</div>
                          <div>凭证: {row.credential}</div>
                          <div>成员: {row.member}</div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </section>

              <section className="design-rise rounded-[28px] border border-white/60 bg-white/80 p-5 shadow-[0_20px_70px_-42px_rgba(15,23,42,0.45)] backdrop-blur dark:border-white/10 dark:bg-slate-950/55">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                      Error & Audit
                    </p>
                    <h3 className="mt-2 text-xl font-semibold">统一错误结构和高危动作审计</h3>
                  </div>
                  <ShieldAlert size={18} className="text-cyan-600 dark:text-cyan-300" />
                </div>

                <div className="mt-5 space-y-3">
                  {errorStates.map((error) => (
                    <article
                      key={error.code}
                      className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-mono text-xs text-slate-500 dark:text-slate-400">{error.status}</div>
                        <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200">
                          {error.code}
                        </span>
                      </div>
                      <div className="mt-3 text-sm text-slate-700 dark:text-slate-200">{error.message}</div>
                    </article>
                  ))}
                </div>

                <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <ShieldCheck size={16} />
                    必写审计动作
                  </div>
                  <ul className="mt-3 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                    {auditItems.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </section>

              <section className="design-rise rounded-[28px] border border-white/60 bg-white/80 p-5 shadow-[0_20px_70px_-42px_rgba(15,23,42,0.45)] backdrop-blur dark:border-white/10 dark:bg-slate-950/55">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <PanelLeft size={16} />
                  分阶段落地
                </div>
                <div className="mt-4 space-y-3">
                  {phases.map((phase) => (
                    <article
                      key={phase.label}
                      className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="text-xs uppercase tracking-[0.22em] text-cyan-700 dark:text-cyan-300">{phase.label}</div>
                      <div className="mt-2 font-semibold">{phase.title}</div>
                      <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{phase.detail}</div>
                    </article>
                  ))}
                </div>
              </section>
            </aside>
          </div>

          <section className="design-rise rounded-[28px] border border-white/60 bg-white/78 p-4 shadow-[0_20px_70px_-42px_rgba(15,23,42,0.45)] backdrop-blur dark:border-white/10 dark:bg-slate-950/55">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-sm font-semibold">本轮 UI 优化相对于上一版新增了什么</div>
                <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  新增登录态首页、工作区路由可视化、凭证选择器、统一错误态、邀请成员入口和分阶段落地面板，使设计稿更接近架构文档要求的真实产品体验。
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  登录态首页
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  Workspace Switcher
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  Credential UX
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  Error Contract
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
