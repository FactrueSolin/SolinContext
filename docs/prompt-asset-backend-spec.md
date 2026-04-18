# 提示词资产后端技术规范

> 本文是“提示词资产管理”子系统的后端主规范。  
> 架构背景见 [prompt-asset-architecture.md](./prompt-asset-architecture.md)，数据库物理模型见 [prompt-asset-database-design.md](./prompt-asset-database-design.md)。

## 1. 文档目标

本文用于明确以下内容：

- 第一阶段提示词资产后端的技术选型结论
- API 路由、请求体、响应体、错误码规范
- 服务层、仓储层、数据库层的职责边界
- 事务、一致性、校验、测试和迁移要求

本文中的“必须”表示落地实现的强约束，“建议”表示可选增强项。

## 2. 当前约束与实施前提

### 2.1 项目现状

- 当前仓库基于 `Next.js 16 + App Router + Route Handler`
- 当前 `Project` 领域仍由 `ProjectStore` 落盘到文件系统
- 当前仓库尚未引入数据库相关依赖
- 当前 API 错误结构不统一，新子系统需要单独建立明确契约

### 2.2 第一期范围

第一期后端只覆盖：

- 提示词资产增删查改中的“查、建、生成新版本、归档、取消归档”
- 历史版本查询
- 从历史版本恢复为新版本

第一期不覆盖：

- 用户、团队、权限
- 标签、文件夹、分享
- 多人协作编辑冲突解决
- 项目与资产的强引用关系

## 3. 技术选型结论

## 3.1 运行时

必须：

- 所有 `prompt-assets` Route Handler 运行在 `Node.js runtime`
- 不使用 Edge Runtime

原因：

- 需要访问本地 SQLite 文件
- 需要使用同步事务能力更强的 SQLite 驱动
- 需要与当前 `ProjectStore` 的文件系统运行模型保持一致

## 3.2 数据库与 ORM

第一阶段推荐结论：

- 数据库：`SQLite`
- ORM：`drizzle-orm`
- 迁移工具：`drizzle-kit`
- SQLite 驱动：`better-sqlite3`

原因：

- 当前系统已依赖本地文件系统，说明部署前提不是纯无状态 serverless
- `better-sqlite3` 对单机本地 SQLite 的事务能力、稳定性和调试体验更直接
- `drizzle-orm + drizzle-kit` 与 TypeScript 类型联动较好，适合约束版本化模型

备选方案：

- 如果后续目标部署环境变为无持久化磁盘或 serverless，应切换为 `@libsql/client` + 远端 libSQL/Turso
- 该切换属于部署形态变更，不影响本文定义的领域模型和 API 契约

## 3.3 输入校验

必须引入请求级 schema 校验库。

推荐结论：

- 使用 `zod`

原因：

- 与 TypeScript DTO 定义协同好
- 适合 Route Handler 中直接做请求体和查询参数解析
- 错误消息可控，便于映射统一错误码

## 3.4 ID、时间、哈希

必须：

- 资产 ID、版本 ID 统一使用 `ulid`
- 时间统一以 `Unix epoch ms` 存储
- `content_hash` 使用 Node.js `crypto` 生成 `SHA-256`

原因：

- `ulid` 兼顾唯一性和按时间排序的可读性
- `epoch ms` 便于 SQLite 排序与 Drizzle 映射
- `SHA-256` 足够支持内容幂等判断和审计追踪

## 3.5 事务策略

必须：

- 创建资产必须在单事务内完成
- 生成新版本必须在单事务内完成
- 恢复历史版本必须在单事务内完成
- 归档/取消归档至少保证单条资产状态原子更新

不得：

- 先写版本后异步回写主表
- 在服务层外手动拼接多次独立 SQL 来完成一次业务动作

## 3.6 搜索策略

第一阶段结论：

- 只支持 `name` 前缀或包含搜索
- 查询入口仅检索 `prompt_assets`

第二阶段建议：

- 如需按 `name + description + content` 做全文检索，再引入 SQLite FTS5

## 4. 目录与分层规范

建议目录如下：

```text
app/
  api/
    prompt-assets/
      route.ts
      [id]/
        route.ts
        archive/
          route.ts
        unarchive/
          route.ts
        restore/
          route.ts
        versions/
          route.ts
          [versionId]/
            route.ts
  lib/
    db/
      client.ts
      schema/
        prompt-assets.ts
      migrations/
    prompt-assets/
      dto.ts
      errors.ts
      repository.ts
      service.ts
      validators.ts
```

职责边界必须满足：

- Route Handler：仅处理 HTTP 协议、参数解析、响应映射
- Service：实现业务规则、事务编排、幂等判断和版本号推进
- Repository：只负责查询和持久化，不承载业务策略
- Schema/Migration：只定义数据库结构，不写业务逻辑

## 5. 领域对象与 DTO 规范

## 5.1 枚举定义

```ts
type PromptAssetStatus = 'active' | 'archived';
type PromptAssetOperationType = 'create' | 'update' | 'restore' | 'import';
```

## 5.2 对外返回 DTO

### PromptAssetSummary

```ts
interface PromptAssetSummary {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'archived';
  currentVersionNumber: number;
  createdAt: number;
  updatedAt: number;
  archivedAt: number | null;
}
```

### PromptAssetDetail

```ts
interface PromptAssetDetail extends PromptAssetSummary {
  currentVersion: {
    id: string;
    versionNumber: number;
    content: string;
    changeNote: string | null;
    operationType: 'create' | 'update' | 'restore' | 'import';
    sourceVersionId: string | null;
    createdAt: number;
  };
}
```

### PromptAssetVersionItem

```ts
interface PromptAssetVersionItem {
  id: string;
  assetId: string;
  versionNumber: number;
  nameSnapshot: string;
  descriptionSnapshot: string;
  content: string;
  changeNote: string | null;
  operationType: 'create' | 'update' | 'restore' | 'import';
  sourceVersionId: string | null;
  createdAt: number;
}
```

## 5.3 输入约束

第一阶段建议约束：

- `name`: 1-120 字符，去除首尾空白后不能为空
- `description`: 0-500 字符
- `content`: 1-50000 字符
- `changeNote`: 0-200 字符
- `query`: 0-50 字符
- `page`: `>= 1`
- `pageSize`: `1-50`

服务层必须在数据库约束之前先做输入校验，避免将低质量错误直接暴露为数据库异常。

## 6. 统一响应与错误规范

## 6.1 成功响应结构

新子系统统一返回：

```json
{
  "data": {}
}
```

列表接口返回：

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

## 6.2 失败响应结构

统一返回：

```json
{
  "error": {
    "code": "PROMPT_ASSET_NOT_FOUND",
    "message": "Prompt asset not found",
    "details": null
  }
}
```

`details` 可以为空，也可以放字段级错误信息。

## 6.3 错误码规范

| HTTP Status | code | 说明 |
| --- | --- | --- |
| `400` | `PROMPT_ASSET_BAD_REQUEST` | 查询参数或请求体格式错误 |
| `404` | `PROMPT_ASSET_NOT_FOUND` | 资产不存在 |
| `404` | `PROMPT_ASSET_VERSION_NOT_FOUND` | 版本不存在 |
| `409` | `PROMPT_ASSET_ARCHIVED` | 已归档资产禁止新增版本 |
| `409` | `PROMPT_ASSET_NO_CHANGES` | 新内容与当前版本完全一致 |
| `409` | `PROMPT_ASSET_VERSION_CONFLICT` | `expectedVersionNumber` 与当前版本不一致 |
| `422` | `PROMPT_ASSET_VALIDATION_FAILED` | 字段值不满足业务校验 |
| `500` | `PROMPT_ASSET_INTERNAL_ERROR` | 未分类服务端错误 |

## 7. API 契约

## 7.1 路由总览

第一阶段正式接口定义如下：

- `GET /api/prompt-assets`
- `POST /api/prompt-assets`
- `GET /api/prompt-assets/:id`
- `POST /api/prompt-assets/:id/versions`
- `GET /api/prompt-assets/:id/versions`
- `GET /api/prompt-assets/:id/versions/:versionId`
- `POST /api/prompt-assets/:id/restore`
- `POST /api/prompt-assets/:id/archive`
- `POST /api/prompt-assets/:id/unarchive`

说明：

- 原草案中的 `PUT /api/prompt-assets/:id` 容易误导为原地更新，实施阶段收敛为 `POST /:id/versions`
- 原草案中的 `DELETE /api/prompt-assets/:id` 不再作为正式方案，改为显式归档命令，避免“软删除”语义歧义

## 7.2 `GET /api/prompt-assets`

用途：

- 查询资产列表

查询参数：

- `query?: string`
- `status?: 'active' | 'archived' | 'all'`
- `page?: number`
- `pageSize?: number`

默认值：

- `status = 'active'`
- `page = 1`
- `pageSize = 20`

响应示例：

```json
{
  "data": {
    "items": [
      {
        "id": "01J...",
        "name": "代码评审提示词",
        "description": "用于通用代码 review",
        "status": "active",
        "currentVersionNumber": 3,
        "createdAt": 1760000000000,
        "updatedAt": 1760001000000,
        "archivedAt": null
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 1
    }
  }
}
```

排序规则：

- 固定按 `updatedAt desc`

## 7.3 `POST /api/prompt-assets`

用途：

- 新建资产并生成 `v1`

请求体：

```json
{
  "name": "代码评审提示词",
  "description": "用于通用代码 review",
  "content": "你是一名严谨的代码审查专家",
  "changeNote": "初始版本"
}
```

成功响应：

- `201 Created`

响应体：

- 返回 `PromptAssetDetail`

## 7.4 `GET /api/prompt-assets/:id`

用途：

- 查询资产当前态和当前版本内容

查询参数：

- `includeVersionSummary?: boolean`

默认：

- 第一阶段直接返回当前版本详情，不需要额外 `join` 开关

## 7.5 `POST /api/prompt-assets/:id/versions`

用途：

- 为资产创建新版本

请求体：

```json
{
  "name": "代码评审提示词",
  "description": "用于通用代码 review",
  "content": "你是一名严格、务实的代码审查专家",
  "changeNote": "补充审查原则",
  "expectedVersionNumber": 3
}
```

规则：

- `expectedVersionNumber` 为必须字段
- 若请求值与当前 `current_version_number` 不一致，返回 `409 PROMPT_ASSET_VERSION_CONFLICT`
- 若 `name + description + content_hash` 与当前版本完全一致，返回 `409 PROMPT_ASSET_NO_CHANGES`
- 若资产已归档，返回 `409 PROMPT_ASSET_ARCHIVED`

成功响应：

- `201 Created`
- 返回最新 `PromptAssetDetail`

## 7.6 `GET /api/prompt-assets/:id/versions`

用途：

- 查询版本历史

查询参数：

- `page?: number`
- `pageSize?: number`

排序规则：

- 固定按 `versionNumber desc`

响应体：

- 返回 `PromptAssetVersionItem[] + pagination`

## 7.7 `GET /api/prompt-assets/:id/versions/:versionId`

用途：

- 查询指定版本详情

规则：

- 必须校验 `versionId` 属于 `id`
- 不允许越权返回其他资产的版本数据

## 7.8 `POST /api/prompt-assets/:id/restore`

用途：

- 从历史版本恢复为一个新的当前版本

请求体：

```json
{
  "versionId": "01J...",
  "changeNote": "从 v3 恢复",
  "expectedVersionNumber": 5
}
```

规则：

- 恢复不会直接切换旧版本为当前版本
- 服务层必须复制历史快照，生成 `version_number = current + 1` 的新版本
- 新版本 `operation_type = 'restore'`
- 新版本 `source_version_id = 被恢复版本 ID`

## 7.9 `POST /api/prompt-assets/:id/archive`

用途：

- 归档资产

规则：

- 幂等操作
- 重复归档返回 `200`
- 归档后禁止新增版本

成功响应：

- 返回最新 `PromptAssetSummary`

## 7.10 `POST /api/prompt-assets/:id/unarchive`

用途：

- 取消归档

规则：

- 幂等操作
- 取消归档后允许继续新增版本

## 8. 服务层规则

## 8.1 资产创建

服务层必须：

1. 校验输入
2. 生成 `assetId`、`versionId`
3. 计算 `contentHash`
4. 在单事务中插入 `prompt_assets`
5. 在同一事务中插入 `prompt_asset_versions(version_number = 1)`
6. 返回当前态详情

## 8.2 生成新版本

服务层必须：

1. 查询资产当前态
2. 校验状态为 `active`
3. 校验 `expectedVersionNumber`
4. 计算新内容 `contentHash`
5. 判断是否与当前版本完全一致
6. 计算 `nextVersionNumber = currentVersionNumber + 1`
7. 在单事务中插入新版本并更新主表当前态

## 8.3 恢复版本

服务层必须：

1. 校验资产存在
2. 校验版本存在且属于当前资产
3. 校验资产状态为 `active`
4. 校验 `expectedVersionNumber`
5. 从目标历史版本复制 `name_snapshot`、`description_snapshot`、`content`
6. 生成新版本并推进主表 `current_version_number`

## 8.4 归档与取消归档

服务层必须：

- 只更新主表状态，不新增版本
- 正确维护 `archived_at` 与 `updated_at`
- 将操作设计为幂等

## 9. Repository 规范

Repository 建议提供以下方法：

```ts
interface PromptAssetRepository {
  list(params: ListPromptAssetsParams): Promise<Paginated<PromptAssetSummaryRow>>;
  findAssetById(id: string): Promise<PromptAssetRow | null>;
  findCurrentVersionByAssetId(assetId: string): Promise<PromptAssetVersionRow | null>;
  findVersionById(assetId: string, versionId: string): Promise<PromptAssetVersionRow | null>;
  listVersions(assetId: string, params: PaginationParams): Promise<Paginated<PromptAssetVersionRow>>;
  createAssetWithVersion(input: CreateAssetTxInput): Promise<void>;
  appendVersion(input: AppendVersionTxInput): Promise<void>;
  updateArchiveStatus(input: UpdateArchiveStatusTxInput): Promise<void>;
}
```

Repository 不得承担：

- 输入字段裁剪
- 错误码映射
- 版本冲突判断
- “无变化内容”判断

这些规则必须放在 Service。

## 10. 数据库运行规范

SQLite 初始化时建议设置：

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
```

原因：

- 开启外键约束
- 降低读写互斥影响
- 减少轻微锁竞争导致的瞬时失败

数据库文件位置建议：

- `data/app.db`

迁移要求：

- 所有表结构变更必须通过 `drizzle-kit` migration 管理
- 禁止手写 SQL 直接改线上 schema 而不留 migration

## 11. 测试规范

第一阶段至少覆盖以下测试：

- Service 层：创建、生成新版本、恢复、归档、取消归档
- Service 层：版本冲突、归档后更新、无变化内容拒绝
- Repository 层：列表分页、版本排序、版本归属校验
- Route Handler 层：参数校验、状态码、错误码、响应结构

建议测试策略：

- Repository/Service 使用临时 SQLite 文件或独立测试库
- Route Handler 使用 `vitest` + mock service

## 12. 实施顺序

建议按如下顺序落地：

1. 引入 `better-sqlite3`、`drizzle-orm`、`drizzle-kit`、`zod`、`ulid`
2. 建立 `db/client.ts`、schema 与 migration
3. 实现 Repository
4. 实现 Service 和领域错误
5. 实现 Route Handler
6. 补齐 Route/Service/Repository 测试
7. 最后再接前端资产面板与编辑器交互

## 13. 最终结论

第一阶段后端正式方案如下：

- 维持 `ProjectStore` 文件存储不变
- 新增 `Prompt Asset` 子系统，独立使用 `SQLite + Drizzle`
- API 以“显式版本资源”建模，避免伪装成原地更新
- 统一成功/失败响应结构和错误码
- 通过 Service 事务维护版本号、归档状态和恢复链路

这份规范是后续 API、数据库和实现代码的基线，若与早期草案冲突，以本文为准。
