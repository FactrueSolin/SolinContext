# 多用户与数据库对接链路架构审查报告

日期：2026-04-19

## 1. 目标与范围

本报告聚焦以下问题：

- 当前多用户使用链路是否逻辑自洽
- 当前数据库对接链路是否符合既定多工作区架构
- 现有实现中是否存在明显矛盾、隔离失效点或后续高风险演进问题

本次审查基于静态代码阅读完成，重点覆盖：

- `app/lib/auth/*`
- `app/lib/projects/*`
- `app/lib/prompt-assets/*`
- `app/lib/db/schema/*`
- `app/api/workspaces/*`
- `docs/multi-user-logto-architecture.md`

说明：

- 当前工作树缺少 `node_modules`，未能执行自动化测试。
- 因此本报告结论来自实现链路与设计文档的一致性审查，而非运行态验证。

## 2. 总体结论

当前实现已经具备多用户基础骨架：

- 请求会先解析 session
- 再解析 principal 和 active workspace
- 业务服务层基本按 `workspaceId` 过滤
- `Project` 与 `Prompt Asset` 表都已显式带有 `workspace_id`

但从架构完整性看，当前状态仍不能认为“多用户链路已经正确闭环”。主要问题不是某个 API 漏了鉴权，而是存在若干结构性矛盾：

1. 旧单机项目的导入策略会把全局数据灌入任意 workspace，破坏租户边界
2. 项目和凭证的数据库关联链路没有真正打通，且当前实现会丢失 `defaultCredentialId`
3. 项目版本仍在持久化明文 `apiKey`，与既定架构目标直接冲突
4. 数据库缺少“资源与版本必须属于同一 workspace”的强约束，隔离依赖应用层自觉
5. “active workspace”和“default workspace”的语义混淆，归档 workspace 的可访问性校验也不完整

结论：当前实现更接近“带工作区过滤的单体应用”，而不是“已经完成多租户闭环的数据与权限模型”。

## 3. 现状链路判断

### 3.1 当前主链路

当前主链路大致为：

`session -> principal(activeWorkspace) -> permission check -> service -> repository(workspaceId filter) -> database`

其中：

- `session` 负责从开发头或 Logto session 中解析用户身份
- `principal` 负责 upsert 用户、确保个人 workspace、解析当前 workspace membership
- API 层大多会先调用 `resolvePrincipal()`，再调用 `requirePermission()`
- `ProjectService` / `PromptAssetService` 在仓储查询时大多使用 `principal.activeWorkspaceId`

从“基本请求路径是否带工作区上下文”这个角度看，主流程方向是对的。

### 3.2 当前问题不在“有没有 workspaceId”

当前更大的问题在于：

- 历史遗留数据迁移策略不符合多租户边界
- 项目与凭证的建模不完整
- 数据库存储内容与架构文档冲突
- 数据库层缺少关键一致性约束

也就是说，问题已经从“有没有工作区字段”上升为“工作区模型是否被整个系统真正贯彻”。

## 4. 主要问题

## 4.1 旧项目导入策略会污染任意 workspace

### 现象

当前 `ProjectService` 在访问项目时会调用 `ensureLegacyProjectsImported()`，首次访问某个 workspace 时会执行旧数据导入。

但导入函数 `importLegacyProjectsIntoWorkspace()` 读取的是全局 `data/` 目录下的所有旧项目，并将它们统一写入当前 `principal.activeWorkspaceId`。

同时，是否“已导入”的判断只看全局 `projectId` 是否已存在，而不是“某个项目是否已导入到某个 workspace”。

### 架构矛盾

这与既定设计中的以下原则冲突：

- 所有业务数据都必须以 workspace 作为隔离边界
- 工作区切换后，页面中的业务数据应整体切换
- 后端必须自行保证资源归属与工作区上下文一致

### 风险

会出现如下高风险结果：

- 第一个访问某团队 workspace 的用户，可能把历史单机数据整体导入该团队空间
- 后续其他 workspace 因为 `projectId` 已存在而无法再导入
- 同一份旧数据最终归属哪个 workspace，取决于“谁先访问”

这不是体验问题，而是租户边界失效。

### 建议

建议将旧数据迁移从“运行时懒导入”改为“显式迁移流程”：

- 只允许迁移到个人 workspace
- 或在迁移时要求明确指定目标 workspace
- 导入标记应按 `workspace_id + legacy_source_path` 或其他稳定标识建模，不能只按 `projectId`
- 在团队 workspace 上应默认禁用全局旧数据自动导入

优先级：`P0`

## 4.2 项目与凭证的数据库链路未打通，`defaultCredentialId` 还会被写丢

### 现象

当前 `projects` 表中已经有 `defaultCredentialId` 字段，API 入参也允许写入该字段。

但现状存在两个结构性问题：

1. 该字段没有外键，也没有任何“必须属于当前 workspace”的校验
2. 项目详情读取时并没有正确保留该值，后续普通更新会将其回写为 `null`

换言之，当前系统表面上已经支持“项目绑定凭证”，但实际链路并未闭合。

### 架构矛盾

既定架构要求：

- 项目不再保存明文 API Key
- 项目应引用独立凭证实体
- 凭证应受工作区权限控制

但当前项目模型只是放了一个未闭环的 `defaultCredentialId`，没有配套的实体约束与校验链路。

### 风险

- 项目可能引用不存在的凭证
- 项目可能引用其他 workspace 的凭证
- 项目更新时会悄悄丢失已绑定凭证
- 未来一旦上线 credentials 功能，项目与凭证的归属关系会不可信

### 建议

建议在 credentials 模型落地前，不要把 `defaultCredentialId` 视为已完成能力。

需要至少补齐：

- 凭证表及 workspace 归属约束
- `projects.default_credential_id` 外键
- 创建/更新项目时的 workspace 内归属校验
- 读取项目详情时从 `project` 主记录中保留该值，避免更新覆盖成 `null`

优先级：`P0`

## 4.3 项目版本仍然持久化明文 API Key，与目标架构直接冲突

### 现象

当前项目版本快照会直接序列化整个 `apiConfig` 到 `project_revisions.api_config_json`。

而 `apiConfig` 中包含：

- `apiKey`
- `compareModel.apiKey`

这意味着：

- 新建项目会把明文 key 写入版本表
- 更新项目会把明文 key 写入版本表
- 旧文件系统项目导入时也会把明文 key 一并导入数据库

### 架构矛盾

既定架构已明确要求：

- 项目不再保存明文 API Key
- 应改为引用独立凭证实体

因此当前实现不是“还没升级完”，而是与目标模型正面冲突。

### 风险

- 数据库直接成为密钥泄露面
- 历史版本不可逆地保存多个时间点的明文 key
- 即使未来切换到 credentials 模型，历史版本表中仍会保留遗留 secret

### 建议

建议尽快执行以下拆分：

- 从项目快照中移除明文 `apiKey`
- 项目只保留凭证引用
- 如需保留兼容字段，至少在入库前做脱敏或剥离
- 为历史数据提供一次性清洗迁移，避免旧版本表长期保留明文 secret

优先级：`P0`

## 4.4 数据库没有强制“资源与版本属于同一 workspace”

### 现象

当前：

- `project_revisions` 同时持有 `project_id` 与 `workspace_id`
- `prompt_asset_versions` 同时持有 `asset_id` 与 `workspace_id`

但数据库层没有强约束来保证：

- 某条 `project_revision.workspace_id` 必须等于其父 `project.workspace_id`
- 某条 `prompt_asset_version.workspace_id` 必须等于其父 `prompt_asset.workspace_id`

### 风险

目前应用层查询基本会带 `workspaceId`，短期看问题不明显；但长期看，这种设计把关键租户一致性完全交给应用代码维护。

一旦出现以下情况，就可能产生脏数据：

- 迁移脚本写错
- 后续新增 API 漏校验
- 手工修库
- 批量导入或补数逻辑不严谨

届时数据库不会阻止“父资源在 A workspace，版本记录却标成 B workspace”。

### 建议

建议补强数据库一致性设计，优先考虑以下方案之一：

- 去掉版本表上的冗余 `workspace_id`，通过父表归属推导
- 或保留冗余字段，但增加可验证的一致性约束与写入校验
- 至少在 repository 写路径上统一封装，不允许外部任意指定版本表的 `workspaceId`

优先级：`P1`

## 4.5 active workspace / default workspace 语义混淆

### 现象

当前 `/api/me` 返回的数据中，`defaultWorkspace` 实际上直接复用了当前解析出的 `activeWorkspace`。

这意味着：

- 如果请求携带了 `workspaceSlug`
- 返回结果里的 `defaultWorkspace` 就会被覆盖成当前 workspace

这和“默认工作区”应表达“用户默认落点”或“系统首选工作区”的语义并不一致。

### 风险

- 前端容易把“当前工作区”和“默认工作区”误认为同一概念
- 后续若要实现“最近一次选择的工作区偏好”，当前接口结构会误导业务逻辑

### 建议

建议明确区分两个概念：

- `activeWorkspace`：本次请求实际生效的工作区
- `defaultWorkspace`：用户默认落点，通常为个人 workspace 或最近一次持久化选择

如果暂时没有默认工作区偏好模型，建议只返回 `activeWorkspace`，不要伪造 `defaultWorkspace` 语义。

优先级：`P2`

## 4.6 workspace 状态校验不完整，归档 workspace 仍可能被解析为可访问

### 现象

当前 membership 查询主要筛选的是：

- `workspace_memberships.status = active`

但没有同步过滤：

- `workspaces.status = active`

这意味着如果某个 workspace 已归档，而 membership 仍为 active，当前解析逻辑仍有机会把它当作合法工作区返回。

### 风险

- 归档空间仍可被访问
- 归档状态在鉴权层不生效
- 后续做 workspace 生命周期管理时，行为会不一致

### 建议

在 principal 解析阶段统一加入 `workspaces.status = active` 过滤。

如果未来需要“归档但可只读浏览”，也应单独建模，而不是沿用当前 active 查询链路。

优先级：`P1`

## 5. 与设计文档的一致性判断

对照 `docs/multi-user-logto-architecture.md`，当前实现与目标架构存在以下明确偏差：

### 已基本对齐的部分

- 业务数据开始显式带 `workspace_id`
- BFF API 模式已成立
- session -> principal -> workspace -> permission 的基本解析流程已建立
- 项目与提示词资产的读写已开始按 workspace 收口

### 明确未对齐的部分

- 项目仍持久化明文 API Key
- 工作区并未成为所有遗留数据迁移的真实隔离边界
- credentials 仍未成为项目访问模型能力的基础实体
- 团队 workspace / organization 的完整管理链路尚未落地
- 多租户一致性更多停留在应用层约定，而非数据库层约束

## 6. 优先级建议

建议按以下顺序整改：

### P0

- 禁止在团队 workspace 中执行全局旧项目懒导入
- 重做旧数据迁移策略，避免按“首次访问者”决定数据归属
- 修复 `defaultCredentialId` 读取与更新链路
- 禁止项目版本继续保存明文 `apiKey`

### P1

- 为项目/提示词资产版本补齐 workspace 一致性约束
- 在 principal / membership 查询中加入 `workspaces.status` 校验
- 补充跨 workspace 资源访问与凭证归属的契约测试

### P2

- 明确 `activeWorkspace` 与 `defaultWorkspace` 的接口语义
- 在用户偏好层补充“最近一次选择的工作区”能力

## 7. 建议的后续动作

建议后续拆成三个独立实施项：

1. 数据安全整改
   - 移除项目快照中的明文 secret
   - 引入 credentials 实体与项目引用关系

2. 多租户一致性整改
   - 修复旧项目迁移策略
   - 补齐 workspace 级约束与归属校验

3. 契约与测试补齐
   - 将当前 `tests/api/multi-user-logto-contract.test.ts` 中与跨 workspace 隔离相关的 `todo` 落为真实测试
   - 尤其覆盖：
     - cross-workspace project access
     - cross-workspace revision restore
     - injected defaultCredentialId
     - archived workspace access

## 8. 最终判断

当前代码库已经从“单用户文件系统工具”迈出第一步，但尚未达到“多工作区、多用户、可持续演进”的稳定架构状态。

如果继续在当前基础上直接叠加 credentials、members、organization 等能力，而不先修复上述结构性问题，后续很可能出现：

- 数据归属错乱
- 历史密钥泄露
- 跨工作区引用污染
- 测试难以兜底的隐性权限问题

因此建议先完成 `P0` 级整改，再继续推进团队能力与凭证体系建设。
