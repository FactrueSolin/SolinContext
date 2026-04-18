# AI Context Editor 多用户与 Logto 集成架构方案

## 1. 文档目标

本文定义 `AI Context Editor` 从“本地单用户工具”演进为“支持账号登录、用户隔离、工作区共享”的目标架构，并给出与 Logto 的集成方案。

本文重点回答 5 个问题：

1. 如何把当前项目改造成真正的多用户系统
2. Logto 在系统中负责什么，不负责什么
3. 数据隔离边界应该落在哪一层
4. 当前 `Project` 文件存储和 `Prompt Asset` SQLite 存储如何演进
5. 如何分阶段落地，避免一次性大改失败

## 2. 当前现状与核心问题

基于仓库现状，当前系统仍然是“单机单用户”假设：

- `Project` 数据保存在 `data/{projectId}/project.json`
- 项目历史也保存在本地文件系统目录
- `Prompt Asset` 已进入 `SQLite + Drizzle`，但没有 `user_id`、`workspace_id` 等归属字段
- API 路由没有认证校验，也没有权限校验
- `ProjectData.apiConfig.apiKey` 跟随项目一起保存，属于明文共享型设计

这意味着当前实现存在以下硬伤：

- 无法识别“谁在访问”
- 无法隔离“谁的数据”
- 无法支持同一项目下多人协作
- 无法支持组织级别的成员、角色、邀请与 SSO
- 项目内嵌 API Key 在多用户场景下会变成凭证泄露面
- 文件系统存储不适合多实例部署，也不适合按用户/工作区做查询与授权

结论：如果目标是真正支持多用户，不能只加登录，必须同时改造“身份、授权、数据模型、存储模型、密钥模型”。

## 3. 设计目标

### 3.1 本期目标

本期目标定义为：

- 支持用户注册、登录、登出
- 支持同一部署下多个用户各自拥有独立数据
- 支持“工作区（Workspace）”作为数据隔离边界
- 支持基于工作区的角色权限
- 支持与 Logto 对接，承接身份认证、组织、多租户能力
- 支持后续扩展到邀请成员、组织切换、企业 SSO

### 3.2 非目标

本期不追求：

- 实时协同编辑
- 复杂审批流
- 细粒度字段级权限
- 完整 IAM 平台能力
- 多区域多活

## 4. 总体设计结论

### 4.1 核心架构决策

采用以下总体方案：

- `Logto` 负责认证与组织身份能力
- 应用内部以 `Workspace` 作为业务隔离边界
- 协作型 `Workspace` 与 `Logto Organization` 一一映射
- 个人型 `Workspace` 在应用内自动创建，用于承接“个人空间”
- 应用后端继续采用 `Next.js BFF` 模式，浏览器只调用本站 `app/api/*`
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

1. URL 中的工作区 slug
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

### 9.3 Logto 中的角色映射

在 Logto 的 `Organization template` 中配置组织角色：

- `owner`
- `admin`
- `editor`
- `viewer`

这些角色绑定组织权限或组织级 API resource scopes。

应用内有两种做法：

#### 做法 A：本地角色完全镜像 Logto

优点：

- 模型统一
- 前后端语义一致

代价：

- 需要同步 Logto 组织角色到本地 membership

#### 做法 B：Logto 只提供身份与组织成员关系，本地自己维护业务角色

优点：

- 业务灵活

代价：

- 双份角色模型更难维护

本项目建议采用做法 A：

- `organization workspace` 使用 Logto 组织角色作为主数据源
- 本地 membership 做缓存和查询投影
- `personal workspace` 直接在本地固定为 `owner`

## 10. 请求链路设计

### 10.1 页面访问链路

```text
Browser
  -> Next Server Component / Route Handler
  -> getLogtoContext()
  -> resolveCurrentUser()
  -> resolveActiveWorkspace()
  -> requirePermission()
  -> service / repository
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

其中 `principal` 至少包含：

- `userId`
- `logtoUserId`
- `activeWorkspaceId`
- `activeWorkspaceType`
- `workspaceRole`
- `permissions[]`

### 10.4 不信任前端传入的 workspace_id

所有读写接口都可以接收资源 ID 或工作区 slug，但不能直接信任请求体里的 `workspace_id`。

正确流程必须是：

1. 服务端解析当前用户
2. 服务端解析当前工作区
3. 服务端查询资源所属工作区
4. 服务端确认资源与当前工作区一致
5. 服务端再执行操作

## 11. 数据库架构设计

## 11.1 总体结论

当前 `Project` 继续使用文件系统不可接受，必须迁移到数据库。

推荐目标：

- 开发环境可继续用 SQLite
- 生产环境建议切到 PostgreSQL
- ORM 继续使用 Drizzle，避免模型层重写

原因：

- 多用户查询、过滤、分页、权限校验都需要关系型查询能力
- 文件系统不适合多实例与容器化部署
- 历史版本、审计日志、成员关系都天然适合关系模型

## 11.2 推荐表模型

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
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`
- `deleted_at`

### project_revisions

- `id`
- `project_id`
- `workspace_id`
- `snapshot_json`
- `created_by`
- `created_at`

说明：

- 用数据库表替代当前 `history/*.json`
- `workspace_id` 冗余存储用于快速隔离校验和查询

### prompt_assets

在现有表基础上新增：

- `workspace_id`
- `created_by`
- `updated_by`

并将以下唯一性改造为“工作区内唯一”：

- 名称唯一规则如果未来需要约束，应基于 `workspace_id + normalized_name`

### prompt_asset_versions

建议新增：

- `workspace_id`
- `created_by`

### credential_profiles

- `id`
- `workspace_id`
- `owner_user_id` nullable
- `name`
- `provider`
- `base_url`
- `model`
- `encrypted_secret`
- `secret_last4`
- `scope_type` (`personal` / `workspace`)
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`

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

## 11.3 关键索引

必须建立以下索引：

- `projects(workspace_id, updated_at desc)`
- `project_revisions(project_id, created_at desc)`
- `prompt_assets(workspace_id, status, updated_at desc)`
- `workspace_memberships(user_id, status)`
- `workspace_memberships(workspace_id, role, status)`
- `credential_profiles(workspace_id, scope_type)`
- `audit_logs(workspace_id, created_at desc)`

## 12. 凭证与密钥模型

这是本次改造里最容易被忽略、但风险最高的一块。

### 12.1 当前问题

当前 `Project` 持有：

- `baseUrl`
- `apiKey`
- `model`

这在单用户本地工具里勉强成立，但在多用户场景会出现两个问题：

- 项目共享即凭证共享
- 任何拥有项目读权限的人都可能看到 API Key

### 12.2 目标方案

改成“两层模型”：

- `Project` 只保存“选择了哪个凭证配置”
- 真正 secret 存在 `credential_profiles`

### 12.3 使用规则

- 个人空间下，默认使用用户私有凭证
- 团队空间下，可选择用户私有凭证或工作区共享凭证
- 使用共享凭证需要 `credential:use`
- 管理共享凭证需要 `credential:manage`

### 12.4 安全要求

- secret 仅服务端可解密
- 前端永不回显完整 API Key
- 日志中不打印 secret
- 导出项目时不包含 secret

## 13. Prompt Asset 改造方案

当前 `Prompt Asset` 子系统已经有较完整的服务层和数据库层，因此改造成本相对可控。

需要做的事：

1. 所有接口增加认证
2. 查询条件增加 `workspace_id`
3. 创建、更新、归档、恢复动作记录 `created_by / updated_by`
4. 列表与详情都必须只返回当前工作区数据
5. 历史版本表带上 `workspace_id`，避免跨租户串数据

结论：

- `Prompt Asset` 是最适合优先完成多用户化改造的模块
- 它可以作为整个“工作区授权模型”的试点

## 14. Project 改造方案

`Project` 模块必须从“文件存储”迁移为“数据库存储”。

### 14.1 不建议保留文件系统作为长期主存储

原因：

- 无法做工作区级过滤
- 无法做数据库层唯一约束与事务
- 无法在多实例环境共享
- 无法自然支持成员权限

### 14.2 目标改造

将以下能力数据库化：

- 项目元数据
- 项目正文
- 历史版本
- 删除标记
- 最近访问时间
- 创建人与更新人

### 14.3 兼容迁移

建议一次性迁移，不长期双写。

迁移策略：

1. 增加数据库 `projects / project_revisions`
2. 写迁移脚本扫描 `data/*/project.json`
3. 迁移历史快照
4. 标记旧文件存储为只读
5. 切换 API 到数据库实现
6. 验证完成后下线旧读取路径

原因：

- 长期双写很容易引入一致性问题
- 当前项目规模不大，完全没必要为旧存储保留复杂兼容层

## 15. Logto 集成方案

## 15.1 接入方式

推荐采用以下集成方式：

- SDK：`@logto/next`
- Next 模式：App Router
- 认证模式：server-side session + secure cookie
- 回调路由：`/callback`

### 15.2 服务端接入点

建议新增：

- `app/logto.ts`：Logto 配置
- `app/callback/route.ts`：登录回调
- `app/sign-in/route.ts`：登录跳转
- `app/sign-out/route.ts`：登出跳转
- `app/lib/auth/session.ts`：统一封装 `getLogtoContext()`
- `app/lib/auth/principal.ts`：用户与工作区解析

### 15.3 首次登录流程

首次登录建议采用如下流程：

1. 用户通过 Logto 完成认证
2. 回到应用后读取 `claims.sub/email/name/avatar`
3. 在本地 `users` 表中 upsert 用户
4. 如果用户没有 `personal workspace`，则自动创建
5. 返回首页并进入该个人空间

### 15.4 团队工作区创建流程

团队空间创建需要同时创建两份数据：

1. 应用本地 `workspace`
2. Logto `organization`

建议顺序：

1. 先通过服务端调用 Logto Management API 创建 organization
2. 再写入本地 `workspace(logto_organization_id=...)`
3. 再写入当前用户 membership 为 `owner`

如果任一步失败，必须回滚或补偿，避免“本地有工作区但 Logto 没组织”或反过来。

### 15.5 成员与角色同步

建议采用“Logto 为主，本地为投影”的同步策略。

同步触发点：

- 用户进入工作区时懒同步
- 管理员在应用内变更成员时主动同步
- 后台定时任务做兜底校准

同步对象：

- organization membership
- organization roles
- user basic profile

## 16. API 资源与权限演进

### 16.1 当前单体阶段

当前项目是单体 Next.js 应用，浏览器只访问本站 API，因此第一阶段不强依赖“浏览器直接拿组织 token 调业务 API”。

第一阶段可使用：

- Logto Session 获取用户身份
- 本地数据库做授权判定

### 16.2 未来拆分服务阶段

如果后续把业务 API 独立为单独服务，应启用 Logto 的 `organization-level API resources`：

- 定义资源标识，例如 `https://api.aicontext.app/org`
- 定义 scopes，例如 `project:read`、`project:write`
- 获取带 `organization_id` 的 access token
- API 服务验证 JWT 中的 `aud`、`scope`、`organization_id`

这个设计与本期不冲突，属于顺滑演进。

## 17. UI 与交互影响

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

## 18. 安全设计

### 18.1 基本原则

- 所有业务 API 默认需要登录
- 所有数据访问默认要求工作区上下文
- 所有资源查询默认附带 `workspace_id`
- 所有写操作默认记录 `actor`

### 18.2 必须避免的问题

- 仅通过前端隐藏按钮实现权限控制
- 只校验用户登录，不校验工作区归属
- 根据用户传入的 `workspace_id` 直接写入数据
- 将 Logto claims 直接当作业务权限唯一来源
- 在客户端缓存完整 secret

### 18.3 审计要求

以下动作必须写 `audit_logs`：

- 登录后首次建档
- 创建/删除工作区
- 邀请/移除成员
- 修改角色
- 创建/删除项目
- 创建/归档/恢复提示词资产
- 创建/更新/删除凭证配置

## 19. 分阶段落地方案

### Phase 1：认证接入与用户建档

目标：

- 接入 Logto 登录
- 增加 `users`
- 增加 `personal workspace`
- 页面和 API 初步识别当前用户

结果：

- 系统从“匿名单用户”变为“有账号的个人空间”

### Phase 2：Project 数据库化

目标：

- 引入 `projects / project_revisions`
- 完成文件存储迁移
- 所有项目接口切到数据库
- 项目读取以 `workspace_id` 为边界

结果：

- 项目模块具备真正多用户隔离能力

### Phase 3：Prompt Asset 多用户化

目标：

- 为 `prompt_assets` 与 `prompt_asset_versions` 增加工作区归属
- 所有资产接口强制鉴权和工作区过滤
- 记录创建人与更新人

结果：

- 提示词资产库完成多用户改造

### Phase 4：凭证中心改造

目标：

- 引入 `credential_profiles`
- 移除项目中的明文 `apiKey`
- `generate` 路由改为按凭证配置解密并调用模型

结果：

- 多用户场景下的 secret 风险显著下降

### Phase 5：团队空间与成员管理

目标：

- 创建团队空间
- 对接 Logto organization
- 成员邀请、角色管理、工作区切换

结果：

- 从“多账号隔离”演进到“多人共享协作”

## 20. 推荐的最终方案

如果只给一个推荐方案，结论如下：

1. 身份认证使用 Logto
2. 多租户边界使用应用内 `Workspace`
3. 团队空间与 Logto `Organization` 一一映射
4. 项目与提示词资产全部迁移到数据库并带 `workspace_id`
5. 权限判定以“Logto 身份 + 本地 membership + 资源归属”三者联合决定
6. API Key 从项目中剥离，改为独立凭证实体并加密存储
7. 采用分阶段落地，先认证与数据库化，再做组织与成员管理

## 21. 最终判断

这个项目要支持多用户，真正的分水岭不在“接不接 Logto”，而在于是否把系统从：

- 本地文件工具

改造成：

- 以 `workspace` 为边界的服务端多租户应用

Logto 解决的是“身份来源与组织能力”，不是“业务数据天然安全”。因此最合理的方案是：

- 用 Logto 承接认证和组织
- 用本地数据库承接业务隔离和授权
- 用工作区统一收口所有资源归属

这条路径与当前仓库演进方向兼容，改造成本可控，也能为后续团队协作、企业 SSO 与 API 服务拆分留下足够空间。
