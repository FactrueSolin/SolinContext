# Project JSON 到 SQLite 迁移数据库设计方案

## 1. 文档目标

本文定义当前 `ProjectStore` 从“文件系统 JSON 存储”迁移到 `SQLite` 的目标数据库方案，覆盖：

- 现状分析与迁移动机
- 目标库表设计
- 现有 JSON 目录到表结构的映射关系
- 读写流程、历史版本与兼容策略
- 分阶段迁移与回滚方案

本文只聚焦 `Project` 领域。已有的 `Prompt Asset` SQLite 方案继续保留，并建议与 `Project` 共用同一个 `app.db`。

## 2. 当前现状

基于当前仓库实现，`Project` 仍采用本地文件系统持久化：

- 当前项目文件：`data/{projectId}/project.json`
- 历史快照目录：`data/{projectId}/history/*.json`
- 运行时入口：`app/lib/project-store.ts`
- 当前路径配置：`app/lib/runtime-paths.ts`
- 当前 SQLite 基础设施：`app/lib/db/client.ts`

当前 `ProjectData` 结构如下：

- `meta`
  - `id`
  - `name`
  - `createdAt`
  - `updatedAt`
- `systemPrompt`
- `messages`
- `apiConfig`

当前 API 语义如下：

- `GET /api/projects`：返回项目元数据列表
- `GET /api/projects/[id]`：返回当前项目完整内容
- `PUT /api/projects/[id]`：保存项目，并把旧版本写入历史
- `DELETE /api/projects/[id]`：删除项目及其历史
- `GET /api/projects/[id]/history`：列出历史快照
- `GET /api/projects/[id]/history/[filename]`：读取某个历史快照
- `POST /api/projects/[id]/duplicate`：复制当前项目

## 3. 当前方案的主要问题

### 3.1 文件系统不利于统一查询

当前项目列表需要遍历 `data/` 下所有目录，再逐个读取 `project.json`。随着项目数量增加，列表性能和运维可观测性都会下降。

### 3.2 历史版本不可查询

历史记录本质上是“散落的 JSON 快照文件”，只能按文件名枚举，无法做统一排序、统计、清理策略和数据校验。

### 3.3 与现有 SQLite 能力割裂

`Prompt Asset` 已经使用 `SQLite + Drizzle + migration`，但 `Project` 仍走文件系统，导致：

- 运维上有两套存储模型
- 测试和事务边界不统一
- Docker 持久化虽然共用 `data/`，但无法在数据库层统一治理

### 3.4 多实例和后续扩展受限

文件系统模型不利于未来的：

- 项目查询和筛选
- 用户/工作区隔离
- 审计
- 统一备份
- 增量迁移

## 4. 设计目标

本次迁移目标如下：

1. 将 `Project` 当前状态和历史快照全量迁移到 `SQLite`
2. 保持现有 API 语义不变，前端尽量无感
3. 保留“每次保存前自动生成历史”的能力
4. 与现有 `Prompt Asset` 共用同一个数据库文件 `data/app.db`
5. 为未来的多用户/工作区扩展保留演进空间

非目标：

- 本期不把 `messages/content blocks` 完全拆成细粒度关系表
- 本期不改变前端项目编辑数据结构
- 本期不引入复杂全文检索和协同编辑模型

## 5. 总体设计结论

建议采用“项目主表 + 项目版本表”的混合快照模型：

- `projects`：保存项目主元数据和当前版本指针
- `project_revisions`：保存每个版本的完整业务快照

这是本仓库当前阶段最合适的折中方案，原因如下：

### 5.1 不建议继续使用单表 JSON 大对象

若把所有字段只放进一个 `projects.payload_json` 列中，虽然迁移最简单，但会带来：

- 列表查询仍依赖 JSON 解析
- 历史版本能力仍要另加补丁
- 元数据索引能力不足

### 5.2 不建议本期过度范式化

若把 `messages`、`content blocks`、`tool results` 全部拆成多张表，虽然理论上最规范，但和当前真实需求不匹配：

- 现有 API 总是按“完整项目”读写
- 当前没有基于 message/block 的复杂查询
- 迁移成本高，测试面大，回归风险高

### 5.3 采用“关系字段 + JSON 快照”的混合模型

将“需要被查询和排序的字段”结构化存储，把“结构复杂且当前不需要局部查询的字段”保留为 JSON 文本，是最稳妥方案：

- `name`、`created_at`、`updated_at`、`revision_number` 走结构化列
- `messages`、`api_config` 走 JSON 文本列
- `system_prompt` 单列存储，便于后续演进

## 6. 目标数据模型

## 6.1 表一：`projects`

用途：保存项目主记录，以及“当前版本”定位信息。

建议字段：

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `text` | PK | 项目 ID，沿用现有 `meta.id` |
| `name` | `text` | NOT NULL | 当前项目名称，用于列表查询 |
| `current_revision_id` | `text` | NOT NULL, UNIQUE, FK | 指向当前版本 |
| `created_at` | `integer` | NOT NULL | Unix epoch ms |
| `updated_at` | `integer` | NOT NULL | 当前版本更新时间 |
| `deleted_at` | `integer` | NULL | 预留软删能力；本期可不启用 |
| `row_version` | `integer` | NOT NULL DEFAULT 1 | 预留并发控制 |

建议索引：

- `idx_projects_updated_at` on (`updated_at` desc)
- `idx_projects_name` on (`name`)
- `idx_projects_deleted_at_updated_at` on (`deleted_at`, `updated_at` desc)

建议约束：

- `length(trim(name)) between 1 and 120`
- `updated_at >= created_at`
- `row_version >= 1`

## 6.2 表二：`project_revisions`

用途：保存项目的完整快照历史。每一次创建、保存、复制、导入、迁移都会生成一条版本记录。

建议字段：

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `text` | PK | 版本 ID，建议 `ulid` |
| `project_id` | `text` | NOT NULL, FK | 归属项目 |
| `revision_number` | `integer` | NOT NULL | 项目内单调递增版本号 |
| `history_key` | `text` | NOT NULL | 历史访问标识，对外兼容当前 `filename` 语义 |
| `name_snapshot` | `text` | NOT NULL | 当时的项目名 |
| `system_prompt` | `text` | NOT NULL | 当时的 system prompt |
| `messages_json` | `text` | NOT NULL | 当时的 `messages` JSON |
| `api_config_json` | `text` | NOT NULL | 当时的 `apiConfig` JSON |
| `content_hash` | `text` | NOT NULL | 快照哈希，用于校验和幂等导入 |
| `operation_type` | `text` | NOT NULL | `create/update/duplicate/import/migrate` |
| `source_revision_id` | `text` | NULL, FK | 来源版本，复制/恢复时可追踪 |
| `created_at` | `integer` | NOT NULL | 此版本生成时间 |
| `legacy_source_path` | `text` | NULL | 仅迁移阶段保留，记录原文件路径 |

建议索引：

- `uq_project_revisions_project_revision` on (`project_id`, `revision_number`)
- `uq_project_revisions_project_history_key` on (`project_id`, `history_key`)
- `idx_project_revisions_project_created_at` on (`project_id`, `created_at` desc)
- `idx_project_revisions_content_hash` on (`content_hash`)
- `idx_project_revisions_source_revision_id` on (`source_revision_id`)

建议约束：

- `revision_number >= 1`
- `length(system_prompt) >= 0`
- `json_valid(messages_json)`
- `json_valid(api_config_json)`
- `operation_type in ('create', 'update', 'duplicate', 'import', 'migrate')`
- `length(trim(name_snapshot)) between 1 and 120`

## 6.3 推荐 DDL 草案

```sql
create table projects (
  id text primary key not null,
  name text not null,
  current_revision_id text not null unique,
  created_at integer not null,
  updated_at integer not null,
  deleted_at integer,
  row_version integer not null default 1,
  foreign key (current_revision_id) references project_revisions(id),
  constraint ck_projects_name_length
    check (length(trim(name)) between 1 and 120),
  constraint ck_projects_row_version
    check (row_version >= 1),
  constraint ck_projects_updated_ge_created
    check (updated_at >= created_at)
);

create table project_revisions (
  id text primary key not null,
  project_id text not null,
  revision_number integer not null,
  history_key text not null,
  name_snapshot text not null,
  system_prompt text not null,
  messages_json text not null,
  api_config_json text not null,
  content_hash text not null,
  operation_type text not null,
  source_revision_id text,
  created_at integer not null,
  legacy_source_path text,
  foreign key (project_id) references projects(id) on delete cascade,
  foreign key (source_revision_id) references project_revisions(id) on delete set null,
  constraint ck_project_revisions_revision_number
    check (revision_number >= 1),
  constraint ck_project_revisions_name_length
    check (length(trim(name_snapshot)) between 1 and 120),
  constraint ck_project_revisions_messages_json
    check (json_valid(messages_json)),
  constraint ck_project_revisions_api_config_json
    check (json_valid(api_config_json)),
  constraint ck_project_revisions_operation_type
    check (operation_type in ('create', 'update', 'duplicate', 'import', 'migrate')),
  constraint uq_project_revisions_project_revision
    unique (project_id, revision_number),
  constraint uq_project_revisions_project_history_key
    unique (project_id, history_key)
);

create index idx_projects_updated_at
  on projects(updated_at desc);

create index idx_projects_name
  on projects(name);

create index idx_project_revisions_project_created_at
  on project_revisions(project_id, created_at desc);

create index idx_project_revisions_content_hash
  on project_revisions(content_hash);
```

说明：

- SQLite 支持延迟创建外键引用时序，但在实际 Drizzle 建模时，建议按 schema 拆文件并统一导出。
- 若担心 `projects.current_revision_id` 与 `project_revisions.project_id` 的互相依赖，可在 migration 中拆成两步创建，或先建表后补充 FK。

## 7. JSON 到表结构的映射关系

### 7.1 当前目录与目标表映射

| 旧存储 | 新存储 |
| --- | --- |
| `data/{projectId}/project.json` | `projects` 1 行 + `project_revisions` 当前版本 1 行 |
| `data/{projectId}/history/*.json` | `project_revisions` 历史版本多行 |

### 7.2 `project.json` 映射规则

| JSON 路径 | 目标字段 |
| --- | --- |
| `meta.id` | `projects.id`, `project_revisions.project_id` |
| `meta.name` | `projects.name`, `project_revisions.name_snapshot` |
| `meta.createdAt` | `projects.created_at` |
| `meta.updatedAt` | `projects.updated_at`, 当前版本 `project_revisions.created_at` |
| `systemPrompt` | `project_revisions.system_prompt` |
| `messages` | `project_revisions.messages_json` |
| `apiConfig` | `project_revisions.api_config_json` |

### 7.3 历史快照映射规则

历史目录下的每个 `history/{filename}.json` 迁移为一条 `project_revisions`：

- `history_key`：直接保存原 `filename`
- `legacy_source_path`：保存原始绝对路径或相对路径
- `created_at`：优先使用 `filename` 解析出的时间；解析失败时退回快照内 `meta.updatedAt`
- `operation_type`：统一记为 `migrate`

### 7.4 关于 `history_key`

当前 API 使用 `filename` 作为历史快照寻址参数，因此迁移后不建议立即改掉这个外部契约。

建议做法：

- 数据库内部字段名使用 `history_key`
- API 层继续把 `history_key` 映射成返回值里的 `filename`
- `GET /api/projects/[id]/history/[filename]` 改为按 `project_id + history_key` 查询

这样可以在前端无感的前提下完成底层切换。

## 8. 读写流程设计

## 8.1 创建项目

写入策略：

1. 插入一条 `project_revisions`
   - `revision_number = 1`
   - `operation_type = 'create'`
2. 插入一条 `projects`
   - `current_revision_id = 第一步新版本 ID`
   - `updated_at = revision.created_at`

## 8.2 读取项目详情

查询策略：

1. 读取 `projects`
2. 用 `current_revision_id` 关联 `project_revisions`
3. 组装回 `ProjectData`

## 8.3 保存项目

当前文件系统语义是“先把旧项目写入 history，再把新项目写成 current”。在数据库里建议等价改造为：

1. 开启事务
2. 读取当前 `projects.current_revision_id`
3. 计算新的 `revision_number = old + 1`
4. 插入一条新 `project_revisions`
   - 内容为本次保存后的完整项目快照
   - `operation_type = 'update'`
   - `source_revision_id = 旧 current_revision_id`
5. 更新 `projects`
   - `name = 新项目名`
   - `current_revision_id = 新 revision id`
   - `updated_at = 新 revision.created_at`
   - `row_version = row_version + 1`
6. 提交事务

结果：

- 原来的 current revision 自动变成历史版本
- 不需要再额外复制一份“旧 current 到 history”
- 历史链天然完整

## 8.4 列出项目列表

直接查询 `projects`：

- 只返回 `id/name/created_at/updated_at`
- 按 `updated_at desc` 排序

这一点比当前逐目录扫描更高效。

## 8.5 列出历史

查询 `project_revisions`：

- 条件：`project_id = ?`
- 排除：`id = projects.current_revision_id`
- 排序：`created_at desc`

返回时映射为：

- `filename = history_key`
- `timestamp = ISO(created_at)`

## 8.6 读取历史版本

查询条件：

- `project_id = ?`
- `history_key = ?`

返回内容按 `ProjectData` 结构重建，但 `meta.updatedAt` 应使用该 revision 的 `created_at`。

## 8.7 复制项目

复制不是复制整条历史链，只复制当前快照，行为与现状保持一致：

1. 读取源项目当前版本
2. 生成新 `project_id`
3. 插入新项目的 revision 1
4. `operation_type = 'duplicate'`
5. `source_revision_id = 源项目 current_revision_id`

## 8.8 删除项目

默认保持当前语义：硬删除。

执行方式：

- 删除 `projects`
- 依赖 `project_revisions.project_id on delete cascade` 自动删版本历史

如果后续要支持回收站，再启用 `deleted_at` 软删即可。

## 9. 为什么不拆 `messages` / `content blocks`

当前 `messages` 结构具备以下特点：

- 嵌套层级深
- block 类型多且还在演进
- 当前没有跨项目按 block 查询的真实需求
- API 永远以完整 JSON 形态出入

因此本期把它们保存在 `messages_json` 是正确选择。这样做的收益：

- 迁移过程无损
- 与现有前端数据结构一致
- 避免每增加一个 block 类型就做一次数据库 schema 变更

未来只有在出现以下需求时，才值得继续拆表：

- 按消息内容做检索
- 对单条消息做增量更新
- 对工具调用结果做统计分析
- 多人协同到 message/block 级别

## 10. 与现有 SQLite 子系统的整合建议

当前 `app/lib/db/client.ts` 仍是 `Prompt Asset` 定制上下文。迁移 `Project` 后，建议调整为“通用应用数据库上下文”：

### 10.1 统一数据库文件

继续使用：

- 默认库文件：`data/app.db`
- `WAL`
- `foreign_keys = ON`
- `busy_timeout = 5000`

### 10.2 schema 组织建议

建议拆分为：

- `app/lib/db/schema/prompt-assets.ts`
- `app/lib/db/schema/projects.ts`
- `app/lib/db/schema/index.ts`

统一由 `schema/index.ts` 导出，再由数据库 client 加载。

### 10.3 仓储层建议

新增：

- `app/lib/projects/repository.ts`
- `app/lib/projects/mapper.ts`

逐步替代当前 `app/lib/project-store.ts` 的文件系统实现。

建议先保留 `ProjectStore` 这个调用入口，对上层 API 不改名，只把底层实现替换为数据库仓储。

## 11. 数据迁移方案

建议按 4 个阶段推进。

## 11.1 阶段 A：建表但不切流量

动作：

1. 新增 `projects` / `project_revisions` schema
2. 生成 Drizzle migration
3. 启动时自动迁移数据库

目标：

- 先把数据库结构准备好
- 不影响现有 JSON 读写

## 11.2 阶段 B：一次性导入历史数据

迁移脚本建议逻辑：

1. 扫描 `data/*/project.json`
2. 读取当前项目
3. 读取 `history/*.json`
4. 按时间升序重建 revision 链
5. 写入 `project_revisions`
6. 写入 `projects.current_revision_id`
7. 记录导入统计
   - 项目数
   - 历史快照数
   - 失败项目数
   - 校验失败项

导入原则：

- 幂等：同一项目重复执行不应生成重复 revision
- 原子：单个项目导入失败不能污染别的项目
- 可审计：输出迁移日志

建议用 `content_hash + project_id + history_key` 做去重。

## 11.3 阶段 C：运行时切到 SQLite

建议切换顺序：

1. 先上“SQLite 读 + JSON 兜底读”
2. 再上“SQLite 单写”
3. 稳定后移除 JSON fallback

若希望更保守，也可短期启用“双写”：

- 保存项目时同时写 SQLite 和 JSON
- 校验稳定后关闭 JSON 写入

但从工程复杂度看，本项目更推荐：

- 离线一次性导入
- 切换到 SQLite 单写
- 保留 JSON 只读备份一段时间

## 11.4 阶段 D：下线旧文件存储

满足以下条件后，可删除旧 JSON：

- SQLite 已作为唯一读写源稳定运行一段时间
- 核心接口回归测试通过
- 数据一致性抽样通过
- 已完成物理备份

## 12. 数据校验与验收标准

迁移完成后，至少校验以下内容：

### 12.1 数量校验

- `projects` 行数 = `project.json` 文件数
- `project_revisions` 行数 = 当前项目数 + 历史 JSON 文件数

### 12.2 逐项目一致性校验

对每个项目校验：

- 当前项目 `meta.id`
- `meta.name`
- `systemPrompt`
- `messages` JSON 序列化后内容
- `apiConfig` JSON 序列化后内容
- 当前 `updatedAt`

### 12.3 历史一致性校验

对每个历史文件校验：

- `history_key` 是否可反查
- 快照内容是否一致
- 排序是否与原文件名时间一致

### 12.4 接口行为校验

重点回归：

- 项目列表
- 新建/保存/重命名
- 删除
- 复制
- 历史列表
- 历史详情

## 13. 风险与对策

### 13.1 历史时间戳不可靠

问题：

- 旧历史文件的时间来自文件名，不一定与快照内 `meta.updatedAt` 完全一致

对策：

- 迁移时以文件名时间作为历史排序主依据
- 同时保留 `legacy_source_path`
- 导入日志记录冲突项

### 13.2 `messages_json` 体积较大

问题：

- 长对话项目会让 revision 表快速膨胀

对策：

- 启用 `WAL`
- 定期执行 `VACUUM` / checkpoint
- 后续如有需要，可增加“版本保留策略”

### 13.3 `apiKey` 仍是明文

问题：

- 迁移到 SQLite 只是从“文件明文”变成“数据库明文”

对策：

- 本期保持行为一致
- 后续单独推进 `apiConfig.apiKey` 脱离项目存储或进行加密

### 13.4 外键环依赖实现复杂

问题：

- `projects.current_revision_id -> project_revisions.id`
- `project_revisions.project_id -> projects.id`

对策：

- migration 时分步创建
- 或去掉 `projects.current_revision_id` 的物理 FK，仅在应用层保证一致性

若希望实现更简单，允许本期保留：

- `projects.current_revision_id` 仅做普通列 + unique index

这不会影响整体设计正确性。

## 14. 最终建议

建议采用以下落地口径：

1. `Project` 全量迁移到现有 `data/app.db`
2. 使用 `projects + project_revisions` 两表模型
3. `messages` 与 `apiConfig` 以 JSON 文本存储
4. 保留历史快照概念，并用 `history_key` 兼容现有 `filename` API
5. 通过离线导入 + SQLite 切流 + 延迟删除旧 JSON 的方式完成迁移

这是当前仓库最稳、改动面最可控、且能真正替代文件系统存储的方案。

## 15. 推荐后续实现顺序

1. 新增 `projects` schema 与 migration
2. 抽象通用 DB client，合并 `Project` 与 `Prompt Asset` schema
3. 实现 SQLite 版 `ProjectStore`
4. 实现历史 JSON 导入脚本
5. 补齐 `projects` API 与 repository 测试
6. 完成数据迁移和回归验证
