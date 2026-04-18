# 提示词管理数据库设计方案

> 基于 [prompt-asset-architecture.md](./prompt-asset-architecture.md) 的详细数据库设计。  
> API 契约、服务分层和技术选型见 [prompt-asset-backend-spec.md](./prompt-asset-backend-spec.md)。

## 1. 设计目标

本方案面向“提示词资产管理”子系统，目标是支持以下能力：

- 提示词资产的结构化存储
- 当前版本与历史版本的清晰分离
- 新建、编辑、归档、回滚等操作的事务一致性
- 列表查询、版本查询、按名称搜索的可扩展性
- 与现有文件型 `ProjectStore` 并存，不耦合项目主存储

## 2. 设计原则

### 2.1 领域边界

- `Project` 仍保留在文件系统中
- `PromptAsset` 是独立领域对象，单独建模到 SQLite
- “应用到项目”在第一阶段视为内容复制，不建立强引用约束

### 2.2 版本策略

- 所有内容修改都通过“新增版本”实现
- 不覆盖旧版本，不做 in-place update
- 回滚本质上是“从历史版本复制出一个新版本”

### 2.3 物理模型取舍

在架构文档中，`prompt_assets` 包含 `current_version_id` 与 `current_version_number` 两个字段。数据库落地时，推荐将“当前版本指针”简化为 `current_version_number`，原因如下：

- 避免 `prompt_assets` 与 `prompt_asset_versions` 的循环外键
- SQLite + Drizzle 下迁移和事务实现更直接
- 通过 `unique(asset_id, version_number)` 已能唯一定位当前版本

因此，本文采用：

- `prompt_assets.current_version_number` 作为当前版本指针
- `prompt_asset_versions.id` 继续作为 API 和版本详情查询主键

如果后续确实需要 `current_version_id`，建议只作为冗余读优化字段，由应用层维护，不作为第一阶段强约束字段。

## 3. 核心实体

### 3.1 `prompt_assets`

表示一个稳定存在的提示词资产。

职责：

- 保存当前展示态
- 保存资产生命周期状态
- 为列表页提供高频查询字段

### 3.2 `prompt_asset_versions`

表示某个资产在某个时间点的完整快照。

职责：

- 保存可审计的历史内容
- 为回滚提供来源数据
- 保留名称、描述、正文的完整快照

### 3.3 `prompt_asset_apply_logs`

第二阶段可选表，不作为第一阶段必建表。

职责：

- 记录某个项目在何时应用了哪个提示词版本
- 支撑“最近使用”“来源追踪”“更新提醒”

## 4. 概念模型

```text
prompt_assets 1 --- n prompt_asset_versions
prompt_assets 1 --- n prompt_asset_apply_logs   (optional)
prompt_asset_versions 1 --- n prompt_asset_apply_logs   (optional)
```

约束含义：

- 一个资产必须至少有一个版本
- 一个版本只能属于一个资产
- 一个资产任意时刻只有一个当前版本号
- 已归档资产默认不可编辑，但历史仍保留

## 5. 字段与约束设计

## 5.1 表一：`prompt_assets`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | `text` | 是 | 主键，建议 `ulid` / `cuid2` |
| `name` | `text` | 是 | 当前名称，建议限制 1-120 字符 |
| `description` | `text` | 是 | 当前描述，默认空串 |
| `current_version_number` | `integer` | 是 | 当前版本号，`>= 1` |
| `status` | `text` | 是 | `active` / `archived` |
| `created_at` | `integer` | 是 | Unix epoch ms |
| `updated_at` | `integer` | 是 | Unix epoch ms |
| `archived_at` | `integer` | 否 | 归档时间，未归档时为 `null` |

建议约束：

- `primary key(id)`
- `check(length(trim(name)) between 1 and 120)`
- `check(current_version_number >= 1)`
- `check(status in ('active', 'archived'))`
- `check((status = 'archived' and archived_at is not null) or (status = 'active' and archived_at is null))`

说明：

- `name` 与 `description` 保存在主表，是为了避免列表页每次关联历史版本表
- `updated_at` 表示资产当前态最后一次变化时间，不等同于首次创建时间
- 不建议在第一阶段给 `name` 加唯一约束，避免常见模板名冲突

## 5.2 表二：`prompt_asset_versions`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | `text` | 是 | 主键 |
| `asset_id` | `text` | 是 | 外键，关联 `prompt_assets.id` |
| `version_number` | `integer` | 是 | 资产内递增版本号，从 1 开始 |
| `name_snapshot` | `text` | 是 | 该版本的名称快照 |
| `description_snapshot` | `text` | 是 | 该版本的描述快照 |
| `content` | `text` | 是 | 提示词正文 |
| `change_note` | `text` | 否 | 版本备注 |
| `content_hash` | `text` | 是 | 正文哈希，建议 SHA-256 |
| `operation_type` | `text` | 是 | `create` / `update` / `restore` / `import` |
| `source_version_id` | `text` | 否 | 若为回滚生成的新版本，记录来源版本 ID |
| `created_at` | `integer` | 是 | Unix epoch ms |

建议约束：

- `primary key(id)`
- `foreign key(asset_id) references prompt_assets(id) on delete cascade`
- `unique(asset_id, version_number)`
- `check(version_number >= 1)`
- `check(length(trim(name_snapshot)) between 1 and 120)`
- `check(length(content) > 0)`
- `check(operation_type in ('create', 'update', 'restore', 'import'))`
- `foreign key(source_version_id) references prompt_asset_versions(id) on delete set null`

说明：

- `name_snapshot` 和 `description_snapshot` 必须保留，避免历史版本展示依赖主表当前值
- `content_hash` 用于审计、幂等保存判断、未来去重分析
- `source_version_id` 主要服务于“回滚产生新版本”的可追溯性

## 5.3 表三：`prompt_asset_apply_logs`（第二阶段）

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | `text` | 是 | 主键 |
| `project_id` | `text` | 是 | 对应文件存储中的 `ProjectMeta.id` |
| `asset_id` | `text` | 是 | 资产 ID |
| `asset_version_id` | `text` | 是 | 被应用的版本 ID |
| `applied_content_hash` | `text` | 是 | 应用时正文哈希 |
| `applied_at` | `integer` | 是 | 应用时间 |

建议约束：

- `primary key(id)`
- `foreign key(asset_id) references prompt_assets(id) on delete cascade`
- `foreign key(asset_version_id) references prompt_asset_versions(id) on delete cascade`

说明：

- `project_id` 不设外键，因为项目当前不在 SQLite 中
- 即使项目后续被删除，保留日志仍有分析价值

## 6. 索引设计

索引应直接服务于 API 查询场景，而不是平均分配。

### 6.1 `prompt_assets`

建议索引：

- `idx_prompt_assets_status_updated_at(status, updated_at desc)`
- `idx_prompt_assets_name(name)`
- `idx_prompt_assets_created_at(created_at desc)`

适配场景：

- `GET /api/prompt-assets?status=active`
- 列表按更新时间倒序
- 名称前缀搜索

注意：

如果产品要求“名称/描述/正文任意关键词包含搜索”，普通 B-Tree 索引效果有限。此时应新增 SQLite FTS5 虚表，而不是继续堆叠普通索引。

### 6.2 `prompt_asset_versions`

建议索引：

- `uq_prompt_asset_versions_asset_version(asset_id, version_number)`
- `idx_prompt_asset_versions_asset_created_at(asset_id, created_at desc)`
- `idx_prompt_asset_versions_source_version_id(source_version_id)`
- `idx_prompt_asset_versions_content_hash(content_hash)`

适配场景：

- 查询某资产版本历史
- 按版本号获取当前版本
- 追踪某次回滚来源
- 判断内容是否与当前版本重复

## 7. 推荐 SQL DDL

```sql
create table if not exists prompt_assets (
  id text primary key,
  name text not null,
  description text not null default '',
  current_version_number integer not null,
  status text not null default 'active',
  created_at integer not null,
  updated_at integer not null,
  archived_at integer,
  check (length(trim(name)) between 1 and 120),
  check (current_version_number >= 1),
  check (status in ('active', 'archived')),
  check (
    (status = 'archived' and archived_at is not null)
    or
    (status = 'active' and archived_at is null)
  )
);

create table if not exists prompt_asset_versions (
  id text primary key,
  asset_id text not null,
  version_number integer not null,
  name_snapshot text not null,
  description_snapshot text not null default '',
  content text not null,
  change_note text,
  content_hash text not null,
  operation_type text not null,
  source_version_id text,
  created_at integer not null,
  foreign key (asset_id) references prompt_assets(id) on delete cascade,
  foreign key (source_version_id) references prompt_asset_versions(id) on delete set null,
  unique (asset_id, version_number),
  check (version_number >= 1),
  check (length(trim(name_snapshot)) between 1 and 120),
  check (length(content) > 0),
  check (operation_type in ('create', 'update', 'restore', 'import'))
);

create index if not exists idx_prompt_assets_status_updated_at
  on prompt_assets(status, updated_at desc);

create index if not exists idx_prompt_assets_name
  on prompt_assets(name);

create index if not exists idx_prompt_assets_created_at
  on prompt_assets(created_at desc);

create index if not exists idx_prompt_asset_versions_asset_created_at
  on prompt_asset_versions(asset_id, created_at desc);

create index if not exists idx_prompt_asset_versions_source_version_id
  on prompt_asset_versions(source_version_id);

create index if not exists idx_prompt_asset_versions_content_hash
  on prompt_asset_versions(content_hash);
```

## 8. 可选全文检索设计

如果搜索需求升级为“按名称、描述、正文全文搜索”，建议新增 FTS5：

```sql
create virtual table if not exists prompt_asset_search using fts5(
  asset_id unindexed,
  name,
  description,
  content,
  tokenize = 'unicode61'
);
```

推荐做法：

- 由应用层在创建版本时同步更新 FTS 表
- 搜索结果先得到 `asset_id` 列表，再回表查询当前态

第一阶段如果只需要“名称前缀搜索”，不建议上来就引入 FTS5。

## 9. 核心事务设计

## 9.1 创建资产

事务步骤：

1. 插入 `prompt_assets`，`current_version_number = 1`
2. 插入 `prompt_asset_versions`，`version_number = 1`
3. 提交事务

写入结果：

- 主表保存当前态
- 版本表保存首个快照

## 9.2 更新资产

事务步骤：

1. 查询 `prompt_assets.current_version_number`
2. 计算 `next_version_number = current_version_number + 1`
3. 插入新的 `prompt_asset_versions`
4. 更新 `prompt_assets.name`
5. 更新 `prompt_assets.description`
6. 更新 `prompt_assets.current_version_number`
7. 更新 `prompt_assets.updated_at`
8. 提交事务

关键点：

- 不更新历史版本
- 主表中的当前态必须与最新版本快照一致

## 9.3 回滚历史版本

事务步骤：

1. 读取目标 `version_id`
2. 校验该版本属于当前资产
3. 读取当前 `current_version_number`
4. 以目标版本快照内容插入一个新版本，`operation_type = 'restore'`
5. `source_version_id = 被恢复的历史版本 ID`
6. 更新主表当前态与 `current_version_number`
7. 提交事务

关键点：

- 不直接修改旧版本
- 不把历史版本“重新标记为当前”
- 所有回滚动作都能追踪来源

## 9.4 归档资产

事务步骤：

1. 更新 `status = 'archived'`
2. 更新 `archived_at`
3. 更新 `updated_at`

建议规则：

- 归档不删除版本数据
- 归档后默认不允许继续新增版本
- 若需要恢复，单独提供“取消归档”动作

## 10. 关键查询设计

### 10.1 列表查询

目标：

- 获取资产当前态
- 支持 `status`
- 支持 `query`
- 按 `updated_at desc` 排序

推荐做法：

- 列表页只查 `prompt_assets`
- 详情页或版本页再查 `prompt_asset_versions`

### 10.2 查询当前版本详情

推荐查询逻辑：

```sql
select
  a.id,
  a.name,
  a.description,
  a.current_version_number,
  a.status,
  a.created_at,
  a.updated_at,
  v.id as version_id,
  v.content,
  v.change_note,
  v.created_at as version_created_at
from prompt_assets a
join prompt_asset_versions v
  on v.asset_id = a.id
 and v.version_number = a.current_version_number
where a.id = ?;
```

### 10.3 查询版本历史

推荐排序：

- 默认 `version_number desc`
- 不按 `created_at` 替代版本号排序，避免人工修复数据时出现歧义

## 11. 业务规则与数据不变量

以下规则建议由“数据库约束 + 服务层校验”共同保证：

- 资产创建后必须至少存在一个版本
- `prompt_assets.current_version_number` 必须等于该资产已存在的最大版本号
- 历史版本不可修改，只能新增
- 归档资产默认不能更新
- 恢复历史版本时，目标版本必须属于当前资产
- 若新内容与当前版本 `content_hash`、`name`、`description` 全部一致，可拒绝生成新版本，避免空转版本

说明：

- “当前版本号必须等于最大版本号”很难单靠 SQLite `check` 保证，应放在服务层事务中维护，并通过测试兜底

## 12. 与现有项目存储的关系

当前仓库的 `ProjectStore` 仍使用：

- `data/<projectId>/project.json`
- `data/<projectId>/history/*.json`

因此数据库设计不应强耦合 `projects` 表。第一阶段边界如下：

- 提示词资产负责“可复用模板”的版本管理
- 项目负责“当前会话编辑内容”的存储
- “应用资产到项目”只更新 `currentProject.systemPrompt`

这可以避免一次性把整个项目系统迁移到 SQLite。

## 13. 迁移与实施建议

推荐分三步落地：

1. 先创建 `prompt_assets` 与 `prompt_asset_versions`
2. 完成 Repository / Service / API 后再接 UI
3. 等“应用来源追踪”需求明确后再补 `prompt_asset_apply_logs`

实现层建议：

- 时间字段统一使用 Unix epoch ms，便于 SQLite 排序与 Drizzle 映射
- API 输出时再转换为前端需要的格式
- ID 统一使用同一生成策略，避免主键风格混杂

## 14. 最终建议

第一阶段最稳妥的数据库方案是两张核心表：

- `prompt_assets` 保存当前态
- `prompt_asset_versions` 保存完整快照

同时明确两个关键设计：

- 用 `current_version_number` 而不是强依赖 `current_version_id` 作为当前版本指针
- 用追加式版本表处理编辑与回滚，而不是覆盖更新

这样可以在不改动现有 `ProjectStore` 的前提下，为提示词管理提供足够稳定的关系型基础。
