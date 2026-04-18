# AI Context Editor 多用户与 Logto 集成架构方案

## 1. 文档目标

本文定义 `AI Context Editor` 从“本地单用户工具”演进为“支持账号登录、用户隔离、工作区共享”的目标架构，并补充以下可直接落地的后端规范：

1. 多用户系统的身份、租户、权限与数据隔离边界
2. 与 `Logto` 的职责划分与集成方式
3. 后端接口的统一 API 规范
4. 后端技术选型与分阶段演进建议
5. 将技术规范写回架构设计，避免后续实现分叉

本文面向后端技术负责人、架构设计者与后续实现工程师。

## 2. 当前现状与核心问题

基于仓库现状，当前系统仍然建立在“单机单用户”假设上：

- `Project` 数据保存在 `data/{projectId}/project.json`
- 项目历史也保存在本地文件系统目录
- `Prompt Asset` 已进入 `SQLite + Drizzle`，但没有 `user_id`、`workspace_id` 等归属字段
- API 路由没有认证校验，也没有权限校验
- `ProjectData.apiConfig.apiKey` 跟随项目一起保存，属于明文共享型设计

这意味着当前实现存在以下硬伤：

- 无法识别“谁在访问”
- 无法隔离“谁的数据”
- 无法支持同一项目下多人协作
- 无法支持组织级成员、角色、邀请与 SSO
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
- `Prompt Asset` 子系统已在 `SQLite + Drizzle` 上运行，迁移路径最短
- 多用户化的核心成本在数据模型与授权，而不是先拆服务
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
- 迁移脚本：旧 `project.json` 迁移到数据库后的数据一致性

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

原因：

- 路由层就明确当前业务上下文
- 前端缓存与服务端日志更易分析
- 避免把“当前工作区”完全藏在 session 偏好里

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

所有成功响应统一为：

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

例如：

- `PROJECT_NOT_FOUND`
- `PROMPT_ASSET_VERSION_CONFLICT`
- `CREDENTIAL_SECRET_REQUIRED`
- `WORKSPACE_SLUG_TAKEN`

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

### 13.1 会话与当前用户

#### `GET /api/me`

用途：

- 获取当前登录用户与默认工作区信息

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
    "defaultWorkspace": {
      "id": "01J...",
      "slug": "alice",
      "type": "personal",
      "role": "owner"
    }
  }
}
```

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

## 14. 数据库架构设计

### 14.1 总体结论

当前 `Project` 继续使用文件系统不可接受，必须迁移到数据库。

推荐目标：

- 开发环境可继续用 SQLite
- 生产环境建议切到 PostgreSQL
- ORM 继续使用 Drizzle，避免模型层重写

原因：

- 多用户查询、过滤、分页、权限校验都需要关系型查询能力
- 文件系统不适合多实例与容器化部署
- 历史版本、审计日志、成员关系都天然适合关系模型

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

### project_revisions

- `id`
- `project_id`
- `workspace_id`
- `revision_number`
- `snapshot_json`
- `created_by`
- `created_at`

说明：

- 用数据库表替代当前 `history/*.json`
- `workspace_id` 冗余存储用于快速隔离校验和查询
- `(project_id, revision_number)` 唯一

### prompt_assets

在现有表基础上新增：

- `workspace_id`
- `created_by`
- `updated_by`

并将唯一性改造为“工作区内唯一”：

- `(workspace_id, normalized_name)` 可选唯一

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

## 16. Prompt Asset 改造方案

当前 `Prompt Asset` 子系统已经有较完整的服务层和数据库层，因此改造成本相对可控。

需要做的事：

1. 所有接口增加认证
2. 路由收敛到 `/api/workspaces/:workspaceSlug/prompt-assets/*`
3. 查询条件增加 `workspace_id`
4. 创建、更新、归档、恢复动作记录 `created_by / updated_by`
5. 列表与详情都必须只返回当前工作区数据
6. 历史版本表带上 `workspace_id`，避免跨租户串数据

结论：

- `Prompt Asset` 是最适合优先完成多用户化改造的模块
- 它可以作为整个“工作区授权模型”的试点

## 17. Project 改造方案

`Project` 模块必须从“文件存储”迁移为“数据库存储”。

### 17.1 不建议保留文件系统作为长期主存储

原因：

- 无法做工作区级过滤
- 无法做数据库层唯一约束与事务
- 无法在多实例环境共享
- 无法自然支持成员权限

### 17.2 目标改造

将以下能力数据库化：

- 项目元数据
- 项目正文
- 历史版本
- 删除标记
- 最近访问时间
- 创建人与更新人

### 17.3 兼容迁移

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

## 18. Logto 集成方案

### 18.1 接入方式

推荐采用以下集成方式：

- SDK：`@logto/next`
- Next 模式：App Router
- 认证模式：server-side session + secure cookie
- 回调路由：`/callback`

具体落地步骤、`.env` 变量约定与 Management API 对接说明见：

- `docs/logto-integration.md`

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

### Phase 1：认证接入与用户建档

目标：

- 接入 Logto 登录
- 增加 `users`
- 增加 `personal workspace`
- 页面和 API 初步识别当前用户
- 落地统一 `requireSession/requirePrincipal` 入口

结果：

- 系统从“匿名单用户”变为“有账号的个人空间”

### Phase 2：Project 数据库化

目标：

- 引入 `projects / project_revisions`
- 完成文件存储迁移
- 所有项目接口切到数据库
- 项目读取以 `workspace_id` 为边界
- 完成 `Project API` 契约收敛

结果：

- 项目模块具备真正多用户隔离能力

### Phase 3：Prompt Asset 多用户化

目标：

- 为 `prompt_assets` 与 `prompt_asset_versions` 增加工作区归属
- 所有资产接口强制鉴权和工作区过滤
- 记录创建人与更新人
- 将现有资产接口迁移到工作区路由

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
- 完成幂等与补偿机制

结果：

- 从“多账号隔离”演进到“多人共享协作”

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
10. 采用分阶段落地，先认证与数据库化，再做组织与成员管理

## 24. 最终判断

这个项目要支持多用户，真正的分水岭不在“接不接 Logto”，而在于是否把系统从：

- 本地文件工具

改造成：

- 以 `workspace` 为边界的服务端多租户应用

Logto 解决的是“身份来源与组织能力”，不是“业务数据天然安全”。因此最合理的方案是：

- 用 Logto 承接认证和组织
- 用本地数据库承接业务隔离和授权
- 用统一 API 规范收敛多模块实现
- 用工作区统一收口所有资源归属

这条路径与当前仓库演进方向兼容，改造成本可控，也能为后续团队协作、企业 SSO 与 API 服务拆分留下足够空间。
