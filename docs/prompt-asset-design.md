# 提示词资产库设计文档

## 1. 文档定位

本文档合并以下三份设计文稿，作为“提示词资产库”能力的单一设计基线：

- `prompt-asset-architecture.md`
- `prompt-asset-backend-spec.md`
- `prompt-asset-database-design.md`

本文覆盖：

- 产品定位与 UX 方案
- 前后端交互边界
- API、服务层、仓储层规范
- 数据库物理模型、约束与事务设计

若后续实现、评审或联调涉及“提示词资产库”，统一以本文为准。

## 2. 总体设计结论

### 2.1 产品目标

“提示词资产库”用于为 `AI Context Editor` 中的 `System Prompt` 提供：

- 可复用的模板沉淀能力
- 显式的版本管理能力
- 快速查找、预览、应用与恢复能力

当前阶段不把它做成独立的重量级 Prompt CMS，而是围绕现有项目编辑流，提供“近场”的资产管理能力。

### 2.2 第一阶段方案摘要

第一阶段采用“快捷入口 + 右侧资产抽屉 + 独立后端子系统”的组合方案：

- `Header` 增加“提示词资产库”入口，用于完整管理
- `SystemPromptEditor` 增加“从资产应用”“保存为资产”两个高频快捷动作
- 资产管理主界面使用右侧 Drawer，而不是新页面
- 后端新增 `prompt-assets` 子系统，独立使用 `SQLite + Drizzle`
- 版本管理采用追加式模型，不做原地覆盖更新

### 2.3 核心设计原则

#### 原则 A：资产是来源，项目是工作副本

应用资产后，当前项目的 `System Prompt` 会被替换，但不会自动反向改写资产。只有显式执行“保存为资产”或“保存为新版本”，才会修改资产侧数据。

#### 原则 B：高频动作前置，治理能力后置

首页和主编辑区优先承载：

- 从资产应用
- 保存为资产

版本历史、归档、恢复等低频治理动作，收敛到资产 Drawer 深层视图。

#### 原则 C：版本是显式动作，不是自动副作用

只要会产生新版本，就必须由用户显式触发：

- `保存为资产`
- `保存为新版本`
- `恢复为当前版本`

不采用自动版本化，避免噪音与误解。

## 3. 产品与 UX 方案

## 3.1 当前产品前提

本文以当前产品形态为前提：

- 当前主工作区围绕单个 `Project` 展开
- `System Prompt` 是最核心、最高频的编辑对象
- 产品尚未进入多团队、多角色、复杂治理阶段

因此当前设计目标不是做独立资产后台，而是在不打断编辑流程的前提下，为 `systemPrompt` 增加可复用、可版本化、可检索的能力。

## 3.2 为什么不是独立页面

独立页面更适合重运营、重治理的资产中心，但当前真实工作流是：

- 先在项目中编辑 prompt
- 再决定是否沉淀成资产
- 或从已有资产中挑一个，应用到当前项目

如果拆成全页，用户每次“找资产 -> 对比 -> 应用 -> 回到项目”都要切上下文，成本偏高。Drawer 更适合“边查边用”的工作方式。

## 3.3 本期产品定位

第一阶段，“提示词资产库”承担三个角色：

- 复用库：减少重复手写 system prompt
- 安全网：提供版本历史与回滚能力
- 轻量治理：通过名称、描述、更新时间、版本号建立基本秩序

本期不承担：

- 团队协作中心
- 审批流与权限系统
- 标签体系、文件夹体系、分享体系
- 跨项目自动同步更新

## 3.4 用户与场景

### 用户 A：高频写 Prompt 的操作者

特征：

- 经常新建项目
- 有一批重复使用的 prompt 模板
- 更在意“快”和“可复用”

核心诉求：

- 快速找到可用资产
- 一键应用到当前 `System Prompt`
- 在项目内改完后能顺手保存成新版本

### 用户 B：维护标准 Prompt 的沉淀者

特征：

- 会迭代少量关键提示词
- 需要知道哪个版本是当前稳定版
- 需要保留历史并支持回滚

核心诉求：

- 明确版本链
- 看得懂每次修改了什么
- 避免误覆盖

### 核心任务

本期只围绕 6 个任务设计：

1. 浏览资产列表
2. 搜索并筛选资产
3. 预览资产当前版本
4. 应用资产到当前项目 `System Prompt`
5. 将当前 `System Prompt` 保存为资产
6. 查看历史版本并恢复为新版本

## 3.5 信息架构

### 对象关系

系统中有两个容易混淆的对象：

#### Project

- 承载当前编辑上下文
- 有自己的 `systemPrompt`
- 可以引用某个资产内容，但不是资产本身

#### Prompt Asset

- 承载跨项目复用的提示词模板
- 有独立名称、描述、版本历史
- 可以被多个项目重复应用

对应的用户心智表达：

> 资产库像模板仓库，项目里的 system prompt 像当前工作稿。

### 导航结构

```text
Header
  └─ 提示词资产库入口

Project Workspace
  └─ System Prompt Editor
      ├─ 从资产应用
      └─ 保存为资产

Prompt Asset Drawer
  ├─ 列表态
  ├─ 详情态
  ├─ 编辑态
  ├─ 历史版本态
  └─ 新建 / 保存弹窗
```

### 入口设计

#### 入口 1：Header

位置：

- 与项目列表、导出、设置同级

作用：

- 进入完整资产管理能力
- 支持浏览、搜索、筛选、查看详情、查看历史、创建、编辑、归档

适用场景：

- 用户主动管理资产库
- 用户不确定该用哪个资产，需要先浏览

#### 入口 2：System Prompt 快捷入口

位置：

- `SystemPromptEditor` 标题区右侧

动作：

- `从资产应用`
- `保存为资产`

适用场景：

- 用户正在编辑当前项目，需要高效完成资产相关动作

## 3.6 页面与组件结构

### 桌面端总体布局

建议采用右侧 Drawer，宽度约 `420px - 520px`，覆盖在主编辑区右侧。

原因：

- 当前产品左侧已经有 `ProjectListPanel`
- 右侧还有 `ApiConfigPanel` 的打开逻辑
- 资产管理更适合“临时打开、快速操作、随时关闭”的次级工作区

为避免右侧功能冲突，建议统一规则：

- 同一时刻只允许一个右侧功能面板展开
- 打开资产 Drawer 时，若 API 设置面板已开，则自动收起 API 设置面板

### Drawer 内部结构

Drawer 采用两层信息架构：

#### 第一层：资产列表

包含：

- 搜索框
- 状态筛选
- 创建按钮
- 资产卡片列表

每张卡片显示：

- 资产名称
- 一行描述
- 当前版本号，例如 `v12`
- 最近更新时间
- 状态标识，例如 `已归档`

#### 第二层：资产详情

打开某个资产后展示：

- 名称
- 描述
- 当前版本号
- 正文预览 / 编辑器
- 最近更新时间
- 操作区

操作区包括：

- `应用到当前 System Prompt`
- `保存为新版本`
- `查看版本历史`
- `归档`

### 推荐界面草图

```text
+--------------------------------------------------+
| 提示词资产库                              [关闭] |
| [搜索框..................] [全部] [新建资产]     |
|--------------------------------------------------|
| 代码评审提示词                     v8   2小时前   |
| 用于通用代码 review                            > |
|--------------------------------------------------|
| 电商客服系统 Prompt               v3   昨天      |
| 处理售前与售后问答                              > |
|--------------------------------------------------|
|                                                  |
| 选中后进入详情                                   |
+--------------------------------------------------+
```

详情态：

```text
+--------------------------------------------------+
| < 返回 代码评审提示词                    v8      |
| 用于通用代码 review                               |
|--------------------------------------------------|
| [应用到当前 System Prompt] [保存为新版本]         |
| [查看版本历史] [归档]                             |
|--------------------------------------------------|
| Prompt 正文预览 / 编辑区                          |
|                                                  |
|                                                  |
+--------------------------------------------------+
```

## 3.7 核心任务流

### 任务流 A：从资产应用到当前项目

目标：

- 在尽量少的操作下，把已有资产内容带入当前项目

流程：

1. 用户点击 `从资产应用` 或 Header 中的 `提示词资产库`
2. 打开 Drawer，默认进入列表态
3. 用户搜索或点击某个资产
4. 进入详情态并预览正文
5. 点击 `应用到当前 System Prompt`
6. 弹出轻确认层
7. 用户确认后，更新当前项目 `systemPrompt`
8. 顶部显示成功反馈，并提示“当前修改仅作用于项目，未改动资产本身”

确认文案建议：

- 标题：`应用到当前项目？`
- 描述：`这会替换当前项目中的 System Prompt，但不会修改资产库内容。`
- 主按钮：`确认应用`
- 次按钮：`取消`

冲突场景：

如果当前项目 `System Prompt` 有未保存修改，确认层补充：

`当前项目存在未保存改动，应用后将以资产内容覆盖编辑区。`

### 任务流 B：将当前 System Prompt 保存为资产

目标：

- 把项目内已经验证有效的 prompt 沉淀成可复用模板

流程：

1. 用户在 `SystemPromptEditor` 点击 `保存为资产`
2. 弹出保存弹窗
3. 自动带入当前 `systemPrompt` 内容
4. 用户填写名称、描述、版本说明
5. 点击 `创建资产`
6. 创建成功后，Toast 提示：`已保存到提示词资产库，当前版本 v1`
7. 弹窗关闭，可选择附加操作：`前往查看`

弹窗字段：

- `名称`：必填
- `描述`：选填，单行或两行
- `版本说明`：选填，帮助后续理解本次保存意图
- `正文`：默认取当前 `systemPrompt`，允许在弹窗中二次微调

### 任务流 C：编辑已有资产并生成新版本

目标：

- 保留历史的前提下，让用户能持续迭代资产

流程：

1. 用户在 Drawer 中进入资产详情
2. 点击 `编辑当前版本` 或直接在编辑态修改
3. 用户更改名称、描述、正文、版本说明
4. 点击 `保存为新版本`
5. 成功后显示：`已生成 v9，v8 历史已保留。`
6. 详情头部版本号更新为最新版本

关键交互规则：

- 保存动作永远命名为 `保存为新版本`
- 如果用户没有任何变更，按钮置灰
- 如果正文有变化但未填写版本说明，允许保存，不强制阻塞

### 任务流 D：查看历史版本并恢复

目标：

- 帮用户安全地回到过去某个稳定版本

流程：

1. 用户进入资产详情页，点击 `查看版本历史`
2. Drawer 内切到历史版本列表态，或从详情态右滑进入次级面板
3. 列表按时间倒序展示版本
4. 每条版本展示版本号、时间、版本说明、名称快照
5. 点击某个版本进入只读详情
6. 用户点击 `恢复为当前版本`
7. 系统二次确认
8. 恢复后不覆盖旧版本，而是创建一个新版本，例如从 `v3` 恢复后生成 `v9`

确认文案建议：

- 标题：`恢复这个版本？`
- 描述：`系统会基于该历史版本创建一个新的当前版本，原有历史不会丢失。`
- 主按钮：`恢复并生成新版本`

## 3.8 交互状态设计

### 列表态

列表需要覆盖以下状态：

#### 默认态

- 显示最近更新资产
- 按 `updatedAt desc` 排序

#### 搜索态

- 输入时即时过滤
- 无结果时显示空搜索态，而不是空白

推荐文案：

- 标题：`未找到匹配资产`
- 描述：`试试更短的关键词，或创建一个新资产。`
- 操作：`新建资产`

#### 空库态

当用户还没有任何资产时：

- 不展示冷冰冰的空表格
- 需要明确说明资产库的用途

推荐文案：

- 标题：`还没有提示词资产`
- 描述：`把常用 System Prompt 保存进来，之后可以跨项目复用。`
- 主按钮：`从当前 Prompt 创建`

#### 加载态

- 顶部保留搜索框骨架
- 列表使用 4 到 6 条 skeleton

#### 错误态

- 标题：`资产库加载失败`
- 描述：`请稍后重试。`
- 操作：`重新加载`

### 详情态

详情态需要区分三种模式：

#### 只读预览模式

适用于：

- 初次打开资产
- 用户主要目的是预览和应用

特点：

- 正文区默认只读
- 主按钮是 `应用到当前 System Prompt`
- 次按钮是 `编辑`

#### 编辑模式

适用于：

- 用户明确要迭代资产版本

特点：

- 名称、描述、正文、版本说明可编辑
- 底部固定操作栏：`取消`、`保存为新版本`

#### 历史版本只读模式

适用于：

- 用户查看旧版本

特点：

- 所有字段只读
- 主按钮为 `恢复为当前版本`

### 成功反馈

成功反馈不要只依赖 Toast，关键动作还要在上下文里留下证据。

建议：

- 应用成功后，在 `SystemPromptEditor` 顶部出现短暂状态条：`已应用资产「代码评审提示词」v8`
- 保存为资产成功后，在弹窗关闭前显示：`已创建资产，当前版本 v1`
- 保存为新版本成功后，在资产详情头部刷新版本号并短暂高亮：`当前版本 v9`

## 3.9 文案与命名规范

### 命名建议

产品内统一使用：

- 中文：`提示词资产`
- 英文内部 id：`prompt asset`

避免混用：

- 模板
- 预设
- 片段
- Prompt 仓库

### 主按钮文案

| 场景 | 按钮文案 |
| --- | --- |
| 从列表进入完整管理 | `提示词资产库` |
| 从资产写入当前项目 | `应用到当前 System Prompt` |
| 把当前项目内容沉淀为资产 | `保存为资产` |
| 更新已有资产 | `保存为新版本` |
| 从历史版本恢复 | `恢复为当前版本` |
| 新建资产 | `新建资产` |

### 提示文案原则

关键提示文案要持续传达两个事实：

1. 应用资产会改项目，不会改资产
2. 保存资产会生成版本，不会覆盖历史

建议在以下位置重复强化：

- 应用确认层
- 保存成功 Toast
- 详情页版本说明区域

## 3.10 异常与边界场景

### 当前没有打开项目

如果用户从 Header 打开资产库，但当前没有选中项目：

- 仍允许浏览资产库
- 禁用 `应用到当前 System Prompt`

禁用态提示：

`请先选择一个项目，再将资产应用到 System Prompt。`

### 当前 System Prompt 为空

若点击 `保存为资产` 时 `systemPrompt` 为空：

- 不允许直接保存
- 弹出轻提示而不是空白表单

推荐文案：

`当前项目的 System Prompt 为空，无法保存为资产。`

### 资产已归档

归档资产默认：

- 不在默认列表优先展示
- 可通过筛选切换查看

归档资产在详情页中：

- 允许查看历史
- 默认不允许编辑
- 可以提供 `恢复资产`，但不是第一优先动作

### 应用前有未保存改动

如果当前项目处于未保存状态：

- 允许应用
- 但必须显式提醒会覆盖编辑区内容

此处不要直接阻塞，避免流程过重。

## 3.11 响应式策略

### 桌面端

- 优先使用右侧 Drawer
- 列表与详情可采用同层切换

### 移动端

移动端不适合同时展示复杂版本信息，建议：

- 使用全屏 Sheet 或全屏页面承载资产库
- 列表、详情、历史采用逐层前进的导航模式
- 底部操作区固定吸附

移动端优先保障三件事：

1. 浏览列表
2. 应用到当前项目
3. 保存为资产

版本历史编辑可以更克制，但不能缺失。

## 3.12 前端实现映射

本节只定义 UX 落地所需的前端边界。

### 推荐组件拆分

```text
app/components/prompt-assets/
  PromptAssetDrawer.tsx
  PromptAssetList.tsx
  PromptAssetListItem.tsx
  PromptAssetDetail.tsx
  PromptAssetEditor.tsx
  PromptAssetVersionHistory.tsx
  SavePromptAssetDialog.tsx
  ApplyPromptAssetConfirmDialog.tsx
```

### 状态边界

不建议把提示词资产管理直接塞进现有 `EditorContext`。

建议新增：

- `PromptAssetContext`
或
- `usePromptAssets()` + 局部 state

原因：

- `Project` 编辑与资产管理是两个不同的状态域
- 资产列表、详情、版本历史、筛选条件，会让 `EditorContext` 继续膨胀
- 后续若增加独立资产页，也更容易迁移

### 与当前界面的耦合点

当前代码中最关键的接入位置只有两个：

#### Header

新增：

- 打开资产库的按钮

#### SystemPromptEditor

新增：

- `从资产应用`
- `保存为资产`
- 应用成功后的轻量状态提示

## 3.13 数据与交互约束

虽然本节不是数据库设计，但 UX 方案依赖以下系统约束成立：

- 每个资产必须有稳定 `id`
- 每次保存必须生成递增版本号
- 资产主记录要能快速返回“当前态”
- 历史版本必须可查询、可恢复
- 恢复历史版本时，应创建新版本而不是直接改指针

这些约束决定了 UI 才能自然表达：

- `当前版本`
- `历史版本`
- `恢复后历史仍保留`

## 3.14 分期建议

### Phase 1

必须交付：

- 资产 Drawer
- 列表、搜索、详情
- 从资产应用到当前 `System Prompt`
- 将当前 `System Prompt` 保存为资产
- 编辑资产并保存为新版本
- 查看历史版本并恢复为新版本

### Phase 2

可以后续再做：

- 标签 / 文件夹
- 资产引用来源显示
- “此项目当前使用的是哪个资产版本”
- 版本差异对比
- 最近使用 / 高频使用排序

## 3.15 验收标准

如果以下问题都能被顺畅回答，说明 UX 方案成立：

1. 用户能否在 3 次点击内把某个资产应用到当前项目？
2. 用户能否在当前项目里顺手把 prompt 保存成资产，而不需要跳走？
3. 用户是否始终能分清“改项目”和“改资产”是两回事？
4. 用户能否理解“恢复历史版本”不会删除现有版本链？
5. 当资产库为空、搜索无结果、加载失败时，界面是否仍然可理解且可操作？

## 4. 后端技术规范

## 4.1 文档目标

本节明确以下内容：

- 第一阶段提示词资产后端的技术选型结论
- API 路由、请求体、响应体、错误码规范
- 服务层、仓储层、数据库层的职责边界
- 事务、一致性、校验、测试和迁移要求

其中“必须”表示强约束，“建议”表示可选增强项。

## 4.2 当前约束与实施前提

### 项目现状

- 当前仓库基于 `Next.js 16 + App Router + Route Handler`
- 当前 `Project` 领域仍由 `ProjectStore` 落盘到文件系统
- 当前仓库尚未引入数据库相关依赖
- 当前 API 错误结构不统一，新子系统需要单独建立明确契约

### 第一期范围

第一期后端只覆盖：

- 提示词资产增删查改中的“查、建、生成新版本、归档、取消归档”
- 历史版本查询
- 从历史版本恢复为新版本

第一期不覆盖：

- 用户、团队、权限
- 标签、文件夹、分享
- 多人协作编辑冲突解决
- 项目与资产的强引用关系

## 4.3 技术选型结论

### 运行时

必须：

- 所有 `prompt-assets` Route Handler 运行在 `Node.js runtime`
- 不使用 Edge Runtime

原因：

- 需要访问本地 SQLite 文件
- 需要使用同步事务能力更强的 SQLite 驱动
- 需要与当前 `ProjectStore` 的文件系统运行模型保持一致

### 数据库与 ORM

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

- 如果后续部署环境变为无持久化磁盘或 serverless，应切换为 `@libsql/client` + 远端 libSQL/Turso
- 该切换属于部署形态变更，不影响本文定义的领域模型和 API 契约

### 输入校验

必须引入请求级 schema 校验库。

推荐结论：

- 使用 `zod`

### ID、时间、哈希

必须：

- 资产 ID、版本 ID 统一使用 `ulid`
- 时间统一以 `Unix epoch ms` 存储
- `content_hash` 使用 Node.js `crypto` 生成 `SHA-256`

### 事务策略

必须：

- 创建资产必须在单事务内完成
- 生成新版本必须在单事务内完成
- 恢复历史版本必须在单事务内完成
- 归档/取消归档至少保证单条资产状态原子更新

不得：

- 先写版本后异步回写主表
- 在服务层外手动拼接多次独立 SQL 来完成一次业务动作

### 搜索策略

第一阶段结论：

- 只支持 `name` 前缀或包含搜索
- 查询入口仅检索 `prompt_assets`

第二阶段建议：

- 如需按 `name + description + content` 做全文检索，再引入 SQLite FTS5

## 4.4 目录与分层规范

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

## 4.5 领域对象与 DTO 规范

### 枚举定义

```ts
type PromptAssetStatus = 'active' | 'archived';
type PromptAssetOperationType = 'create' | 'update' | 'restore' | 'import';
```

### 对外返回 DTO

#### PromptAssetSummary

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

#### PromptAssetDetail

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

#### PromptAssetVersionItem

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

### 输入约束

第一阶段建议约束：

- `name`: 1-120 字符，去除首尾空白后不能为空
- `description`: 0-500 字符
- `content`: 1-50000 字符
- `changeNote`: 0-200 字符
- `query`: 0-50 字符
- `page`: `>= 1`
- `pageSize`: `1-50`

服务层必须在数据库约束之前先做输入校验，避免将低质量错误直接暴露为数据库异常。

## 4.6 统一响应与错误规范

### 成功响应结构

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

### 失败响应结构

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

### 错误码规范

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

## 4.7 API 契约

### 路由总览

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

- `PUT /api/prompt-assets/:id` 容易误导为原地更新，实施阶段收敛为 `POST /:id/versions`
- 不提供 `DELETE /api/prompt-assets/:id`，改为显式归档命令

### `GET /api/prompt-assets`

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

### `POST /api/prompt-assets`

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
- 返回 `PromptAssetDetail`

### `GET /api/prompt-assets/:id`

用途：

- 查询资产当前态和当前版本内容

规则：

- 第一阶段直接返回当前版本详情，不需要额外 `includeVersionSummary` 开关

### `POST /api/prompt-assets/:id/versions`

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

### `GET /api/prompt-assets/:id/versions`

用途：

- 查询版本历史

查询参数：

- `page?: number`
- `pageSize?: number`

排序规则：

- 固定按 `versionNumber desc`

响应体：

- 返回 `PromptAssetVersionItem[] + pagination`

### `GET /api/prompt-assets/:id/versions/:versionId`

用途：

- 查询指定版本详情

规则：

- 必须校验 `versionId` 属于 `id`
- 不允许返回其他资产的版本数据

### `POST /api/prompt-assets/:id/restore`

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

### `POST /api/prompt-assets/:id/archive`

用途：

- 归档资产

规则：

- 幂等操作
- 重复归档返回 `200`
- 归档后禁止新增版本

成功响应：

- 返回最新 `PromptAssetSummary`

### `POST /api/prompt-assets/:id/unarchive`

用途：

- 取消归档

规则：

- 幂等操作
- 取消归档后允许继续新增版本

## 4.8 服务层规则

### 资产创建

服务层必须：

1. 校验输入
2. 生成 `assetId`、`versionId`
3. 计算 `contentHash`
4. 在单事务中插入 `prompt_assets`
5. 在同一事务中插入 `prompt_asset_versions(version_number = 1)`
6. 返回当前态详情

### 生成新版本

服务层必须：

1. 查询资产当前态
2. 校验状态为 `active`
3. 校验 `expectedVersionNumber`
4. 计算新内容 `contentHash`
5. 判断是否与当前版本完全一致
6. 计算 `nextVersionNumber = currentVersionNumber + 1`
7. 在单事务中插入新版本并更新主表当前态

### 恢复版本

服务层必须：

1. 校验资产存在
2. 校验版本存在且属于当前资产
3. 校验资产状态为 `active`
4. 校验 `expectedVersionNumber`
5. 从目标历史版本复制 `name_snapshot`、`description_snapshot`、`content`
6. 生成新版本并推进主表 `current_version_number`

### 归档与取消归档

服务层必须：

- 只更新主表状态，不新增版本
- 正确维护 `archived_at` 与 `updated_at`
- 将操作设计为幂等

## 4.9 Repository 规范

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

## 4.10 数据库运行规范

SQLite 初始化时建议设置：

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
```

数据库文件位置建议：

- `data/app.db`

迁移要求：

- 所有表结构变更必须通过 `drizzle-kit` migration 管理
- 禁止手写 SQL 直接改线上 schema 而不留 migration

## 4.11 测试规范

第一阶段至少覆盖以下测试：

- Service 层：创建、生成新版本、恢复、归档、取消归档
- Service 层：版本冲突、归档后更新、无变化内容拒绝
- Repository 层：列表分页、版本排序、版本归属校验
- Route Handler 层：参数校验、状态码、错误码、响应结构

建议测试策略：

- Repository/Service 使用临时 SQLite 文件或独立测试库
- Route Handler 使用 `vitest` + mock service

## 4.12 实施顺序

建议按如下顺序落地：

1. 引入 `better-sqlite3`、`drizzle-orm`、`drizzle-kit`、`zod`、`ulid`
2. 建立 `db/client.ts`、schema 与 migration
3. 实现 Repository
4. 实现 Service 和领域错误
5. 实现 Route Handler
6. 补齐 Route/Service/Repository 测试
7. 最后再接前端资产面板与编辑器交互

## 5. 数据库设计

## 5.1 设计目标

数据库方案面向“提示词资产库”子系统，目标是支持以下能力：

- 提示词资产的结构化存储
- 当前版本与历史版本的清晰分离
- 新建、编辑、归档、回滚等操作的事务一致性
- 列表查询、版本查询、按名称搜索的可扩展性
- 与现有文件型 `ProjectStore` 并存，不耦合项目主存储

## 5.2 设计原则

### 领域边界

- `Project` 仍保留在文件系统中
- `PromptAsset` 是独立领域对象，单独建模到 SQLite
- “应用到项目”在第一阶段视为内容复制，不建立强引用约束

### 版本策略

- 所有内容修改都通过“新增版本”实现
- 不覆盖旧版本，不做 in-place update
- 回滚本质上是“从历史版本复制出一个新版本”

### 物理模型取舍

逻辑模型中可能会出现 `current_version_id` 与 `current_version_number` 两个字段。数据库落地时，推荐将“当前版本指针”简化为 `current_version_number`，原因如下：

- 避免 `prompt_assets` 与 `prompt_asset_versions` 的循环外键
- SQLite + Drizzle 下迁移和事务实现更直接
- 通过 `unique(asset_id, version_number)` 已能唯一定位当前版本

因此第一阶段采用：

- `prompt_assets.current_version_number` 作为当前版本指针
- `prompt_asset_versions.id` 继续作为 API 和版本详情查询主键

## 5.3 核心实体

### `prompt_assets`

表示一个稳定存在的提示词资产。

职责：

- 保存当前展示态
- 保存资产生命周期状态
- 为列表页提供高频查询字段

### `prompt_asset_versions`

表示某个资产在某个时间点的完整快照。

职责：

- 保存可审计的历史内容
- 为回滚提供来源数据
- 保留名称、描述、正文的完整快照

### `prompt_asset_apply_logs`

第二阶段可选表，不作为第一阶段必建表。

职责：

- 记录某个项目在何时应用了哪个提示词版本
- 支撑“最近使用”“来源追踪”“更新提醒”

## 5.4 概念模型

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

## 5.5 字段与约束设计

### 表一：`prompt_assets`

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

### 表二：`prompt_asset_versions`

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

### 表三：`prompt_asset_apply_logs`（第二阶段）

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

## 5.6 索引设计

索引应直接服务于 API 查询场景。

### `prompt_assets`

建议索引：

- `idx_prompt_assets_status_updated_at(status, updated_at desc)`
- `idx_prompt_assets_name(name)`
- `idx_prompt_assets_created_at(created_at desc)`

适配场景：

- `GET /api/prompt-assets?status=active`
- 列表按更新时间倒序
- 名称前缀搜索

### `prompt_asset_versions`

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

## 5.7 推荐 SQL DDL

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

## 5.8 可选全文检索设计

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

## 5.9 核心事务设计

### 创建资产

事务步骤：

1. 插入 `prompt_assets`，`current_version_number = 1`
2. 插入 `prompt_asset_versions`，`version_number = 1`
3. 提交事务

### 更新资产

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

### 回滚历史版本

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
- 不把历史版本重新标记为当前
- 所有回滚动作都能追踪来源

### 归档资产

事务步骤：

1. 更新 `status = 'archived'`
2. 更新 `archived_at`
3. 更新 `updated_at`

建议规则：

- 归档不删除版本数据
- 归档后默认不允许继续新增版本
- 若需要恢复，单独提供“取消归档”动作

## 5.10 关键查询设计

### 列表查询

目标：

- 获取资产当前态
- 支持 `status`
- 支持 `query`
- 按 `updated_at desc` 排序

推荐做法：

- 列表页只查 `prompt_assets`
- 详情页或版本页再查 `prompt_asset_versions`

### 查询当前版本详情

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

### 查询版本历史

推荐排序：

- 默认 `version_number desc`
- 不按 `created_at` 替代版本号排序，避免人工修复数据时出现歧义

## 5.11 业务规则与数据不变量

以下规则建议由“数据库约束 + 服务层校验”共同保证：

- 资产创建后必须至少存在一个版本
- `prompt_assets.current_version_number` 必须等于该资产已存在的最大版本号
- 历史版本不可修改，只能新增
- 归档资产默认不能更新
- 恢复历史版本时，目标版本必须属于当前资产
- 若新内容与当前版本 `content_hash`、`name`、`description` 全部一致，可拒绝生成新版本，避免空转版本

说明：

- “当前版本号必须等于最大版本号”很难单靠 SQLite `check` 保证，应放在服务层事务中维护，并通过测试兜底

## 5.12 与现有项目存储的关系

当前仓库的 `ProjectStore` 仍使用：

- `data/<projectId>/project.json`
- `data/<projectId>/history/*.json`

因此数据库设计不应强耦合 `projects` 表。第一阶段边界如下：

- 提示词资产负责“可复用模板”的版本管理
- 项目负责“当前会话编辑内容”的存储
- “应用资产到项目”只更新 `currentProject.systemPrompt`

## 5.13 迁移与实施建议

推荐分三步落地：

1. 先创建 `prompt_assets` 与 `prompt_asset_versions`
2. 完成 Repository / Service / API 后再接 UI
3. 等“应用来源追踪”需求明确后再补 `prompt_asset_apply_logs`

实现层建议：

- 时间字段统一使用 Unix epoch ms，便于 SQLite 排序与 Drizzle 映射
- API 输出时再转换为前端需要的格式
- ID 统一使用同一生成策略，避免主键风格混杂

## 6. 最终建议

第一阶段最稳妥的“提示词资产库”方案是：

- 产品侧围绕 `System Prompt` 提供近场资产管理能力
- 交互侧采用 `Header` 入口 + `SystemPromptEditor` 快捷动作 + 右侧 Drawer
- 后端侧新增独立 `prompt-assets` 子系统
- 数据侧采用 `prompt_assets` 当前态主表 + `prompt_asset_versions` 追加式版本表
- 所有版本动作都显式化，所有“应用”动作都强调只影响当前项目副本

这能在当前产品阶段获得较好的平衡：

- 不打断主流程
- 不把信息架构做重
- 保持版本心智清晰
- 为后续标签、来源追踪、版本 diff 等能力预留扩展空间
