# Logto 对接说明

本文用于说明 `AI Context Editor` 如何以 `.env` 为中心完成 Logto 接入，并与当前的多用户 `Workspace` 架构保持一致。

适用范围：

- `Next.js App Router`
- `@logto/next`
- 浏览器只访问本站 BFF API
- 用户登录、登出、当前用户解析
- 后续团队空间需要调用 Logto Management API

## 1. 接入原则

本项目约定：

- Logto 连接信息统一配置在仓库根目录 `.env`
- 所有 Logto secret 只允许服务端读取
- 前端不直接持有 Logto 管理能力凭证
- 认证使用 Logto Session Cookie
- 业务权限仍由本地 `Workspace + Membership + Resource ownership` 决定

说明：

- 如果本地开发希望覆盖 `.env`，可以额外使用 `.env.local`
- 但项目文档和默认约定以 `.env` 为主

## 2. 需要准备的 Logto 应用

### 2.1 登录用应用

在 Logto Console 中创建一个 `Traditional` 应用，用于 Web 登录。

需要记录以下信息：

- `Endpoint`
- `App ID`
- `App Secret`

需要配置以下回调地址：

- Redirect URI:
  - `http://localhost:3000/callback`
- Post sign-out redirect URI:
  - `http://localhost:3000/`

生产环境替换为真实域名，例如：

- `https://app.example.com/callback`
- `https://app.example.com/`

### 2.2 管理 API 用应用

如果后续需要创建组织、邀请成员、同步角色，建议额外创建一个 `Machine-to-machine` 应用。

需要记录以下信息：

- `App ID`
- `App Secret`
- `Token endpoint`
- `Management API resource indicator`

并给该应用分配 `Logto Management API access` 角色。

## 3. `.env` 配置规范

建议在仓库根目录新增 `.env`：

```dotenv
# App base url
APP_BASE_URL=http://localhost:3000

# Logto browser auth
LOGTO_ENDPOINT=https://your-tenant.logto.app
LOGTO_APP_ID=your_logto_traditional_app_id
LOGTO_APP_SECRET=your_logto_traditional_app_secret
LOGTO_COOKIE_SECRET=replace_with_at_least_32_characters
LOGTO_SCOPES=openid profile email offline_access urn:logto:scope:organizations

# Optional: Logto Management API
LOGTO_M2M_APP_ID=your_logto_m2m_app_id
LOGTO_M2M_APP_SECRET=your_logto_m2m_app_secret
LOGTO_M2M_TOKEN_ENDPOINT=https://your-tenant.logto.app/oidc/token
LOGTO_MANAGEMENT_API_RESOURCE=https://your-tenant.logto.app/api
```

字段说明：

- `APP_BASE_URL`
  - 当前应用对外访问地址
  - 本地开发通常为 `http://localhost:3000`
- `LOGTO_ENDPOINT`
  - Logto 租户地址
  - 例如 `https://your-tenant.logto.app`
- `LOGTO_APP_ID`
  - `Traditional` 应用的 App ID
- `LOGTO_APP_SECRET`
  - `Traditional` 应用的 App Secret
- `LOGTO_COOKIE_SECRET`
  - 用于加密 Session Cookie
  - 长度必须至少 32 个字符
- `LOGTO_SCOPES`
  - 建议包含：
    - `openid`
    - `profile`
    - `email`
    - `offline_access`
    - `urn:logto:scope:organizations`
- `LOGTO_M2M_APP_ID`
  - `Machine-to-machine` 应用的 App ID
- `LOGTO_M2M_APP_SECRET`
  - `Machine-to-machine` 应用的 App Secret
- `LOGTO_M2M_TOKEN_ENDPOINT`
  - M2M 获取 access token 的 token endpoint
- `LOGTO_MANAGEMENT_API_RESOURCE`
  - Logto Management API 的 resource indicator
  - Logto Cloud 通常为 `https://{tenant-id}.logto.app/api`

## 4. 推荐的服务端接入文件

建议按以下结构落地：

- `app/logto.ts`
- `app/callback/route.ts`
- `app/sign-in/route.ts`
- `app/sign-out/route.ts`
- `app/lib/auth/session.ts`
- `app/lib/auth/principal.ts`

### 4.1 `app/logto.ts`

用于集中读取 `.env` 并初始化 Logto 配置。

示例：

```ts
import type { LogtoNextConfig } from '@logto/next';

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }

  return value;
}

export const logtoConfig: LogtoNextConfig = {
  endpoint: getRequiredEnv('LOGTO_ENDPOINT'),
  appId: getRequiredEnv('LOGTO_APP_ID'),
  appSecret: getRequiredEnv('LOGTO_APP_SECRET'),
  baseUrl: getRequiredEnv('APP_BASE_URL'),
  cookieSecret: getRequiredEnv('LOGTO_COOKIE_SECRET'),
  cookieSecure: process.env.NODE_ENV === 'production',
  scopes: getRequiredEnv('LOGTO_SCOPES').split(' '),
};
```

约束：

- 所有配置从 `.env` 读取
- 不要写死到代码
- 不使用 `NEXT_PUBLIC_*` 暴露 secret

### 4.2 登录相关 Route Handler

建议使用：

- `app/sign-in/route.ts`
  - 跳转到 Logto 登录
- `app/callback/route.ts`
  - 处理回调
- `app/sign-out/route.ts`
  - 处理登出

这三类路由只负责认证过程本身，不承载业务逻辑。

### 4.3 `session.ts`

建议封装：

- `getLogtoContext()`
- `requireSession()`

职责：

- 读取当前登录态
- 在服务端获取 claims
- 未登录时统一抛出 `401 UNAUTHENTICATED`

### 4.4 `principal.ts`

建议封装：

- `resolvePrincipal()`
- `resolveActiveWorkspace()`
- `requirePermission(permission)`

职责：

- 将 Logto 用户映射为本地 `users`
- 根据路由中的 `workspaceSlug` 解析当前工作区
- 根据本地 membership 得到角色和权限

## 5. 首次登录流程

建议流程如下：

1. 用户访问 `/sign-in`
2. 跳转到 Logto 登录页
3. 登录成功后回到 `/callback`
4. 服务端从 claims 中读取 `sub`、`email`、`name`、`picture`
5. `users` 表执行 upsert
6. 若不存在个人工作区，则创建 `personal workspace`
7. 写入或更新默认工作区偏好
8. 跳转到默认工作区首页

## 6. Management API 对接

这一部分主要用于：

- 创建团队工作区时同步创建 `organization`
- 邀请成员
- 同步组织角色
- 定时校准组织成员关系

### 6.1 环境变量来源

建议全部从 `.env` 获取：

- `LOGTO_M2M_APP_ID`
- `LOGTO_M2M_APP_SECRET`
- `LOGTO_M2M_TOKEN_ENDPOINT`
- `LOGTO_MANAGEMENT_API_RESOURCE`

### 6.2 推荐封装

建议新增：

- `app/lib/logto/management.ts`

职责：

- 获取 M2M access token
- 缓存短期 token
- 调用 Logto Management API
- 屏蔽外部 API 错误细节

### 6.3 调用边界

不要让业务模块直接到处发 Logto HTTP 请求。

建议统一通过：

- `WorkspaceService`
- `MembershipService`
- `LogtoManagementClient`

来完成组织创建与成员同步。

## 7. 安全要求

- `.env` 不提交到代码仓库
- 如果需要共享字段模板，应提交 `.env.example`，不要提交真实 secret
- `LOGTO_APP_SECRET`、`LOGTO_M2M_APP_SECRET` 只允许服务端使用
- `LOGTO_COOKIE_SECRET` 长度至少 32 字符
- 日志中禁止打印 token、secret、完整 claims
- 前端只知道登录结果，不直接知道 App Secret

## 8. 推荐实施顺序

### 阶段一：浏览器登录

1. 安装 `@logto/next`
2. 新增 `.env`
3. 新增 `app/logto.ts`
4. 打通 `/sign-in`、`/callback`、`/sign-out`
5. 完成 `users` 建档与个人工作区初始化

### 阶段二：工作区上下文

1. 实现 `requireSession()`
2. 实现 `resolvePrincipal()`
3. 实现 `resolveActiveWorkspace()`
4. 将现有业务 API 挂到工作区路由下

### 阶段三：组织与成员

1. 创建 M2M 应用
2. 补齐 `.env` 中的 Management API 配置
3. 接入组织创建与成员同步
4. 增加失败补偿与幂等控制

## 9. 接入检查清单

- 已在 Logto 创建 `Traditional` 应用
- 已配置正确的 Redirect URI
- 已配置正确的 Post sign-out redirect URI
- `.env` 已填写 `LOGTO_ENDPOINT`
- `.env` 已填写 `LOGTO_APP_ID`
- `.env` 已填写 `LOGTO_APP_SECRET`
- `.env` 已填写 `LOGTO_COOKIE_SECRET`
- `LOGTO_COOKIE_SECRET` 长度不少于 32
- 已实现首次登录建档
- 已实现个人工作区自动创建
- 如需组织能力，已创建 M2M 应用并配置 Management API 相关 env

## 10. 参考资料

- Logto Next.js App Router 官方文档：
  - https://docs.logto.io/quick-starts/next-app-router
- Logto Management API 官方文档：
  - https://docs.logto.io/integrate-logto/interact-with-management-api
- Logto 多租户实践文档：
  - https://docs.logto.io/use-cases/multi-tenancy/build-multi-tenant-saas-application
