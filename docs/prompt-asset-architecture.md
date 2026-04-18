# 提示词资产管理架构设计

## 补充说明

数据库详细设计见 [prompt-asset-database-design.md](/var/tmp/vibe-kanban/worktrees/fe0f-/aicontext/docs/prompt-asset-database-design.md)。

## 1. 背景

当前项目的核心能力是编辑 `Project`：

- 前端通过 `EditorContext` 管理当前项目状态
- 后端通过 `app/api/projects/**` 暴露 Route Handler
- 数据持久化由 `ProjectStore` 写入文件系统
- 项目历史通过 `data/<projectId>/history/*.json` 快照实现

这套机制适合“单个项目编辑”，但不适合“跨项目复用的提示词资产库”，原因有三点：

1. 文件快照难以做结构化查询，比如按名称搜索、按更新时间排序、按版本号回滚。
2. 提示词资产与项目是两个不同的领域对象，不应该强耦合在 `project.json` 里。
3. 你希望尝试 `SQLite + Drizzle ORM`，版本化数据正适合关系型建模和事务处理。

## 2. 目标与范围

### 2.1 功能目标

新增一个“提示词资产”子系统，用于保存常用提示词，并支持：

- 名称
- 描述
- 提示词正文
- 版本管理
- 查看历史版本
- 回滚到历史版本
- 将资产内容应用到当前项目的 `systemPrompt`

### 2.2 本期不做

为控制改动面，第一阶段不做：

- 用户/团队/权限体系
- 资产标签、文件夹、分享链接
- 项目存储整体迁移到 SQLite
- 多人并发编辑冲突处理

## 3. 核心架构决策

### 决策 A：提示词资产独立于现有项目存储

保留当前 `ProjectStore` 文件存储不变，新增一个独立的 `PromptAsset` 子系统。

原因：

- 现有项目编辑链路已经可用，没必要为了提示词资产一次性重构全站存储。
- 新能力可以独立演进，失败成本低。
- 后续如果验证成功，再考虑把 `Project` 迁移到 SQLite。

### 决策 B：版本采用“追加式快照”而不是“原地覆盖”

每次保存资产时，新增一条版本记录，不修改旧版本内容。

原因：

- 容易回滚
- 容易审计
- SQLite 事务能保证“写入新版本 + 更新当前版本指针”原子完成

### 决策 C：资产主表保存当前态，版本表保存完整快照

`prompt_assets` 保存当前展示态，`prompt_asset_versions` 保存每个版本的完整快照。

原因：

- 列表页不需要每次 join 全历史
- 版本恢复时只需要把某个历史版本复制为新版本
- 查询简单，UI 响应更直接

## 4. 目标架构

```text
Client UI
  ├─ Prompt Asset Panel / Drawer
  ├─ Prompt Asset Editor
  ├─ Version History List
  └─ Apply To System Prompt Action

Next.js App Router
  ├─ /api/projects/**                -> 继续走文件存储
  └─ /api/prompt-assets/**           -> 新增 SQLite + Drizzle 子系统

Application Layer
  ├─ ProjectStore                    -> fs/json
  └─ PromptAssetRepository           -> drizzle/sqlite

Persistence Layer
  ├─ data/<projectId>/project.json
  ├─ data/<projectId>/history/*.json
  └─ data/app.db                     -> prompt_assets / prompt_asset_versions
```

### 分层说明

#### 1. UI 层

新增提示词资产面板，职责：

- 列出所有提示词资产
- 搜索资产
- 查看当前版本
- 查看历史版本
- 新建、编辑、归档、恢复
- 一键应用到当前 `systemPrompt`

#### 2. Route Handler 层

继续沿用当前项目的组织方式，在 `app/api` 下增加新路由。

#### 3. Repository 层

新增 `PromptAssetRepository`，屏蔽 Drizzle 和 SQL 细节。

#### 4. Database 层

SQLite 负责：

- 结构化存储
- 唯一约束
- 排序和分页
- 事务
- 版本链维护

## 5. 数据模型设计

## 5.1 领域对象

### PromptAsset

代表一个稳定的提示词资产实体。

- `id`
- `name`
- `description`
- `currentVersionId`
- `currentVersionNumber`
- `status`
- `createdAt`
- `updatedAt`

### PromptAssetVersion

代表某个时间点的完整快照。

- `id`
- `assetId`
- `versionNumber`
- `nameSnapshot`
- `descriptionSnapshot`
- `content`
- `changeNote`
- `createdAt`

## 5.2 表设计

### 表一：`prompt_assets`

建议字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `text` | 主键，建议 `cuid`/`uuid` |
| `name` | `text` | 当前名称 |
| `description` | `text` | 当前描述 |
| `current_version_id` | `text` | 指向当前版本 |
| `current_version_number` | `integer` | 当前版本号 |
| `status` | `text` | `active` / `archived` |
| `created_at` | `integer` | Unix ms |
| `updated_at` | `integer` | Unix ms |
| `archived_at` | `integer nullable` | 归档时间 |

索引建议：

- `idx_prompt_assets_updated_at`
- `idx_prompt_assets_status`
- `idx_prompt_assets_name`

### 表二：`prompt_asset_versions`

建议字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `text` | 主键 |
| `asset_id` | `text` | 外键，关联 `prompt_assets.id` |
| `version_number` | `integer` | 从 1 开始递增 |
| `name_snapshot` | `text` | 该版本的名称快照 |
| `description_snapshot` | `text` | 该版本的描述快照 |
| `content` | `text` | 提示词正文 |
| `change_note` | `text nullable` | 版本说明 |
| `content_hash` | `text nullable` | 内容哈希，用于去重或审计 |
| `created_at` | `integer` | Unix ms |

约束建议：

- `unique(asset_id, version_number)`
- 外键 `asset_id -> prompt_assets.id`

### 可选表三：`prompt_asset_usage_logs`

不是第一阶段必须，但建议预留。

用途：

- 记录哪个项目在什么时间应用了哪个资产版本
- 后续支持“最近使用”“影响分析”“回溯生成上下文”

## 5.3 Drizzle Schema 示例

```ts
export const promptAssets = sqliteTable('prompt_assets', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  currentVersionId: text('current_version_id'),
  currentVersionNumber: integer('current_version_number').notNull().default(1),
  status: text('status', { enum: ['active', 'archived'] }).notNull().default('active'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
});

export const promptAssetVersions = sqliteTable(
  'prompt_asset_versions',
  {
    id: text('id').primaryKey(),
    assetId: text('asset_id').notNull().references(() => promptAssets.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    nameSnapshot: text('name_snapshot').notNull(),
    descriptionSnapshot: text('description_snapshot').notNull().default(''),
    content: text('content').notNull(),
    changeNote: text('change_note'),
    contentHash: text('content_hash'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    assetVersionUnique: uniqueIndex('uq_prompt_asset_version').on(table.assetId, table.versionNumber),
  })
);
```

## 6. 版本策略

## 6.1 创建资产

创建时执行一个事务：

1. 插入 `prompt_assets`
2. 插入 `prompt_asset_versions(version_number = 1)`
3. 回写 `prompt_assets.current_version_id`

## 6.2 更新资产

更新资产时不覆盖旧版本，而是：

1. 读取当前版本号
2. 新增 `version_number + 1`
3. 更新 `prompt_assets` 当前态和版本指针

## 6.3 回滚版本

回滚不要直接把历史版本标记为当前，而是：

1. 读取目标历史版本
2. 复制该版本内容生成一个新版本
3. 新版本号继续递增
4. 更新 `prompt_assets.current_version_id`

这样可以保留完整操作链。

## 6.4 是否所有修改都产生版本

建议第一阶段采用“显式保存产生新版本”：

- 用户在编辑器里修改 `name / description / content`
- 点击“保存为新版本”后才落库

不要做输入即自动生成版本，否则版本噪音会非常高。

## 7. API 设计

保持与现有 `/api/projects/**` 一致的风格，新增：

### `GET /api/prompt-assets`

用途：

- 资产列表
- 支持 `query`
- 支持 `status`
- 支持分页

响应返回当前态，不返回全部历史。

### `POST /api/prompt-assets`

用途：

- 新建资产
- 默认生成版本 `v1`

请求体：

```json
{
  "name": "代码评审提示词",
  "description": "用于通用代码 review",
  "content": "你是一名严谨的代码审查专家",
  "changeNote": "初始版本"
}
```

### `GET /api/prompt-assets/:id`

用途：

- 获取单个资产当前态
- 可选附带最近版本列表

### `PUT /api/prompt-assets/:id`

用途：

- 基于当前编辑内容创建新版本

### `GET /api/prompt-assets/:id/versions`

用途：

- 查询版本历史

### `GET /api/prompt-assets/:id/versions/:versionId`

用途：

- 查看具体版本详情

### `POST /api/prompt-assets/:id/restore`

用途：

- 将历史版本恢复为一个新的当前版本

请求体：

```json
{
  "versionId": "ver_xxx",
  "changeNote": "从 v3 回滚"
}
```

### `DELETE /api/prompt-assets/:id`

建议语义做成“归档”而不是物理删除。

如果确实需要物理删除，可单独提供管理命令，不暴露在普通 UI。

## 8. 前端交互设计

## 8.1 UI 放置建议

当前页面中最合适的入口有两个：

### 方案 A：集成到 `SystemPromptEditor`

在现有系统提示词编辑器顶部增加：

- `从资产库选择`
- `保存为资产`
- `查看版本`

优点：

- 与主要使用场景最近
- 用户心智简单

缺点：

- `SystemPromptEditor` 会变重

### 方案 B：新增独立的 Prompt Asset Drawer

从 `Header` 打开右侧面板，专门管理资产。

优点：

- 资产管理是完整的独立模块
- 便于后续增加搜索、筛选、版本历史

缺点：

- 从编辑到应用多一步

### 建议

第一阶段采用“组合方案”：

- `Header` 增加“提示词资产库”入口
- `SystemPromptEditor` 增加“从资产应用”和“保存为资产”快捷按钮

这样既保留独立管理能力，也不牺牲高频操作效率。

## 8.2 前端状态设计

不要把提示词资产状态塞进现有 `EditorContext`。

建议新增独立上下文或轻量 hook，例如：

- `PromptAssetContext`
- 或 `usePromptAssets()`

原因：

- 项目编辑状态和资产库状态是两个 bounded context
- 避免 `EditorContext` 继续膨胀
- 便于未来资产库页面独立复用

## 8.3 关键交互流

### 流程 1：从资产应用到当前项目

1. 用户打开资产库
2. 选择某个资产当前版本
3. 点击“应用到 System Prompt”
4. 前端调用 `updateSystemPrompt(content)`
5. 当前项目仍沿用现有保存机制

### 流程 2：将当前 System Prompt 保存为资产

1. 读取当前 `currentProject.systemPrompt`
2. 弹出保存弹窗
3. 输入名称、描述、版本说明
4. 调用 `POST /api/prompt-assets`

### 流程 3：编辑已有资产并生成新版本

1. 打开资产详情
2. 编辑名称、描述、正文
3. 点击保存
4. `PUT /api/prompt-assets/:id`
5. 后端创建新版本并更新当前版本指针

## 9. 代码组织建议

建议新增如下结构：

```text
app/
  api/
    prompt-assets/
      route.ts
      [id]/
        route.ts
        versions/
          route.ts
          [versionId]/
            route.ts
        restore/
          route.ts
  components/
    prompt-assets/
      PromptAssetDrawer.tsx
      PromptAssetList.tsx
      PromptAssetEditor.tsx
      PromptAssetVersionList.tsx
      SaveAsPromptAssetDialog.tsx
  lib/
    db/
      client.ts
      schema/
        prompt-assets.ts
    repositories/
      prompt-asset-repository.ts
    services/
      prompt-asset-service.ts
```

职责分工建议：

- `db/client.ts`：初始化 SQLite 和 Drizzle
- `schema/prompt-assets.ts`：表结构定义
- `repositories/prompt-asset-repository.ts`：纯数据访问
- `services/prompt-asset-service.ts`：封装版本号递增、回滚等业务规则

## 10. 迁移与上线策略

## 阶段一：只落提示词资产

内容：

- 引入 SQLite 与 Drizzle
- 新增提示词资产表
- 新增 API
- 新增资产管理 UI
- 支持应用到 `systemPrompt`

收益：

- 需求闭环
- 对现有项目编辑影响最小

## 阶段二：补充资产引用关系

可选新增：

- `projectId`
- `assetId`
- `versionId`

用于记录“某个项目当前 systemPrompt 来源于哪个资产版本”。

这样后续可以支持：

- 提示用户当前项目使用的是哪条资产
- 检查资产更新后是否同步到项目

## 阶段三：评估项目存储迁移

如果 SQLite 子系统运行稳定，再评估是否把 `ProjectStore` 从文件系统迁移到 Drizzle。

不建议现在一起做，风险过高。

## 11. 风险与应对

### 风险 1：两套存储并存

现状会变成：

- 项目走文件系统
- 提示词资产走 SQLite

这是可接受的阶段性复杂度，因为两个领域边界清晰。

### 风险 2：版本过多

如果每次小改动都自动保存，会导致版本噪音。

应对：

- 只在显式保存时创建版本
- 支持填写 `changeNote`

### 风险 3：未来资产和项目关系不清

如果只做“复制内容到 systemPrompt”，未来会缺少引用关系。

应对：

- 第一阶段允许纯复制
- 第二阶段补 usage/reference 关系表

## 12. 推荐实施顺序

1. 引入 `sqlite + drizzle + migration` 基础设施
2. 建立 `prompt_assets` 与 `prompt_asset_versions`
3. 完成 `PromptAssetRepository` 和 `PromptAssetService`
4. 提供 `list/create/update/restore/archive` API
5. 新增资产库面板
6. 在 `SystemPromptEditor` 增加“应用资产”和“保存为资产”
7. 增加测试，覆盖版本递增、回滚、归档、列表查询

## 13. 最终建议

这次设计建议采用“增量式架构”：

- 不改现有项目存储
- 提示词资产单独建模
- 用 SQLite + Drizzle 处理版本化数据
- 用 UI 快捷操作把资产库和 `SystemPromptEditor` 串起来

这是当前成本最低、边界最清晰、最容易验证的一条路线。
