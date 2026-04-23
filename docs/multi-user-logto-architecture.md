# AI Context Editor 多用户与 Logto 集成架构方案

## 1. 文档目标

本文定义 `AI Context Editor` 从“本地单用户工具”演进为“支持账号登录、用户隔离、工作区共享”的目标架构，并补充以下可直接落地的后端规范：

1. 多用户系统的身份、租户、权限与数据隔离边界
2. 与 `Logto` 的职责划分与集成方式
3. 后端接口的统一 API 规范
4. 后端技术选型与分阶段演进建议
5. 多用户场景下的 UX 基线、导航模型与关键交互约束
6. 将技术规范写回架构设计，避免后续实现分叉

本文面向产品设计者、UX 设计师、后端技术负责人、架构设计者与后续实现工程师。

## 2. 当前现状与核心问题

基于当前仓库实现，系统已经完成了“从 JSON 到 SQLite”的核心存储迁移，但仍处在“多用户基础设施已落地、完整多租户闭环未完成”的阶段。

当前已完成的部分：

- `Project` 运行时读写已经切到 `SQLite + Drizzle`
- `project_revisions` 已承接历史快照
- `Prompt Asset` 已具备 `workspace_id`、版本表和工作区级索引
- `users`、`workspaces`、`workspace_memberships`、`audit_logs` 已落库
- `resolvePrincipal()`、`requirePermission()` 等服务端鉴权入口已经存在
- `@logto/next`、`sign-in`、`callback`、`sign-out` 基础接入点已经落地

当前仍保留的兼容或过渡部分：

- `app/lib/project-store.ts` 仍存在，但仅用于历史导入与测试，不再是运行时主存储
- `/api/projects`、`/api/prompt-assets` 等旧路由仍存在兼容层，与工作区路由并存
- 本地开发可通过请求头注入 dev session，便于在未配置 Logto 时联调

当前仍未完成的关键能力：

- Logto 组织能力与本地 `workspace` 的正式同步仍未完成
- `credential_profiles` 尚未落库，项目仍存在旧 `apiConfig.apiKey` 兼容语义
- 团队空间成员管理、邀请、角色变更等管理面尚未落地
- 旧兼容接口与新工作区接口并存，主接口边界还需要继续收敛

结论：当前不需要重新设计“存储架构”，真正需要推进的是“认证、授权、接口收敛、凭证中心、组织同步”。

## 3. 设计目标

### 3.1 本期目标

本期目标定义为：

- 支持用户注册、登录、登出
- 支持同一部署下多个用户各自拥有独立数据
- 支持“工作区（Workspace）”作为数据隔离边界
- 支持基于工作区的角色权限
- 支持与 Logto 对接，承接身份认证、组织、多租户能力
- 支持后续扩展到邀请成员、组织切换、企业 SSO
- 支持用户明确感知“当前处于哪个工作区、拥有什么权限、哪些资源是共享的”
- 为后端实现定义明确的接口、分层与错误处理规范

### 3.2 非目标

本期不追求：

- 实时协同编辑
- 复杂审批流
- 字段级权限控制
- 完整 IAM 平台能力
- 多区域多活
- 首期就拆分独立后端微服务

## 4. 总体设计结论

### 4.1 核心架构决策

采用以下总体方案：

- `Logto` 负责认证与组织身份能力
- 应用内部以 `Workspace` 作为业务隔离边界
- 协作型 `Workspace` 与 `Logto Organization` 一一映射
- 个人型 `Workspace` 在应用内自动创建，用于承接“个人空间”
- 后端继续采用 `Next.js BFF` 模式，浏览器只调用本站 `app/api/*`
- 后端从 Logto Session 中解析当前用户，再在本地数据库中解析当前工作区与权限
- 所有业务数据都必须落数据库，并显式携带 `workspace_id`
- 项目不再保存明文 API Key；改为引用独立凭证实体

### 4.2 一句话描述目标形态

> Logto 负责“你是谁、你属于哪些组织”，应用数据库负责“你在当前工作区能做什么、能看到哪些业务数据”。

## 5. 为什么选择 Logto

选择 Logto 的原因不是“只为了登录”，而是因为它同时覆盖了本项目后续一定会需要的几类能力：

- 标准 OIDC/OAuth 认证
- Next.js App Router 集成
- 组织（Organization）能力，适配多租户 SaaS
- 组织模板、组织角色、组织权限
- 组织级 API 资源保护
- 邀请成员、组织创建、JIT Provisioning、企业 SSO 等后续扩展能力

对本项目而言，Logto 最重要的价值是：

- 现在先用它完成认证接入
- 下一阶段可直接用它承接多租户组织模型
- 再下一阶段可以复用它做组织成员管理和企业接入

## 6. 目标业务模型

### 6.1 核心对象

系统统一使用以下业务对象：

#### User

- 表示一个真实登录用户
- 来源于 Logto 用户主体
- 应用内保留一份本地影子记录

#### Workspace

- 表示业务隔离单元
- 所有 `Project`、`Prompt Asset`、`Credential` 都归属于某个 `Workspace`
- 分为两类：
  - `personal`：个人空间
  - `organization`：团队空间

#### Membership

- 表示某个用户在某个工作区中的成员关系
- 包含角色、状态、加入时间等信息

#### Project

- 当前编辑器中的项目主体
- 归属到 `workspace_id`

#### PromptAsset

- 提示词资产
- 归属到 `workspace_id`

#### CredentialProfile

- 模型访问凭证配置
- 用于替代当前项目中的明文 `apiKey`

### 6.2 关键业务语义

- 用户登录后，至少拥有 1 个 `personal workspace`
- 用户可以属于多个 `organization workspace`
- 当前界面上的“项目列表、提示词资产库、历史记录”都必须以当前 `workspace` 为视图边界
- 工作区切换后，页面中的业务数据整体切换

## 7. Logto 与应用的职责划分

### 7.1 Logto 负责

- 用户认证
- 登录态维护
- 用户基础 Claims
- 组织（Organization）生命周期能力
- 组织成员与组织角色
- 企业 SSO / JIT / 邀请等身份侧能力

### 7.2 应用负责

- 本地业务对象持久化
- 工作区内业务权限判定
- 业务数据过滤
- 业务审计日志
- 模型凭证加密存储与使用
- 业务侧“当前工作区”上下文解析

### 7.3 为什么不能把授权完全外包给 Logto

因为 Logto 擅长的是身份与标准 RBAC，不负责你的业务数据查询模型。即使拿到了组织角色，应用后端仍然必须自己决定：

- 当前请求访问的是哪个工作区
- 这个工作区是否与用户当前身份匹配
- 当前资源是否归属这个工作区
- 某项业务动作是否允许执行

因此，正确模式不是“前端拿到 token 就直接信任”，而是“后端基于 session claims + 本地 membership + 资源归属做二次裁决”。

## 8. 身份与多租户模型设计

### 8.1 认证模型

Web 端采用 Logto 的 `Traditional Web App` 集成方式，使用 `@logto/next` 接入 Next App Router。

建议配置：

- 应用类型：`Traditional`
- 协议：OIDC
- Session：HttpOnly Cookie
- 基础 scopes：`openid profile email offline_access`
- 组织相关 scope：`urn:logto:scope:organizations`

### 8.2 租户模型

采用“双层模型”：

- 身份租户层：Logto `Organization`
- 业务租户层：应用内 `Workspace`

映射规则：

- `Workspace.type = organization` 时，必须存在 `logto_organization_id`
- `Workspace.type = personal` 时，不依赖 Logto Organization

这样设计的原因：

- 个人空间不需要创建大量组织对象，首登体验更轻
- 团队空间可以完整复用 Logto 的组织、成员、角色、邀请、企业 SSO 能力
- 业务侧仍然统一使用 `workspace_id` 做数据隔离，不会出现“双重过滤分裂”

### 8.3 当前工作区上下文

每个请求都要解析一个 `Active Workspace`。

来源优先级建议如下：

1. 路由中的 `workspaceSlug`
2. 用户最近一次选择的工作区偏好
3. 默认个人空间

无论来源如何，后端都必须再次校验：

- 该工作区是否存在
- 当前用户是否属于该工作区
- 当前资源是否属于该工作区

## 9. 权限模型设计

### 9.1 角色设计

建议统一 4 个工作区角色：

- `owner`
- `admin`
- `editor`
- `viewer`

### 9.2 权限建议

建议将权限抽象为业务动作，而不是页面名称：

- `project:read`
- `project:write`
- `project:delete`
- `prompt_asset:read`
- `prompt_asset:write`
- `prompt_asset:archive`
- `credential:read_meta`
- `credential:use`
- `credential:manage`
- `member:read`
- `member:manage`
- `workspace:manage`

### 9.3 角色到权限的默认映射

建议作为后端静态配置维护一份默认权限矩阵：

| Role | project:read | project:write | project:delete | prompt_asset:read | prompt_asset:write | prompt_asset:archive | credential:read_meta | credential:use | credential:manage | member:read | member:manage | workspace:manage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `owner` | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| `admin` | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| `editor` | Y | Y | N | Y | Y | N | Y | Y | N | Y | N | N |
| `viewer` | Y | N | N | Y | N | N | N | N | N | Y | N | N |

说明：

- `owner` 与 `admin` 的差异主要留给后续“转移所有权、删除工作区”等高危操作
- `personal workspace` 固定将当前用户视为 `owner`
- 具体权限判断仍由服务端完成，前端只做展示层收敛

### 9.4 Logto 中的角色映射

在 Logto 的 `Organization template` 中配置组织角色：

- `owner`
- `admin`
- `editor`
- `viewer`

本项目建议采用“Logto 为主数据源，本地 membership 为查询投影”的做法：

- `organization workspace` 使用 Logto 组织角色作为主数据源
- 本地 membership 做缓存和查询投影
- `personal workspace` 直接在本地固定为 `owner`

### 9.5 多用户 UX 目标

多用户方案不能只停留在“后端能鉴权”，还必须让用户在界面上持续理解当前上下文。

本项目 UX 目标定义如下：

- 用户始终知道自己当前位于哪个 `workspace`
- 用户能清楚区分“个人空间”与“团队空间”
- 用户能提前感知自己是否可编辑、可管理成员、可管理共享凭证
- 工作区切换应当是低成本、低风险、可恢复的动作，而不是“像切账号”
- 团队协作的主路径应收敛为“创建空间 -> 邀请成员 -> 分配角色 -> 开始共享”
- 个人凭证与工作区共享凭证必须明确区分，避免误以为“团队都能用”

### 9.6 信息架构与导航模型

建议将 `Workspace` 提升为全局一级上下文，而不是埋在设置页中。

界面结构建议如下：

- 顶部或左侧全局壳层固定提供 `Workspace Switcher`
- `Workspace Switcher` 按“个人空间 / 团队空间”分组展示
- 每个工作区条目至少展示：`name`、`type`、`myRole`
- 当前工作区名称需要在页面标题区再次出现，避免用户只在切换器里看到一次
- 团队空间下显式暴露 `成员`、`凭证`、`设置` 等协作入口
- 个人空间下弱化成员管理入口，避免出现“空团队管理”噪音

推荐前端业务路由显式带上 `workspaceSlug`：

- `/w/:workspaceSlug/projects`
- `/w/:workspaceSlug/prompt-assets`
- `/w/:workspaceSlug/credentials`
- `/w/:workspaceSlug/members`
- `/w/:workspaceSlug/settings`

这样做的价值是：

- URL 本身即可表达当前租户上下文
- 深链接分享、刷新、返回时不丢失工作区语义
- 用户更不容易把“同名项目在不同空间下”误判为同一份数据

### 9.7 关键用户流设计

#### 首次登录

- 用户首次登录后自动获得 `personal workspace`
- 首屏优先进入个人空间，而不是要求先创建团队
- 若个人空间为空，空状态应提供两个主动作：
  - `创建项目`
  - `创建团队空间`
- 不应在首次进入时同时弹出多层引导或权限说明弹窗

#### 工作区切换

- 切换器应支持搜索与最近访问排序
- 若目标工作区存在当前模块对应页面，则尽量保持模块不变，只切换 `workspaceSlug`
- 若目标工作区不存在当前资源，则回退到该工作区的模块列表页，而不是停留在无权限死链
- 切换后应有清晰的页面标题与面包屑更新，避免用户误以为“数据消失”

#### 创建团队空间

- 创建流程收敛为最少字段：`name`、`slug`
- 创建成功后直接进入新团队空间
- 首个落点建议为该工作区的 `projects` 空状态页
- 页面内提供次级行动：`邀请成员`

#### 邀请与成员管理

- 成员页必须同时展示 `active` 与 `invited` 两类状态
- 邀请动作完成后，列表中立即出现“待接受”成员，而不是只给 toast
- 角色修改应在成员列表内可完成，不强制跳转二级页面
- 移除成员、降权、转移所有权属于高风险动作，确认弹窗必须显示工作区名与目标成员标识

### 9.8 权限感知与错误反馈

前端不应自己维护一份角色矩阵副本，而应消费服务端返回的能力集合。

具体 UX 约束如下：

- 页面初始化后即获得当前用户在当前工作区的 `permissions[]` 或 `capabilities`
- `viewer` 可进入空间并查看资源，但写操作按钮默认禁用并提供原因说明
- 当用户因角色不足无法执行动作时，优先展示“为什么不能做”，而不是点击后才返回通用报错
- 当用户被移出工作区、链接失效或资源不属于当前工作区时，页面应提供 `切换工作区` 或 `返回列表` 的恢复动作
- 所有高风险确认框必须同时展示 `workspace name + resource name`
- 当前会话中的成员角色若发生变化，前端需在下次导航或接口返回后刷新权限态，避免按钮状态长期失真

### 9.9 共享边界的可视化要求

多用户场景里最容易产生误解的不是“有没有登录”，而是“这个东西到底是我的还是团队的”。

因此以下对象必须显式标注归属：

- `Project`：显示当前归属工作区
- `Prompt Asset`：显示当前归属工作区
- `Credential`：区分 `personal` 与 `workspace`

凭证选择器建议采用分组展示：

- `我的私有凭证`
- `工作区共享凭证`

并增加以下 UX 约束：

- 共享凭证只返回元数据，不向前端返回 secret
- 团队空间里的项目如果引用私有凭证，必须显示“仅你可用”标识
- 当用户为团队项目选择私有凭证时，应明确提示其他成员无法直接复用该配置

### 9.10 UX 对接口契约的反向约束

为了支撑上述交互，后端接口不能只返回“能不能请求成功”，还要返回足够的上下文字段。

必须满足以下约束：

- 会话接口能返回当前用户的 `activeWorkspace` 与最小权限信息
- 工作区列表接口能支撑切换器展示，不要求前端二次拼装多个来源
- 成员接口必须区分 `active`、`invited`、`suspended` 等状态
- 权限失败接口除了错误码，还应返回可被前端消费的恢复方向
- 所有资源详情接口都应返回 `workspace` 摘要信息，用于页面顶部上下文展示

## 10. 请求链路设计

### 10.1 页面访问链路

```text
Browser
  -> Next Server Component / Route Handler
  -> getLogtoContext()
  -> requireSession()
  -> resolvePrincipal()
  -> resolveActiveWorkspace()
  -> requirePermission()
  -> service
  -> repository
  -> database
```

### 10.2 API 访问原则

浏览器不直接携带第三方 access token 调业务 API，而是统一调用本站 API：

- 前端职责更简单
- 减少 token 暴露面
- 权限判定集中在服务端
- 更适合当前单体 Next.js 应用

### 10.3 统一鉴权入口

建议新增统一服务端帮助函数：

- `requireSession()`
- `requirePrincipal()`
- `requireWorkspaceAccess()`
- `requirePermission(permission)`
- `requireResourceInWorkspace(resourceWorkspaceId)`

其中 `principal` 至少包含：

- `userId`
- `logtoUserId`
- `activeWorkspaceId`
- `activeWorkspaceSlug`
- `activeWorkspaceType`
- `workspaceRole`
- `permissions[]`

### 10.4 不信任前端传入的 `workspace_id`

所有读写接口都可以接收资源 ID 或工作区 slug，但不能直接信任请求体里的 `workspace_id`。

正确流程必须是：

1. 服务端解析当前用户
2. 服务端解析当前工作区
3. 服务端查询资源所属工作区
4. 服务端确认资源与当前工作区一致
5. 服务端再执行操作

## 11. 后端技术规范

本节定义后端实现时必须遵守的技术约束，而不是可选建议。

### 11.1 后端形态与技术选型

当前阶段推荐如下：

- 应用形态：`Next.js BFF + Route Handlers`
- 语言：`TypeScript`
- 认证 SDK：`@logto/next`
- 参数校验：`zod`
- ORM：`drizzle-orm`
- 迁移工具：`drizzle-kit`
- 开发数据库：`SQLite + better-sqlite3`
- 生产数据库：`PostgreSQL`
- 日志：结构化 JSON 日志
- 测试：`vitest`

选择理由：

- 当前代码库已经采用 `Next.js + TypeScript + Drizzle`
- `Project` 与 `Prompt Asset` 运行时都已统一到 `SQLite + Drizzle`
- 当前剩余核心成本在身份、授权与接口收敛，而不是再做一次存储迁移
- 生产环境一旦进入多人共享或多实例部署，`PostgreSQL` 比 `SQLite` 更稳妥

### 11.2 技术选项指导

#### 为什么当前不建议立刻拆独立后端服务

当前项目仍处于单体演进阶段，过早拆分会引入额外复杂度：

- 登录态在 BFF 内处理更直接
- 前后端接口变更更集中
- 工作区上下文与权限判断更容易统一
- 当前规模不足以支撑微服务收益

结论：

- `Phase 1` 到 `Phase 4` 保持单体 BFF
- 只有当出现“多端复用独立业务 API”或“高并发后台任务”时，再考虑拆服务

#### 为什么生产环境建议切 PostgreSQL

`SQLite` 适合开发、测试和单机内部试运行，但不适合作为多人共享生产主库的长期解法，原因包括：

- 文件级锁对并发写入不友好
- 多实例部署下共享存储复杂
- 备份、恢复、监控、在线变更能力较弱
- 团队空间、审计、成员管理上线后写压力与关联查询会增加

结论：

- 开发环境：允许 `SQLite`
- CI 测试：允许 `SQLite`
- 生产环境：进入团队协作阶段前切换 `PostgreSQL`

#### 缓存与队列

当前阶段不强制引入 `Redis` 或消息队列。

建议：

- 认证、授权、工作区查询先直接访问主库
- Logto 同步先采用“请求时懒同步 + 定时校准”
- 只有当出现明显性能瓶颈或后台重试需求时，再引入 `Redis` / `BullMQ` / 外部 Job 系统

#### 密钥管理

凭证 secret 必须服务端加密存储。

建议分层如下：

- 开发环境：使用 `APP_SECRET_ENCRYPTION_KEY` 执行 `AES-256-GCM`
- 生产环境：优先使用云 KMS 托管主密钥
- 应用数据库只保存密文、随机 IV、认证标签与 `secret_last4`

### 11.3 分层规范

后端必须遵循以下分层，禁止把业务规则散落到 Route Handler 中：

- `Route Handler`
  - 负责认证入口、解析参数、调用 service、返回 HTTP 响应
- `Service`
  - 负责业务规则、事务边界、权限校验、审计日志、并发控制
- `Repository`
  - 负责数据库读写与查询组合
- `Schema / Validator`
  - 负责请求参数和领域对象校验

约束：

- `Route Handler` 不直接写 SQL
- `Repository` 不做权限判断
- `Service` 不信任来自前端的权限与归属字段
- 所有跨表写操作必须在 `Service` 层定义事务边界

### 11.4 统一字段规范

后端资源表与 API 契约应统一以下约定：

- 主键：统一使用 `ULID` 或同一风格的字符串主键
- 时间字段：
  - 数据库存储统一使用 Unix epoch ms
  - API 输出统一使用 ISO 8601 字符串
- 软删除：
  - 使用 `deleted_at` 标记
  - 默认列表查询不返回软删除数据
- 审计字段：
  - `created_at`
  - `updated_at`
  - `created_by`
  - `updated_by`

### 11.5 事务与并发规范

必须明确以下后端约束：

- 资源创建与首个版本写入必须在同一事务中完成
- 工作区创建与本地 membership 创建必须在同一事务中完成
- 调用外部 Logto Management API 的流程必须具备补偿逻辑
- 版本化资源必须支持乐观并发控制

建议：

- `Project` 和 `Prompt Asset` 更新时使用 `expectedVersion` 或 `updatedAt` 做冲突检测
- 冲突返回 `409 Conflict`
- 所有命令型接口都要明确是否幂等

### 11.6 输入校验规范

所有请求都必须经过显式参数校验：

- `query`、`page`、`pageSize`、`status` 等查询参数在进入 service 前完成校验
- `name`、`description`、`content` 等业务字段由 `zod` 做结构校验
- 字段裁剪、空白处理、默认值注入在校验层完成

禁止：

- 直接把 `request.json()` 结果传给 repository
- 用数据库异常替代业务校验
- 将第三方 SDK 抛错直接透传到 HTTP 响应

### 11.7 可观测性规范

后端必须具备基础可观测能力：

- 每个请求生成或透传 `request_id`
- 结构化日志至少包含 `request_id`、`user_id`、`workspace_id`、`route`、`status_code`、`latency_ms`
- 高危动作写入 `audit_logs`
- 外部依赖调用记录 `provider`、`target`、`result`

### 11.8 测试规范

至少覆盖以下层次：

- `Route Handler`：参数校验、状态码、错误码、响应结构
- `Service`：权限、事务、并发冲突、业务规则
- `Repository`：工作区过滤、排序、分页、唯一约束
- 兼容导入：旧 `project.json` 导入 SQLite 后的数据一致性

### 11.9 不建议的方案

以下做法不建议采用：

- 将业务授权完全依赖 Logto claims，不落本地 membership
- 长期以文件系统存储 `Project`
- 在多个模块中混用不同 ID 风格、时间格式、错误结构
- 将完整 secret 返回给前端
- 为了“未来可能拆服务”而提前引入过重的微服务框架

## 12. API 设计规范

本节定义统一 API 契约。后续所有后端接口都应遵循本节，而不是各模块自行发明风格。

### 12.1 路由设计原则

采用“工作区资源显式入路径”的风格：

- 非工作区资源：
  - `/api/me`
  - `/api/workspaces`
- 工作区资源：
  - `/api/workspaces/:workspaceSlug/projects`
  - `/api/workspaces/:workspaceSlug/prompt-assets`
  - `/api/workspaces/:workspaceSlug/credentials`
  - `/api/workspaces/:workspaceSlug/members`
  - `/api/workspaces/:workspaceSlug/aigc-rewrite/generate`

原因：

- 路由层就明确当前业务上下文
- 前端缓存与服务端日志更易分析
- 避免把“当前工作区”完全藏在 session 偏好里

当前仓库状态补充说明：

- `/api/workspaces/:workspaceSlug/*` 是后续收敛的主接口形态
- `/api/projects`、`/api/prompt-assets` 等旧路由仍作为兼容层存在
- 兼容层不应继续承载新能力，后续新增功能只进入工作区路由

### 12.2 请求头规范

通用请求头：

- `Content-Type: application/json`
- `X-Request-Id: <uuid>` 可选，客户端不传则服务端生成

幂等请求头：

- `Idempotency-Key: <opaque-string>`

说明：

- `Authorization` 不直接用于浏览器到本站 BFF 的常规请求
- 登录态以服务端 Session Cookie 为主

### 12.3 成功响应结构

除流式接口外，所有成功响应统一为：

```json
{
  "data": {}
}
```

列表接口统一为：

```json
{
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 0
    }
  }
}
```

如需要额外元信息，可增加 `meta`：

```json
{
  "data": {},
  "meta": {
    "requestId": "req_123"
  }
}
```

流式接口例外说明：

- 如 AI 生成、导出流等场景需要 `text/event-stream`，允许不使用 `{"data": ...}` 包裹
- 但事件体仍应使用平台稳定字段，例如 `requestId`、`code`、`message`
- 新增流式接口仍必须遵守工作区显式路由、鉴权和错误码规范

### 12.4 失败响应结构

所有失败响应统一为：

```json
{
  "error": {
    "code": "WORKSPACE_FORBIDDEN",
    "message": "You do not have access to this workspace",
    "details": null,
    "requestId": "req_123"
  }
}
```

约束：

- `code` 使用稳定机器码
- `message` 面向前端与排障，禁止泄露内部堆栈
- `details` 用于字段级错误或冲突细节
- `requestId` 便于日志追踪

### 12.5 通用错误码规范

| HTTP Status | code | 说明 |
| --- | --- | --- |
| `400` | `BAD_REQUEST` | 请求格式错误 |
| `401` | `UNAUTHENTICATED` | 未登录或 session 无效 |
| `403` | `WORKSPACE_FORBIDDEN` | 不属于工作区或无权访问 |
| `403` | `PERMISSION_DENIED` | 属于工作区但无对应权限 |
| `404` | `RESOURCE_NOT_FOUND` | 资源不存在 |
| `409` | `RESOURCE_CONFLICT` | 唯一约束或状态冲突 |
| `409` | `VERSION_CONFLICT` | 乐观锁冲突 |
| `422` | `VALIDATION_FAILED` | 字段值不满足业务规则 |
| `429` | `RATE_LIMITED` | 频率限制 |
| `500` | `INTERNAL_ERROR` | 未分类服务端错误 |
| `502` | `UPSTREAM_ERROR` | 第三方依赖调用失败 |

模块错误码命名规范：

- `PROJECT_*`
- `PROMPT_ASSET_*`
- `CREDENTIAL_*`
- `WORKSPACE_*`
- `MEMBER_*`
- `AIGC_REWRITE_*`

例如：

- `PROJECT_NOT_FOUND`
- `PROMPT_ASSET_VERSION_CONFLICT`
- `CREDENTIAL_SECRET_REQUIRED`
- `WORKSPACE_SLUG_TAKEN`
- `AIGC_REWRITE_CONFIG_MISSING`

### 12.6 分页、排序、过滤规范

默认采用页码分页：

- `page`: 默认 `1`
- `pageSize`: 默认 `20`
- `pageSize` 上限：`100`

排序参数规范：

- `sortBy` 只允许白名单字段，例如 `updatedAt`、`createdAt`、`name`
- `sortOrder` 只允许 `asc` 或 `desc`

过滤参数规范：

- `status` 使用枚举值，不接受自由文本
- 搜索字段统一使用 `query`

### 12.7 幂等规范

以下接口必须支持幂等：

- `POST /api/workspaces`
- `POST /api/workspaces/:workspaceSlug/members`
- 调用外部 Logto 管理能力的命令型接口

规则：

- 客户端传入 `Idempotency-Key`
- 服务端在一定时间窗口内记录相同 key 的执行结果
- 同 key 的重复请求返回首次结果，避免重复建组织、重复邀请

### 12.8 工作区解析规范

对所有 `/api/workspaces/:workspaceSlug/*` 请求，服务端执行固定步骤：

1. 校验 session
2. 根据 `workspaceSlug` 读取工作区
3. 校验用户 membership
4. 解析角色与权限
5. 执行业务逻辑

任何模块都不能绕过这一入口直接依赖前端传来的 `workspace_id`。

## 13. 核心 API 规范

以下是本项目第一阶段到第五阶段需要稳定下来的核心接口。

通用补充要求：

- 所有单资源详情接口建议返回 `workspace: { id, slug, name, type }` 摘要
- 所有列表接口建议在 `meta` 中返回当前工作区信息，减少前端重复拼接上下文

### 13.1 会话与当前用户

#### `GET /api/me`

用途：

- 获取当前登录用户、当前工作区以及全局导航初始化所需信息

响应示例：

```json
{
  "data": {
    "user": {
      "id": "01J...",
      "email": "user@example.com",
      "name": "Alice",
      "avatarUrl": null
    },
    "activeWorkspace": {
      "id": "01J...",
      "slug": "alice",
      "name": "Alice",
      "type": "personal",
      "role": "owner",
      "permissions": ["project:read", "project:write", "credential:use"]
    },
    "pendingInvitationCount": 1
  }
}
```

说明：

- `activeWorkspace` 用于首屏渲染、标题区上下文与权限态初始化
- 更完整的工作区列表由 `GET /api/workspaces` 提供

#### `GET /api/workspaces`

用途：

- 获取当前用户可访问的工作区列表

返回字段：

- `id`
- `slug`
- `name`
- `type`
- `role`
- `isDefault`
- `memberCount`
- `status`
- `lastVisitedAt`

补充要求：

- 该接口返回结果应可直接驱动 `Workspace Switcher`
- 至少支持按最近访问排序，减少高频切换成本

#### `POST /api/workspaces`

用途：

- 创建团队工作区

请求体：

```json
{
  "name": "AI Team",
  "slug": "ai-team"
}
```

约束：

- 需要登录
- 自动为当前用户创建 `owner` membership
- 同时创建本地 `workspace` 与 Logto `organization`
- 必须支持幂等
- 成功后返回可直接跳转的工作区信息，避免前端再次查询才能落页

### 13.2 Project API

#### 路由总览

- `GET /api/workspaces/:workspaceSlug/projects`
- `POST /api/workspaces/:workspaceSlug/projects`
- `GET /api/workspaces/:workspaceSlug/projects/:projectId`
- `PATCH /api/workspaces/:workspaceSlug/projects/:projectId`
- `DELETE /api/workspaces/:workspaceSlug/projects/:projectId`
- `GET /api/workspaces/:workspaceSlug/projects/:projectId/revisions`
- `POST /api/workspaces/:workspaceSlug/projects/:projectId/restore`

#### `GET /api/workspaces/:workspaceSlug/projects`

查询参数：

- `query?: string`
- `page?: number`
- `pageSize?: number`
- `sortBy?: 'updatedAt' | 'createdAt' | 'name'`
- `sortOrder?: 'asc' | 'desc'`

返回字段：

- `id`
- `name`
- `updatedAt`
- `createdAt`
- `createdBy`
- `updatedBy`
- `latestRevisionId`

#### `POST /api/workspaces/:workspaceSlug/projects`

请求体：

```json
{
  "name": "Customer Support Bot",
  "systemPrompt": "...",
  "defaultCredentialId": "01J..."
}
```

规则：

- 权限要求：`project:write`
- `defaultCredentialId` 如果存在，必须属于当前工作区且当前用户有 `credential:use`
- 创建项目与创建首个 revision 必须在同一事务中完成

#### `PATCH /api/workspaces/:workspaceSlug/projects/:projectId`

请求体：

```json
{
  "name": "Customer Support Bot v2",
  "systemPrompt": "...",
  "defaultCredentialId": "01J...",
  "expectedRevisionId": "01J..."
}
```

规则：

- 权限要求：`project:write`
- 使用 `expectedRevisionId` 做乐观并发控制
- 冲突返回 `409 PROJECT_VERSION_CONFLICT`

#### `DELETE /api/workspaces/:workspaceSlug/projects/:projectId`

规则：

- 逻辑删除
- 权限要求：`project:delete`
- 返回 `204 No Content`

### 13.3 Prompt Asset API

为避免多份契约并存，`Prompt Asset` 第一阶段接口定义统一收敛为工作区路由：

- `GET /api/workspaces/:workspaceSlug/prompt-assets`
- `POST /api/workspaces/:workspaceSlug/prompt-assets`
- `GET /api/workspaces/:workspaceSlug/prompt-assets/:assetId`
- `POST /api/workspaces/:workspaceSlug/prompt-assets/:assetId/versions`
- `GET /api/workspaces/:workspaceSlug/prompt-assets/:assetId/versions`
- `GET /api/workspaces/:workspaceSlug/prompt-assets/:assetId/versions/:versionId`
- `POST /api/workspaces/:workspaceSlug/prompt-assets/:assetId/restore`
- `POST /api/workspaces/:workspaceSlug/prompt-assets/:assetId/archive`
- `POST /api/workspaces/:workspaceSlug/prompt-assets/:assetId/unarchive`

补充规则：

- 所有读写必须基于当前工作区过滤
- `create`、`archive`、`restore`、`new version` 都需要记录 `actor`
- 模块错误码沿用现有 `PROMPT_ASSET_*` 风格，但必须补充工作区鉴权失败的通用错误码

#### `POST /api/workspaces/:workspaceSlug/prompt-assets`

请求体：

```json
{
  "name": "客服总结模板",
  "description": "用于整理会话摘要",
  "content": "..."
}
```

规则：

- 权限要求：`prompt_asset:write`
- 创建资产与初始版本在同一事务中完成

### 13.4 Credential API

#### 路由总览

- `GET /api/workspaces/:workspaceSlug/credentials`
- `POST /api/workspaces/:workspaceSlug/credentials`
- `GET /api/workspaces/:workspaceSlug/credentials/:credentialId`
- `PATCH /api/workspaces/:workspaceSlug/credentials/:credentialId`
- `POST /api/workspaces/:workspaceSlug/credentials/:credentialId/rotate-secret`
- `DELETE /api/workspaces/:workspaceSlug/credentials/:credentialId`

#### `GET /api/workspaces/:workspaceSlug/credentials`

返回字段不包含完整 secret，只返回：

- `id`
- `name`
- `provider`
- `baseUrl`
- `model`
- `scopeType`
- `secretLast4`
- `updatedAt`

#### `POST /api/workspaces/:workspaceSlug/credentials`

请求体：

```json
{
  "name": "OpenAI Shared",
  "provider": "openai",
  "baseUrl": "https://api.openai.com/v1",
  "model": "gpt-5",
  "secret": "sk-***",
  "scopeType": "workspace"
}
```

规则：

- `scopeType = workspace` 需要 `credential:manage`
- `scopeType = personal` 仅当前用户可见
- secret 入库前必须加密
- 响应中不得回显完整 secret

### 13.5 Membership API

#### 路由总览

- `GET /api/workspaces/:workspaceSlug/members`
- `POST /api/workspaces/:workspaceSlug/members`
- `PATCH /api/workspaces/:workspaceSlug/members/:membershipId`
- `DELETE /api/workspaces/:workspaceSlug/members/:membershipId`

#### `POST /api/workspaces/:workspaceSlug/members`

请求体：

```json
{
  "email": "member@example.com",
  "role": "editor"
}
```

规则：

- 权限要求：`member:manage`
- 团队空间下需要同步到 Logto organization
- 必须支持幂等，避免重复邀请

成员列表与详情至少需要支持以下字段：

- `membershipId`
- `userId`
- `email`
- `name`
- `avatarUrl`
- `role`
- `status`
- `invitedBy`
- `joinedAt`
- `lastActiveAt`

其中：

- `status` 至少包括 `active`、`invited`、`suspended`
- `invited` 状态必须可被成员页直接展示，支撑“邀请已发出但尚未接受”的 UX

## 14. 数据库架构设计

### 14.1 总体结论

当前运行时存储已经统一到 `SQLite`，不需要再次设计“Project 从 JSON 迁移到数据库”的方案。

推荐目标：

- 开发环境可继续用 SQLite
- 生产环境建议切到 PostgreSQL
- ORM 继续使用 Drizzle，避免模型层重写

原因：

- 多用户查询、过滤、分页、权限校验都需要关系型查询能力
- 现有运行时读写已经在数据库层收口
- 历史版本、审计日志、成员关系都天然适合关系模型
- 需要额外治理的是部署拓扑、并发写与生产运维，而不是存储模型本身

### 14.2 推荐表模型

### users

- `id`
- `logto_user_id` unique
- `email`
- `name`
- `avatar_url`
- `status`
- `last_login_at`
- `created_at`
- `updated_at`

### workspaces

- `id`
- `type` (`personal` / `organization`)
- `name`
- `slug`
- `owner_user_id` nullable
- `logto_organization_id` nullable unique
- `status`
- `created_at`
- `updated_at`

约束：

- `personal` 工作区必须有 `owner_user_id`
- `organization` 工作区必须有 `logto_organization_id`
- `slug` 全局唯一

### workspace_memberships

- `id`
- `workspace_id`
- `user_id`
- `role`
- `status`
- `joined_at`
- `invited_by`
- `created_at`
- `updated_at`

唯一约束：

- `(workspace_id, user_id)` 唯一

### projects

- `id`
- `workspace_id`
- `name`
- `system_prompt`
- `default_credential_id` nullable
- `current_revision_id`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`
- `deleted_at`
- `row_version`

### project_revisions

- `id`
- `project_id`
- `workspace_id`
- `revision_number`
- `history_key`
- `name_snapshot`
- `system_prompt`
- `messages_json`
- `api_config_json`
- `content_hash`
- `operation_type`
- `source_revision_id`
- `created_by`
- `created_at`
- `legacy_source_path`

说明：

- 运行时历史版本已由 `project_revisions` 承接
- `workspace_id` 冗余存储用于快速隔离校验和查询
- `(project_id, revision_number)` 唯一

### prompt_assets

- `id`
- `workspace_id`
- `name`
- `normalized_name`
- `description`
- `current_version_number`
- `status`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`
- `archived_at`

说明：

- 当前实现已经按工作区维度唯一约束 `normalized_name`
- 归档状态在主表中维护，版本表承接历史内容

### prompt_asset_versions

- `id`
- `asset_id`
- `workspace_id`
- `version_number`
- `name_snapshot`
- `description_snapshot`
- `content`
- `change_note`
- `content_hash`
- `operation_type`
- `source_version_id`
- `created_by`
- `created_at`

### credential_profiles

- `id`
- `workspace_id`
- `owner_user_id` nullable
- `name`
- `provider`
- `base_url`
- `model`
- `encrypted_secret`
- `secret_iv`
- `secret_auth_tag`
- `secret_last4`
- `scope_type` (`personal` / `workspace`)
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`
- `deleted_at`

说明：

- `scope_type = personal` 表示仅本人可见可用
- `scope_type = workspace` 表示工作区共享凭证
- `encrypted_secret` 必须服务端加密存储

### audit_logs

- `id`
- `workspace_id`
- `actor_user_id`
- `entity_type`
- `entity_id`
- `action`
- `payload_json`
- `created_at`

### 14.3 关键索引

必须建立以下索引：

- `projects(workspace_id, deleted_at, updated_at desc)`
- `project_revisions(project_id, created_at desc)`
- `prompt_assets(workspace_id, status, updated_at desc)`
- `workspace_memberships(user_id, status)`
- `workspace_memberships(workspace_id, role, status)`
- `credential_profiles(workspace_id, scope_type, deleted_at)`
- `audit_logs(workspace_id, created_at desc)`

## 15. 凭证与密钥模型

这是本次改造里最容易被忽略、但风险最高的一块。

### 15.1 当前问题

当前 `Project` 持有：

- `baseUrl`
- `apiKey`
- `model`

这在单用户本地工具里勉强成立，但在多用户场景会出现两个问题：

- 项目共享即凭证共享
- 任何拥有项目读权限的人都可能看到 API Key

### 15.2 目标方案

改成“两层模型”：

- `Project` 只保存“选择了哪个凭证配置”
- 真正 secret 存在 `credential_profiles`

### 15.3 使用规则

- 个人空间下，默认使用用户私有凭证
- 团队空间下，可选择用户私有凭证或工作区共享凭证
- 使用共享凭证需要 `credential:use`
- 管理共享凭证需要 `credential:manage`

### 15.4 安全要求

- secret 仅服务端可解密
- 前端永不回显完整 API Key
- 日志中不打印 secret
- 导出项目时不包含 secret
- 凭证轮换使用独立命令接口，不与元数据更新混在一起

## 16. Prompt Asset 当前状态与后续工作

`Prompt Asset` 已经是当前仓库里最接近目标形态的多用户模块之一。

当前已完成：

1. `prompt_assets` 与 `prompt_asset_versions` 已带 `workspace_id`
2. 工作区路由 `/api/workspaces/:workspaceSlug/prompt-assets/*` 已存在
3. 版本表、归档状态、工作区级唯一约束已落库
4. 服务端已通过 `resolvePrincipal()` 和 `requirePermission()` 接入基础鉴权

后续仍需推进：

1. 将旧 `/api/prompt-assets/*` 兼容路由逐步下线
2. 完整校验所有动作都只返回当前工作区数据
3. 继续补齐跨工作区越权测试与审计日志覆盖

结论：

- `Prompt Asset` 已不再是“迁移试点”，而是当前工作区授权模型的基线实现
- 后续可以以它为模板继续收敛 `Project`、`Credential`、`Member` 等模块

## 17. Project 当前状态与后续工作

`Project` 模块的运行时读写已经迁移到数据库，当前问题不再是“是否迁移”，而是“如何下线旧兼容层并补齐多租户闭环”。

### 17.1 当前状态

已完成：

- `projects / project_revisions` 已落库
- 运行时读写由 `ProjectService / ProjectRepository` 承接
- `workspace_id`、历史版本、软删除、并发版本号都已建模
- 工作区路由 `/api/workspaces/:workspaceSlug/projects/*` 已存在

仍保留：

- `ProjectStore` 仅用于历史导入和测试
- `/api/projects/*` 旧路由仍在，承担兼容返回格式
- `apiConfig` 仍以兼容 JSON 形式存在于 revision 快照中

### 17.2 后续工作

建议后续收敛为：

1. 将新能力只放到工作区路由
2. 逐步下线 `/api/projects/*` 旧兼容接口
3. 在引入 `credential_profiles` 后，逐步剥离 revision 中的明文 `apiConfig.apiKey` 语义
4. 继续保留一次性历史导入能力，但不再把 JSON 文件视为运行时存储

结论：

- `Project` 的数据库化已经完成
- 后续重点是接口收敛、凭证剥离和兼容层下线

## 18. Logto 集成方案

### 18.1 接入方式

推荐采用以下集成方式：

- SDK：`@logto/next`
- Next 模式：App Router
- 认证模式：server-side session + secure cookie
- 回调路由：`/callback`

具体落地步骤、`.env` 变量约定与 Management API 对接说明见：

- `docs/logto-integration.md`

当前仓库补充说明：

- `sign-in`、`callback`、`sign-out` 基础路由已经存在
- `requireSession()`、`resolvePrincipal()` 已经接入服务端请求链路
- 在未配置 Logto 的本地开发环境中，当前支持基于请求头的 dev session fallback
- 正式环境仍应以 Logto Session 为唯一身份来源

### 18.2 服务端接入点

建议新增：

- `app/logto.ts`：Logto 配置
- `app/callback/route.ts`：登录回调
- `app/sign-in/route.ts`：登录跳转
- `app/sign-out/route.ts`：登出跳转
- `app/lib/auth/session.ts`：统一封装 `getLogtoContext()`
- `app/lib/auth/principal.ts`：用户与工作区解析

### 18.3 首次登录流程

首次登录建议采用如下流程：

1. 用户通过 Logto 完成认证
2. 回到应用后读取 `claims.sub/email/name/avatar`
3. 在本地 `users` 表中 upsert 用户
4. 如果用户没有 `personal workspace`，则自动创建
5. 返回首页并进入该个人空间

### 18.4 团队工作区创建流程

团队空间创建需要同时创建两份数据：

1. 应用本地 `workspace`
2. Logto `organization`

建议顺序：

1. 先通过服务端调用 Logto Management API 创建 organization
2. 再写入本地 `workspace(logto_organization_id=...)`
3. 再写入当前用户 membership 为 `owner`

如果任一步失败，必须回滚或补偿，避免“本地有工作区但 Logto 没组织”或反过来。

### 18.5 成员与角色同步

建议采用“Logto 为主，本地为投影”的同步策略。

同步触发点：

- 用户进入工作区时懒同步
- 管理员在应用内变更成员时主动同步
- 后台定时任务做兜底校准

同步对象：

- organization membership
- organization roles
- user basic profile

## 19. API 资源与权限演进

### 19.1 当前单体阶段

当前项目是单体 Next.js 应用，浏览器只访问本站 API，因此第一阶段不强依赖“浏览器直接拿组织 token 调业务 API”。

第一阶段可使用：

- Logto Session 获取用户身份
- 本地数据库做授权判定

### 19.2 未来拆分服务阶段

如果后续把业务 API 独立为单独服务，应启用 Logto 的 `organization-level API resources`：

- 定义资源标识，例如 `https://api.aicontext.app/org`
- 定义 scopes，例如 `project:read`、`project:write`
- 获取带 `organization_id` 的 access token
- API 服务验证 JWT 中的 `aud`、`scope`、`organization_id`

这个设计与本期不冲突，属于顺滑演进。

## 20. UI 与交互影响

前端需要增加以下结构：

- 登录态首页
- 工作区切换器
- 当前工作区标识
- 成员管理入口
- 凭证管理入口

现有模块的行为变化如下：

### ProjectListPanel

- 只展示当前工作区项目
- 工作区切换时整体刷新

### PromptAssetDrawer

- 只展示当前工作区资产
- 创建与编辑动作默认归属当前工作区

### ApiConfigPanel

需要改造成“选择凭证配置”，而不是直接编辑明文 key。

## 21. 安全设计

### 21.1 基本原则

- 所有业务 API 默认需要登录
- 所有数据访问默认要求工作区上下文
- 所有资源查询默认附带 `workspace_id`
- 所有写操作默认记录 `actor`

### 21.2 必须避免的问题

- 仅通过前端隐藏按钮实现权限控制
- 只校验用户登录，不校验工作区归属
- 根据用户传入的 `workspace_id` 直接写入数据
- 将 Logto claims 直接当作业务权限唯一来源
- 在客户端缓存完整 secret

### 21.3 审计要求

以下动作必须写 `audit_logs`：

- 登录后首次建档
- 创建/删除工作区
- 邀请/移除成员
- 修改角色
- 创建/删除项目
- 创建/归档/恢复提示词资产
- 创建/更新/删除凭证配置

## 22. 分阶段落地方案

### 已完成基线

当前仓库已经完成以下基线能力：

- `Project` 与 `Prompt Asset` 的 SQLite 统一存储
- `users / workspaces / workspace_memberships` 多用户基础表
- 工作区级 schema、索引和基础权限模型
- `resolvePrincipal()`、`requirePermission()` 服务端鉴权入口
- `sign-in / callback / sign-out` 基础认证接入点
- 工作区路由下的 `projects` 与 `prompt-assets` 主接口

### Phase 1：认证闭环与接口收敛

目标：

- 完成真实 Logto Session 接入作为主身份来源
- 将工作区路由明确为唯一主接口
- 清理 `/api/projects/*`、`/api/prompt-assets/*` 的 legacy 扩展
- 固化统一响应结构、错误码与越权测试

结果：

- 系统从“具备多用户表结构”变为“具备一致认证与接口边界的多租户应用”

### Phase 2：凭证中心改造

目标：

- 引入 `credential_profiles`
- 移除项目中的明文 `apiKey`
- `generate` 路由改为按凭证配置解密并调用模型

结果：

- 多用户场景下的 secret 风险显著下降

### Phase 3：团队空间与成员管理

目标：

- 创建团队空间
- 对接 Logto organization
- 成员邀请、角色管理、工作区切换
- 完成幂等与补偿机制
- 建立角色感知的成员页、权限反馈与共享边界提示

结果：

- 从“具备个人空间隔离”演进到“多人共享协作”

### Phase 4：生产化治理

目标：

- 评估并切换生产主库到 PostgreSQL
- 下线历史 JSON 兼容导入在运行时链路中的残留影响
- 补齐审计、监控、定时校准与运维手册

结果：

- 系统从“可运行的多用户单体”演进到“可稳定运营的多租户服务”

## 23. 推荐的最终方案

如果只给一个推荐方案，结论如下：

1. 身份认证使用 Logto
2. 多租户边界使用应用内 `Workspace`
3. 团队空间与 Logto `Organization` 一一映射
4. 前期保持 `Next.js BFF` 单体，不急于拆独立后端服务
5. 后端接口统一使用工作区显式路由和一致的响应结构
6. 项目与提示词资产全部迁移到数据库并带 `workspace_id`
7. 权限判定以“Logto 身份 + 本地 membership + 资源归属”三者联合决定
8. API Key 从项目中剥离，改为独立凭证实体并加密存储
9. 开发环境允许 `SQLite`，生产在团队协作上线前切换 `PostgreSQL`
10. 前端导航必须显式表达 `workspace`，避免把多租户上下文藏进隐式状态
11. 数据库化已经完成，下一步优先做认证闭环、凭证中心和组织成员管理

## 24. 最终判断

这个项目要支持多用户，真正的分水岭已经不再是“要不要从 JSON 迁到 SQLite”，而是能否把当前这套数据库化基础设施继续推进到：

- 以 `workspace` 为边界的服务端多租户应用
- 以 Logto 为身份源的正式认证闭环
- 以统一工作区路由为边界的稳定 API 体系

Logto 解决的是“身份来源与组织能力”，不是“业务数据天然安全”。因此最合理的方案是：

- 用 Logto 承接认证和组织
- 用本地数据库承接业务隔离和授权
- 用统一 API 规范收敛多模块实现
- 用工作区统一收口所有资源归属

这条路径与当前仓库现状一致，不需要推倒重来；需要做的是把现有 SQLite、多用户 schema 和基础鉴权继续收口成真正可运营的多租户产品。
