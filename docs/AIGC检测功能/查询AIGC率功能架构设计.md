# 查询 AIGC 率功能架构设计

## 1. 文档目标

本文为当前项目设计“上传 `pdf`/`doc`/`docx` 文件并查询 AIGC 率”的首期功能架构，目标是：

- 复用现有 `Next.js 16 + App Router + Drizzle + SQLite` 技术栈
- 对接独立的 AIGC 检测服务，而不是在本仓库内实现检测算法
- 满足“本地缓存上传文件到 `data` 目录”和“在数据库中记录用户任务”两个强约束
- 与现有工作区、权限、运行时目录、API 组织方式保持一致

本文覆盖：

- 功能边界与交互流程
- 系统分层与模块职责
- 数据库存储设计
- 文件缓存策略
- 与外部检测服务的调用链路
- 异步轮询与状态同步方案
- 风险、监控与实施建议

本文不覆盖：

- 最终 UI 视觉稿
- 具体代码实现细节
- 外部 AIGC 检测服务自身的算法设计

## 2. 背景与约束

## 2.1 已知事实

- 当前项目是 TypeScript 项目，禁止使用 `any`
- 当前项目已具备工作区、多用户、权限、SQLite 落库能力
- 当前项目运行时数据目录通过 `app/lib/runtime-paths.ts` 统一解析，默认目录为 `data/`
- AIGC 检测能力由单独服务提供
- 查询 AIGC 率的后端 API 地址需要定义在本项目 `.env` 中
- 前端不能直接调用外部 AIGC 检测服务，必须通过本项目后端 API 包装后访问
- 外部接口文档位于：
  - `docs/AIGC检测功能/api文档说明.md`
  - `docs/AIGC检测功能/aigc-detection.openapi.json`

## 2.2 外部服务能力摘要

外部 AIGC 检测服务已提供：

- `POST /api/v1/aigc-detection/tasks`：上传文件，创建检测任务
- `GET /api/v1/aigc-detection/tasks/{task_id}`：查询任务状态
- `GET /api/v1/aigc-detection/tasks/{task_id}/result`：查询检测结果
- `GET /api/v1/aigc-detection/files/{sha256}/result`：按文件哈希查询历史结果

接口本身已经支持异步任务、任务状态、结果查询、幂等键与按 `sha256` 去重。

## 2.3 本项目设计原则

### 原则 A：本系统是业务编排层，不是检测引擎

本项目只负责：

- 接收用户上传
- 做权限校验和业务校验
- 缓存文件
- 记录任务
- 调用外部检测服务
- 同步状态并展示结果

检测率计算以外部服务返回结果为准。

同时必须满足：

- 外部服务地址只存在于服务端环境变量
- 浏览器侧只访问本项目 API，不感知第三方真实地址

### 原则 B：首期坚持“同步创建 + 异步轮询”

上传动作由本系统同步接收并立即调用外部 `create_task` 接口；真正完成检测依赖外部异步任务，由本系统后台轮询同步状态。

### 原则 C：本地文件缓存必须可追踪、可清理、可复用

所有上传文件都落在本地 `data/` 目录下，不能只保存在内存或临时请求流中。缓存文件既用于：

- 重试外部提交
- 任务审计
- 调试排障
- 后续按哈希复用结果

### 原则 D：任务是工作区资源

AIGC 检测任务必须绑定工作区与用户，遵循现有 `resolvePrincipal + requirePermission` 模式，而不是做成匿名上传接口。

### 原则 E：结果展示以“任务中心”组织，而不是一次性表单

因为外部服务是异步任务模型，本项目 UI 不应只做“上传后立即显示结果”的理想化单页，而应提供：

- 新建任务
- 查看任务列表
- 查看单个任务详情
- 失败后重试

## 3. 功能目标与范围

## 3.1 首期功能目标

用户在某个工作区内可以：

1. 上传 `pdf`/`doc`/`docx` 文件
2. 创建 AIGC 检测任务
3. 查看任务状态
4. 查看检测结果和整体 AIGC 率
5. 查看历史任务列表
6. 在任务失败时触发重新提交

## 3.2 首期非目标

- 不支持多文件打包上传
- 不支持取消外部任务
- 不支持编辑上传后的文件内容
- 不支持跨工作区共享任务
- 不支持对象存储；首期只用本地 `data/`

## 4. 用户流程

## 4.1 主流程

```text
用户选择文件
  -> 前端校验扩展名/大小
  -> 调用本系统上传接口
  -> 服务端保存文件到 data/
  -> 服务端计算 sha256
  -> 服务端写入本地任务记录（queued_local）
  -> 服务端调用外部 create_task
  -> 更新本地任务为 submitted / processing
  -> 前端进入任务详情页并轮询本系统任务接口
  -> 后端后台同步外部状态
  -> 任务 completed / failed
  -> 前端展示 AIGC 率与明细
```

## 4.2 历史复用流程

```text
用户上传文件
  -> 服务端计算 sha256
  -> 查询本地数据库是否已有 succeeded 结果
  -> 若本地已有结果，可直接复用并新建一条“逻辑任务记录”
  -> 若本地没有结果，则正常调用外部接口
```

说明：

- 是否启用“本地成功结果直接复用”建议作为首期开关能力
- 即使不做本地复用，也应保存 `sha256`，为后续优化预留基础

## 5. 页面与路由设计

建议新增独立工作区模块：

```text
/w/:workspaceSlug/aigc-detection
```

建议页面结构：

- `/w/:workspaceSlug/aigc-detection`
  - 任务列表页
  - 包含上传入口、状态筛选、最近任务
- `/w/:workspaceSlug/aigc-detection/tasks/:taskId`
  - 任务详情页
  - 展示文件信息、当前状态、进度、结果摘要、错误信息

这样更符合异步任务产品模型，也便于沉淀历史记录。

## 5.1 UX 目标

查询 AIGC 率不是即时表单能力，而是“提交文档 -> 等待检测 -> 查看结果 -> 必要时重试”的异步任务体验。

因此首期 UX 目标应明确为：

- 让用户在首屏就理解这是“检测任务”，不是“上传后立刻出结果”的同步工具
- 让首次使用用户在不阅读接口文档的前提下完成一次有效提交
- 让回访用户可以快速复用页面入口查看历史任务和结果
- 让任务状态、失败原因、可重试动作始终清晰，不制造“卡住了但不知道为什么”的体验
- 保证桌面端适合高频查看任务，移动端仍可完成上传、查看进度与结果

## 5.2 信息架构

首期建议采用“任务中心”而非“单表单页”模型，页面结构分为 3 层：

### 第一层：工作区上下文与功能说明

用途：建立任务语义、减少跨工作区误判。

建议内容：

- 页面标题：`AIGC 检测`
- 一句话说明：`上传文档后，系统会异步计算文本的 AIGC 率与检测明细`
- 当前工作区标识
- 权限态提示：
  - 有上传权限：显示 `可创建检测任务`
  - 仅只读权限：显示 `仅可查看任务结果`

设计要求：

- 页面头部必须再次展示 `workspace name`，不能只依赖全局工作区切换器
- 若当前用户无 `aigc_detection:write`，上传入口可见但禁用，并明确说明原因

### 第二层：任务操作区

用途：承载“新建任务”和“筛选历史任务”两类核心动作。

建议包含：

- 主按钮：`上传文件并开始检测`
- 状态筛选：`全部`、`检测中`、`已完成`、`失败`
- 搜索项：按文件名搜索
- 辅助说明：支持格式、大小限制、处理时长预期

设计要求：

- 上传入口在列表页首屏可见
- 上传说明应就近展示，不要藏在二级弹窗或页面底部
- 首次进入时优先强调“支持格式与大小限制”，降低无效上传

### 第三层：任务列表与任务详情

用途：承载异步任务的持续查看与恢复动作。

建议结构：

- 列表页展示任务摘要
- 详情页展示单任务完整状态、结果、错误信息与重试动作

核心原则：

- 列表页解决“我有哪些任务、哪个已经完成、哪个失败了”
- 详情页解决“这个任务当前发生了什么、结果是什么、接下来我能做什么”

## 5.3 列表页 UX 方案

列表页不应只是数据表格，而应承担“入口 + 状态总览 + 恢复导航”的职责。

### 页面组成

- 页面头部
  - 标题、说明、上传按钮
- 筛选工具栏
  - 状态筛选、关键字搜索、最近更新时间排序
- 任务列表区
  - 每行一个任务摘要
- 空状态区
  - 无任务时提供首个上传引导

### 任务卡片/表格行建议字段

- 文件名
- 文件类型与大小
- 创建人
- 创建时间
- 当前状态
- 最新进度
- AIGC 率摘要
- 最后更新时间
- 快捷动作：`查看详情`

### 状态展示要求

- `queued_local`
  - 展示为 `准备提交`
- `submit_failed`
  - 展示为 `提交失败`
- `submitted`
  - 展示为 `已提交`
- `processing`
  - 展示为 `检测中`
- `succeeded`
  - 展示为 `已完成`
- `failed`
  - 展示为 `检测失败`

交互要求：

- `submitted/processing` 状态需要明显区别于终态，避免用户误以为系统无响应
- `succeeded` 状态可直接显示 `AIGC xx%`
- `submit_failed/failed` 状态需要显示错误摘要和 `重试` 或 `查看详情`
- 列表项整体可点击进入详情页，但行内主要操作区也要保留明确入口

### 空状态与首用引导

当工作区内还没有任务时，建议空状态包含：

- 标题：`还没有检测任务`
- 说明：`上传 pdf、doc 或 docx 文件后，系统会在后台完成检测并生成结果`
- 主按钮：`上传第一个文件`
- 次级提示：`检测结果会保存在当前工作区任务记录中`

### 筛选与恢复要求

- 从详情页返回列表时，保留原筛选条件与滚动位置
- 轮询中的任务如果状态变化，列表应可局部刷新，不强制整页闪动
- 不要求首期做实时推送，但要避免用户刷新后找不到刚创建的任务

## 5.4 新建任务交互方案

首期建议使用列表页触发的上传抽屉或模态，而不是跳转独立“新建页”。

原因：

- 用户创建任务后通常仍会回到任务列表查看状态
- 上传动作字段极少，没有必要拆独立路由
- 可以让“创建后进入详情”路径更短

### 上传面板建议字段

- `上传文件`
  - 仅允许单文件
- `是否强制重新检测`
  - 首期若不开启该能力，可隐藏

### 上传面板交互要求

- 默认展示支持格式：`pdf / doc / docx`
- 默认展示大小上限
- 选择文件后立即展示：
  - 文件名
  - 类型
  - 大小
- 客户端预校验失败时，错误信息就近展示在文件选择区
- 点击提交后，按钮进入 loading，防止重复提交
- 创建成功后关闭面板并自动跳转到详情页

### 提交前反馈原则

- 不在上传前承诺“几秒内完成”
- 可以提示“文档较大时可能需要更长处理时间”
- 如果命中本地已完成结果复用，前端应以正向反馈说明：
  - `检测结果已复用，无需重复等待`

## 5.5 详情页 UX 方案

详情页是首期体验核心，必须把“任务状态”“结果内容”“失败恢复”三件事组织清楚。

### 页面分区建议

建议桌面端采用上下信息区 + 主体双栏；移动端改为单栏顺序布局。

桌面端结构建议：

```text
+--------------------------------------------------------------+
| 标题 + 返回列表 + 状态标签 + 主要动作                         |
+--------------------------------------------------------------+
| 文件信息卡 | 任务进度卡 | 错误/提示卡                         |
+--------------------------------+-----------------------------+
| 检测结果摘要                    | 分段/句级结果               |
| AIGC率 / 结论 / 完成时间        | 高风险片段 / 明细列表       |
+--------------------------------+-----------------------------+
```

移动端顺序建议：

- 顶部状态区
- 文件信息卡
- 进度或错误卡
- 结果摘要
- 分段/句级明细

### 顶部状态区

建议展示：

- 返回列表入口
- 文件名
- 状态标签
- 次级信息：创建时间、创建人、最近同步时间
- 右侧动作：
  - `重试`
  - `刷新状态`

交互要求：

- `submitted/processing` 时主动作优先为 `刷新状态`
- `submit_failed/failed` 时主动作优先为 `重试`
- `succeeded` 后顶部仍保留 `查看历史任务` 的返回路径，避免结果页成为死路

### 文件信息卡

建议展示：

- 原始文件名
- 扩展名
- 文件大小
- `sha256` 摘要值
- 是否命中复用结果

设计要求：

- `sha256` 仅展示短摘要，避免信息噪音
- 如果结果来自复用，要明确标识 `已复用历史检测结果`

### 进度与处理中展示

对于 `submitted/processing` 状态，建议展示：

- 当前阶段文案：`已提交，等待检测` / `正在检测内容`
- 进度条
- 进度数字：如 `12 / 20 blocks`
- 最近同步时间

交互要求：

- 当外部只返回阶段、不返回精确进度时，允许退化为阶段型状态展示
- 轮询进行中要有轻量反馈，但不要用大面积骨架屏遮住已有信息
- 页面刷新后应尽量恢复原状态，而不是短暂退回空白

### 结果摘要区

对于 `succeeded` 状态，结果摘要区建议固定展示：

- 核心指标：`AIGC 率`
- 辅助指标：`人工撰写倾向` 或 `Human Score`
- 结果结论摘要
- 完成时间

展示原则：

- `AIGC 率` 是最强视觉焦点
- 不把多个指标做成难以理解的评分面板
- 摘要文案要帮助用户理解结果，不直接堆原始 JSON 字段名

### 分段/句级明细区

如果外部服务返回分段或句级结果，建议以可扫描列表展示：

- 片段序号
- 原文摘要
- 对应判定或风险等级
- 分值

交互要求：

- 明细默认按风险从高到低或按文档顺序展示，两者需要固定一种
- 首期不强制做原文高亮定位，但至少要保证列表可阅读、可滚动
- 数据量较大时允许折叠低风险项，优先暴露高风险片段

## 5.6 异常、失败与重试体验

异步任务最常见的问题不是“报错”，而是“用户不知道现在该做什么”。因此异常态必须设计恢复动作。

### 错误展示原则

- 错误信息就近展示在任务详情，不只依赖全局 toast
- 用户可见文案使用业务语义，不暴露第三方原始报错
- 每种失败都尽量提供下一步动作

### 典型异常态

- 上传校验失败
  - 提示文件类型或大小不符合要求
  - 用户动作：重新选择文件
- `submit_failed`
  - 提示任务提交到检测服务失败
  - 用户动作：`重试`
- `failed`
  - 提示检测未成功完成
  - 用户动作：`重试`
- 结果未完成
  - 提示仍在处理中
  - 用户动作：`刷新状态` 或等待自动轮询
- 权限不足
  - 提示当前仅可查看，不能上传或重试
  - 用户动作：返回列表或切换工作区

### 重试交互要求

- 点击 `重试` 前应明确说明将复用原文件重新提交
- 重试成功后，页面状态应立即切回 `submitted` 或 `processing`
- 不建议首期在前端生成新任务视觉记录，避免用户误以为“多出一条不同任务”

## 5.7 响应式与可读性要求

- 桌面端优先保证结果摘要与明细可同时感知，避免所有信息堆成单列长页
- 移动端上传入口、状态标签、结果摘要必须保持首屏可见
- 长文件名需要截断，但保留完整文件名的悬浮或展开查看方式
- 颜色不能作为唯一状态表达，必须同时有文字标签
- `viewer` 只读态下，不仅禁用按钮，还要保留页面信息可读性

## 5.8 UX 对接口契约的反向约束

为了支撑上述体验，接口返回不能只满足“技术上可用”，还必须满足“前端可解释”。

至少需要满足以下约束：

- 任务列表接口返回：
  - 文件名、大小、扩展名
  - 统一状态
  - 结果摘要字段
  - 最近更新时间
  - 是否可重试
- 任务详情接口返回：
  - 状态标签所需字段
  - 进度字段：`progressCurrent`、`progressTotal`、`progressUnit`
  - 最近同步时间
  - 错误摘要
  - 文件复用标记
- 结果接口返回：
  - 可直接用于展示的 `overallScore`、`humanScore`、`summary`
  - 可枚举的 `segments` 或 `sentences`
- 权限相关接口或详情返回：
  - 当前用户在本工作区下是否可上传、可重试

如果这些字段缺失，前端只能靠推测拼装状态，会直接削弱 UX 的稳定性与可维护性。

## 6. 系统分层设计

建议沿用当前项目已有的 `route -> service -> repository/schema` 分层。

## 6.1 路由层

建议新增 API：

- `POST /api/workspaces/[workspaceSlug]/aigc-detection/tasks`
  - 上传文件并创建本地任务
- `GET /api/workspaces/[workspaceSlug]/aigc-detection/tasks`
  - 获取任务列表
- `GET /api/workspaces/[workspaceSlug]/aigc-detection/tasks/[taskId]`
  - 获取任务详情
- `POST /api/workspaces/[workspaceSlug]/aigc-detection/tasks/[taskId]/retry`
  - 失败任务重试
- `GET /api/workspaces/[workspaceSlug]/aigc-detection/tasks/[taskId]/result`
  - 获取标准化后的检测结果

路由职责：

- 工作区身份解析
- 权限校验
- 解析 `multipart/form-data` 或查询参数
- 调用 service
- 返回统一错误结构

额外要求：

- 这些 route 是前端唯一可访问入口
- 外部 AIGC 检测服务不得被前端直接请求

## 6.2 业务服务层

建议新增模块：

```text
app/lib/aigc-detection/
```

建议拆分：

- `service.ts`
  - 对外业务入口
- `repository.ts`
  - 任务数据读写
- `client.ts`
  - 外部 AIGC 检测服务 HTTP 客户端
- `dto.ts`
  - 对内对外 DTO
- `validators.ts`
  - zod 校验
- `errors.ts`
  - 业务错误定义
- `mapper.ts`
  - 外部结果到本地标准结构的映射
- `sync.ts`
  - 任务状态同步逻辑
- `storage.ts`
  - 本地文件缓存路径与读写封装

## 6.3 数据访问层

沿用 Drizzle + SQLite 模式，在 `app/lib/db/schema/` 中新增 AIGC 检测表，并追加 migration。

## 6.4 外部接口客户端层

`client.ts` 负责与独立 AIGC 检测服务交互：

- 构造 `multipart/form-data`
- 透传 `Idempotency-Key`
- 设置超时
- 解析错误码
- 标准化第三方返回数据

注意：

- 不要在 route 或 service 中直接散落 `fetch`
- 所有第三方契约映射集中到 `client.ts` 与 `mapper.ts`
- `client.ts` 只运行在服务端，前端代码不得 import 该模块

## 6.5 后台同步层

建议引入“懒轮询 + 主动轮询”组合方案：

- 主动轮询：创建任务后，服务端启动一次短周期同步
- 懒轮询：前端查询任务详情时，若任务仍未结束且距离上次同步超过阈值，则触发一次同步

原因：

- 当前项目是 Next.js 应用，不适合首期引入复杂常驻队列系统
- 该方案实现成本低，且足以支持首期业务

## 6.6 后端技术选型结论

本功能首期后端方案必须收敛为以下实现边界：

- 运行时：`Next.js Route Handlers`，且统一运行在 `Node.js runtime`
- Web 层：继续使用工作区路由 `/api/workspaces/[workspaceSlug]/...`
- 数据库：`SQLite`
- ORM：`drizzle-orm`
- Migration：`drizzle-kit`
- 校验：`zod`
- ID：本地任务与事件主键统一使用 `ulid`
- 时间：统一存储为 `Unix epoch ms`
- 文件哈希：统一使用 Node.js `crypto` 生成 `SHA-256`

原因：

- 该功能需要访问本地 `data/` 目录、落库 SQLite、处理 `multipart/form-data`，不适合 `Edge runtime`
- 当前项目已经存在工作区、多用户和本地持久化前提，继续沿用单体 BFF 方案，实施成本最低
- `drizzle-orm + SQLite` 已与本文其他设计保持一致，避免为单个子系统再引入独立存储栈

明确约束：

- 首期不引入独立 Java/Spring、NestJS、Rust 网关或额外微服务
- 首期不引入 Redis、BullMQ、RabbitMQ 作为任务队列前提
- 首期不引入对象存储作为上传主链路前提
- 第三方检测服务 SDK 若存在，也不得直接泄漏到 route 层；必须经 `client.ts` 二次封装

## 6.7 目录与职责规范

建议目录：

```text
app/
  api/
    workspaces/
      [workspaceSlug]/
        aigc-detection/
          tasks/
            route.ts
            [taskId]/
              route.ts
              result/
                route.ts
              retry/
                route.ts
  lib/
    aigc-detection/
      client.ts
      dto.ts
      errors.ts
      mapper.ts
      repository.ts
      service.ts
      storage.ts
      sync.ts
      validators.ts
    db/
      schema/
        aigc-detection.ts
```

职责边界必须满足：

- `route.ts`
  - 只处理 HTTP 协议、参数解析、权限校验、响应映射
- `service.ts`
  - 负责业务编排、事务边界、状态流转、去重决策、重试规则
- `repository.ts`
  - 只负责数据库读写，不承载业务策略
- `client.ts`
  - 只负责第三方 HTTP 协议与返回解析，不访问本地数据库
- `storage.ts`
  - 只负责本地文件路径、落盘、读取、删除
- `sync.ts`
  - 只负责与第三方状态同步和结果回填
- `dto.ts / mapper.ts / validators.ts`
  - 负责类型、契约、校验和内外部结构转换

禁止事项：

- route 层直接 `fetch` 第三方接口
- repository 层直接拼接第三方请求
- 前端页面直接依赖第三方返回 JSON 结构
- 在任意层使用 `any`

## 7. 数据模型设计

首期建议采用“任务主表 + 事件表”的双表方案，并在任务主表中内聚文件元数据、外部任务映射、结果快照与错误上下文。

这样设计的原因是：

- 当前核心查询维度是“工作区下有哪些任务、状态如何、结果是否完成”
- 结果主要用于单任务详情展示，暂无复杂跨任务统计分析需求
- 外部返回结构后续可能演进，首期需要兼顾灵活性与可维护性
- SQLite 更适合减少联表数量，把高频读取路径压缩到单表

数据库命名建议：

- 统一使用 `aigc_detection_*`
- 时间字段统一使用 `integer` 保存 Unix epoch ms
- JSON 统一使用 SQLite `text` 存储，服务层做 schema 校验
- 主键统一使用 `text` 类型承载 `ulid`

## 7.0 总体结论

建议新增以下两张表：

1. `aigc_detection_tasks`
   - 存任务主记录，也是列表页、详情页、重试入口的核心表
2. `aigc_detection_task_events`
   - 存异步链路事件与调试上下文，用于排障、审计、补偿

首期不额外拆 `result` 明细表，但要在 `aigc_detection_tasks` 中预留结构化摘要字段，避免列表页完全依赖 JSON 解析。

## 7.1 `aigc_detection_tasks`

用途：记录本地业务任务，并承载列表页和详情页的主要读取模型。

### 7.1.1 字段定义

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `text` | PK | 本地任务 ID，`ulid` |
| `workspace_id` | `text` | NOT NULL | 所属工作区 ID |
| `created_by` | `text` | NOT NULL | 创建用户 ID |
| `updated_by` | `text` | NULL | 最近更新用户 ID；系统轮询更新时可为空 |
| `status` | `text` | NOT NULL | 本地统一状态 |
| `external_task_id` | `text` | NULL, UNIQUE | 外部服务任务 ID |
| `external_status` | `text` | NULL | 外部任务状态镜像 |
| `source_file_name` | `text` | NOT NULL | 用户上传的原始文件名 |
| `source_file_ext` | `text` | NOT NULL | `pdf/doc/docx` |
| `source_mime_type` | `text` | NOT NULL | 上传时识别到的 MIME |
| `source_file_size` | `integer` | NOT NULL | 文件大小，字节 |
| `source_file_sha256` | `text` | NOT NULL | 文件 SHA-256，64 位小写十六进制 |
| `storage_path` | `text` | NOT NULL | 相对 `data/` 的相对路径 |
| `storage_status` | `text` | NOT NULL DEFAULT `'active'` | 本地缓存状态 |
| `idempotency_key` | `text` | NOT NULL | 发送第三方请求使用的幂等键 |
| `deduplicated` | `integer` | NOT NULL DEFAULT 0 | 是否命中历史复用或第三方去重；0/1 |
| `progress_current` | `integer` | NULL | 当前进度值 |
| `progress_total` | `integer` | NULL | 总进度值 |
| `progress_unit` | `text` | NULL | 进度单位，例如 `blocks` |
| `result_overall_score` | `real` | NULL | 全文 AIGC 率，0 到 1 |
| `result_human_score` | `real` | NULL | 全文人工概率，0 到 1；外部未返回则为空 |
| `result_summary` | `text` | NULL | 面向 UI 的结果摘要 |
| `result_json` | `text` | NULL | 标准化结果 JSON |
| `raw_result_json` | `text` | NULL | 外部原始结果 JSON |
| `error_code` | `text` | NULL | 业务或外部错误码 |
| `error_message` | `text` | NULL | 最近一次错误摘要 |
| `submitted_at` | `integer` | NULL | 成功提交第三方时间 |
| `completed_at` | `integer` | NULL | 成功或失败终态时间 |
| `last_synced_at` | `integer` | NULL | 最近一次第三方状态同步时间 |
| `last_sync_error_at` | `integer` | NULL | 最近一次同步失败时间 |
| `retry_count` | `integer` | NOT NULL DEFAULT 0 | 显式重试次数 |
| `created_at` | `integer` | NOT NULL | 创建时间 |
| `updated_at` | `integer` | NOT NULL | 更新时间 |

建议本地状态枚举：

- `queued_local`
  - 已接收上传，尚未提交外部
- `submit_failed`
  - 提交外部失败
- `submitted`
  - 已提交外部，等待处理
- `processing`
  - 外部处理中
- `succeeded`
  - 已成功
- `failed`
  - 已失败

### 7.1.2 查询设计与索引

列表页、详情页、轮询同步三类访问路径不同，因此索引需要围绕真实查询建立，而不是只按字段名平均分配。

建议索引：

- `(workspace_id, created_at desc)`
- `(workspace_id, status, updated_at desc)`
- `(source_file_sha256)`
- `(external_task_id)`
- `(created_by, created_at desc)`

建议补充索引：

- `(workspace_id, source_file_sha256, status, created_at desc)`
  - 用于同工作区内哈希复用和排查
- `(status, last_synced_at)`
  - 用于后台扫描需要同步的进行中任务
- `(workspace_id, source_file_name)`
  - 用于列表页按文件名搜索时的前缀或模糊过滤
- `(completed_at desc)`
  - 便于后台清理或归档任务

### 7.1.3 约束设计

- 主键：`id` 唯一
- 唯一索引：`external_task_id` 在非空时应唯一
- 非唯一索引：`(workspace_id, source_file_sha256)`，用于本地哈希复用和排查
- `status`、`storage_status`、`source_file_ext` 必须采用受限枚举，不允许自由文本
- `source_file_sha256` 必须满足固定长度与字符集约束
- `source_file_size`、`retry_count`、`progress_current`、`progress_total` 必须为非负整数
- `result_overall_score`、`result_human_score` 若非空，必须在 `0` 到 `1` 区间
- `submitted_at >= created_at`
- `completed_at >= submitted_at`
- `updated_at >= created_at`
- `result_json`、`raw_result_json` 使用 SQLite `text` 存 JSON 字符串，进入服务层后再做严格类型解析

### 7.1.4 推荐 DDL 草案

```sql
create table aigc_detection_tasks (
  id text primary key not null,
  workspace_id text not null,
  created_by text not null,
  updated_by text,
  status text not null,
  external_task_id text unique,
  external_status text,
  source_file_name text not null,
  source_file_ext text not null,
  source_mime_type text not null,
  source_file_size integer not null,
  source_file_sha256 text not null,
  storage_path text not null,
  storage_status text not null default 'active',
  idempotency_key text not null,
  deduplicated integer not null default 0,
  progress_current integer,
  progress_total integer,
  progress_unit text,
  result_overall_score real,
  result_human_score real,
  result_summary text,
  result_json text,
  raw_result_json text,
  error_code text,
  error_message text,
  submitted_at integer,
  completed_at integer,
  last_synced_at integer,
  last_sync_error_at integer,
  retry_count integer not null default 0,
  created_at integer not null,
  updated_at integer not null,
  constraint ck_aigc_detection_tasks_status
    check (status in ('queued_local', 'submit_failed', 'submitted', 'processing', 'succeeded', 'failed')),
  constraint ck_aigc_detection_tasks_storage_status
    check (storage_status in ('active', 'deleted')),
  constraint ck_aigc_detection_tasks_source_file_ext
    check (source_file_ext in ('pdf', 'doc', 'docx')),
  constraint ck_aigc_detection_tasks_sha256
    check (length(source_file_sha256) = 64),
  constraint ck_aigc_detection_tasks_source_file_size
    check (source_file_size >= 0),
  constraint ck_aigc_detection_tasks_retry_count
    check (retry_count >= 0),
  constraint ck_aigc_detection_tasks_progress_current
    check (progress_current is null or progress_current >= 0),
  constraint ck_aigc_detection_tasks_progress_total
    check (progress_total is null or progress_total >= 0),
  constraint ck_aigc_detection_tasks_progress_pair
    check (
      (progress_current is null and progress_total is null)
      or (progress_current is not null and progress_total is not null and progress_current <= progress_total)
    ),
  constraint ck_aigc_detection_tasks_result_overall_score
    check (result_overall_score is null or (result_overall_score >= 0 and result_overall_score <= 1)),
  constraint ck_aigc_detection_tasks_result_human_score
    check (result_human_score is null or (result_human_score >= 0 and result_human_score <= 1)),
  constraint ck_aigc_detection_tasks_deduplicated
    check (deduplicated in (0, 1)),
  constraint ck_aigc_detection_tasks_submitted_at
    check (submitted_at is null or submitted_at >= created_at),
  constraint ck_aigc_detection_tasks_completed_at
    check (
      completed_at is null
      or submitted_at is null
      or completed_at >= submitted_at
    ),
  constraint ck_aigc_detection_tasks_updated_at
    check (updated_at >= created_at),
  constraint ck_aigc_detection_tasks_result_json
    check (result_json is null or json_valid(result_json)),
  constraint ck_aigc_detection_tasks_raw_result_json
    check (raw_result_json is null or json_valid(raw_result_json))
);

create index idx_aigc_detection_tasks_workspace_created_at
  on aigc_detection_tasks(workspace_id, created_at desc);

create index idx_aigc_detection_tasks_workspace_status_updated_at
  on aigc_detection_tasks(workspace_id, status, updated_at desc);

create index idx_aigc_detection_tasks_sha256
  on aigc_detection_tasks(source_file_sha256);

create index idx_aigc_detection_tasks_workspace_sha256_status_created_at
  on aigc_detection_tasks(workspace_id, source_file_sha256, status, created_at desc);

create index idx_aigc_detection_tasks_status_last_synced_at
  on aigc_detection_tasks(status, last_synced_at);

create index idx_aigc_detection_tasks_created_by_created_at
  on aigc_detection_tasks(created_by, created_at desc);
```

说明：

- `result_overall_score`、`result_summary` 直接落结构化列，是为了让列表页展示结果无需反复解析 `result_json`
- `deduplicated` 统一表示“命中复用路径”，既可来自本地成功结果复用，也可来自第三方按哈希去重
- `updated_by` 在系统后台轮询场景允许为空，避免伪造“用户更新人”

## 7.2 `aigc_detection_task_events`

用途：记录状态流转与调试事件，避免后续排障只能看最终状态。

### 7.2.1 字段定义

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `text` | PK | 事件 ID，`ulid` |
| `task_id` | `text` | NOT NULL, FK | 对应本地任务 ID |
| `workspace_id` | `text` | NOT NULL | 冗余存储，便于按工作区审计 |
| `event_type` | `text` | NOT NULL | 事件类型 |
| `from_status` | `text` | NULL | 流转前状态 |
| `to_status` | `text` | NULL | 流转后状态 |
| `payload_json` | `text` | NULL | 结构化上下文 |
| `operator_type` | `text` | NOT NULL | `user/system` |
| `created_by` | `text` | NULL | 用户触发时记录用户 ID，系统任务可为空 |
| `created_at` | `integer` | NOT NULL | 事件时间 |

### 7.2.2 事件类型建议

建议约束为受控枚举，至少包括：

- `task_created`
- `file_saved`
- `submit_requested`
- `submit_succeeded`
- `submit_failed`
- `status_synced`
- `result_synced`
- `sync_failed`
- `retry_requested`
- `retry_submitted`
- `storage_deleted`

### 7.2.3 推荐 DDL 草案

```sql
create table aigc_detection_task_events (
  id text primary key not null,
  task_id text not null,
  workspace_id text not null,
  event_type text not null,
  from_status text,
  to_status text,
  payload_json text,
  operator_type text not null,
  created_by text,
  created_at integer not null,
  foreign key (task_id) references aigc_detection_tasks(id) on delete cascade,
  constraint ck_aigc_detection_task_events_event_type
    check (
      event_type in (
        'task_created',
        'file_saved',
        'submit_requested',
        'submit_succeeded',
        'submit_failed',
        'status_synced',
        'result_synced',
        'sync_failed',
        'retry_requested',
        'retry_submitted',
        'storage_deleted'
      )
    ),
  constraint ck_aigc_detection_task_events_operator_type
    check (operator_type in ('user', 'system')),
  constraint ck_aigc_detection_task_events_payload_json
    check (payload_json is null or json_valid(payload_json))
);

create index idx_aigc_detection_task_events_task_created_at
  on aigc_detection_task_events(task_id, created_at desc);

create index idx_aigc_detection_task_events_workspace_created_at
  on aigc_detection_task_events(workspace_id, created_at desc);

create index idx_aigc_detection_task_events_event_type_created_at
  on aigc_detection_task_events(event_type, created_at desc);
```

这张表不是首期硬性必需，但强烈建议保留。异步任务链路如果没有事件表，后续很难排查“为何失败”“何时同步过”“外部返回过什么”。

## 7.3 是否拆分结果表

首期不建议额外拆出 `aigc_detection_results` 或句级明细表。

原因：

- 当前结果来源完全依赖外部服务
- 首期更关注任务状态跑通
- 结果 JSON 结构未来可能调整，直接存 `result_json` 更灵活
- 列表页只需要 `result_overall_score`、`result_summary` 等少量摘要字段
- 若把句级、段级结果拆表，会显著增加写放大、迁移复杂度与查询面

后续如果需要做结果搜索、统计聚合、句子级筛选，再考虑结果明细表拆分。

未来如需拆分，建议优先新增：

- `aigc_detection_result_segments`
- `aigc_detection_result_sentences`

而不是在首期提前建设高复杂度范式模型。

## 7.4 哈希复用与唯一性策略

`source_file_sha256` 是本功能后续性能优化的关键字段，但不能错误设计成全局唯一。

建议原则：

- 不对 `source_file_sha256` 做全局唯一约束
- 允许同一文件在不同工作区、不同时间形成多条任务记录
- “是否复用已有结果”是服务层策略，不是数据库唯一性策略

推荐复用判定顺序：

1. 查询当前工作区内最近一条 `status = 'succeeded'` 且 `source_file_sha256` 相同的任务
2. 若启用跨工作区复用策略，再查询全局最近成功任务
3. 若本地没有命中，再查询第三方 `GET /files/{sha256}/result`
4. 若仍未命中，再走正常上传提交流程

这样可以避免数据库层把业务策略写死，同时保留清晰的审计链路。

## 7.5 状态机与流转约束

本地任务状态机必须固定，避免实现阶段各处自行定义：

```text
queued_local
  -> submitted
  -> processing
  -> succeeded

queued_local
  -> submit_failed

submitted | processing
  -> failed

submit_failed | failed
  -> submitted   (retry)
```

流转规则：

- `queued_local`
  - 文件已入库入盘，但尚未成功提交第三方
- `submit_failed`
  - 仅表示“提交第三方失败”，不表示第三方任务执行失败
- `submitted`
  - 已拿到 `external_task_id`，但尚未进入明确处理中间态
- `processing`
  - 第三方已开始处理
- `succeeded`
  - 已拿到并落库标准化结果
- `failed`
  - 第三方任务终态失败，或结果查询返回明确失败终态

约束：

- `succeeded` 后禁止再次同步覆盖已落库结果，除非走显式重试
- `submit_failed` / `failed` 之外的状态不得执行重试
- 状态流转必须由 `service.ts` 或 `sync.ts` 统一执行，route/repository 不得私自更新
- 每次状态变化都应同时写入 `aigc_detection_task_events`
- `submitted` 起必须保证 `external_task_id` 非空
- `succeeded` 起必须保证 `result_json`、`result_overall_score`、`completed_at` 已写入
- `failed` 终态必须至少具备 `error_code` 或 `error_message` 之一

## 7.6 核心读写路径与事务要求

为避免“数据库记录和文件状态不一致”或“本地任务已创建但状态不完整”，建议按以下边界组织事务。

### 7.6.1 创建任务

步骤：

1. 生成 `taskId`
2. 落盘原文件
3. 计算 `sha256`
4. 开启数据库事务
5. 插入 `aigc_detection_tasks`
6. 插入 `task_created`、`file_saved` 事件
7. 提交事务
8. 事务外调用第三方创建任务
9. 再开启短事务回写 `external_task_id`、`status`、`submitted_at`

原因：

- 文件写入不应放进数据库事务
- 第三方网络调用不应长时间占用 SQLite 写锁
- 本地任务必须先持久化，第三方调用失败时才能保留 `submit_failed` 可重试记录

### 7.6.2 状态同步

步骤：

1. 查询 `status in ('submitted', 'processing')` 的任务
2. 拉取第三方状态
3. 若仍处理中，仅更新状态镜像、进度、`last_synced_at`
4. 若已成功，再拉取结果并在单事务中写入：
   - `status = 'succeeded'`
   - `external_status`
   - `result_overall_score`
   - `result_human_score`
   - `result_summary`
   - `result_json`
   - `raw_result_json`
   - `completed_at`
   - 事件表
5. 若失败，则在单事务中写入终态错误信息与事件

### 7.6.3 重试任务

重试建议复用同一条任务记录，不新建任务主记录，但要刷新外部映射和结果字段：

- `status` 置回 `submitted`
- 清空旧 `external_task_id`
- 清空 `result_*`
- 清空 `raw_result_json`
- 清空 `completed_at`
- `retry_count + 1`
- 写入 `retry_requested`、`retry_submitted` 事件

这样可以让任务详情页保持稳定 URL，也能明确看到一个任务的完整失败与重试历史。

## 8. 本地文件缓存设计

## 8.1 目录规划

基于当前 `getDataDir()`，建议新增目录：

```text
data/
  aigc-detection/
    uploads/
      {workspaceId}/
        {taskId}/
          original.pdf
    temp/
```

建议 `storage_path` 保存相对 `data/` 的相对路径，避免环境切换时绝对路径失效。

## 8.2 文件写入策略

上传成功后立即：

1. 生成本地任务 ID
2. 创建任务目录
3. 将原文件写入 `data/aigc-detection/uploads/{workspaceId}/{taskId}/`
4. 计算 `sha256`
5. 将文件元信息写入数据库

注意：

- 不要以原始文件名直接作为最终文件路径，避免特殊字符和重名问题
- 建议标准化保存名为 `original.{ext}`

## 8.3 清理策略

首期不删除成功任务文件，保留用于审计与复试。

可以预留后续清理策略：

- 失败任务保留 7 到 30 天
- 成功任务保留 90 天或按磁盘阈值清理
- 清理时仅标记 `storage_status=deleted`，并记录事件

## 9. 外部服务对接方案

## 9.0 对接原则

后端对第三方服务的调用必须遵循以下规范：

- 所有第三方请求都通过 `client.ts`
- 所有第三方返回先做 schema 校验，再映射为本地 DTO
- 所有第三方错误先归一化为本地错误码，再决定是否暴露给前端
- 所有第三方超时、网络失败、5xx 都必须写入任务事件表和结构化日志
- 不在数据库中持久化第三方鉴权密钥

## 9.1 环境变量

建议新增：

- `AIGC_DETECTION_API_BASE_URL`
  - 例如 `http://127.0.0.1:3000`
- `AIGC_DETECTION_API_TIMEOUT_MS`
  - 调用第三方超时
- `AIGC_DETECTION_SYNC_INTERVAL_MS`
  - 轮询间隔，默认 5000
- `AIGC_DETECTION_SYNC_STALE_MS`
  - 懒同步判定阈值，默认 8000
- `AIGC_DETECTION_MAX_UPLOAD_BYTES`
  - 本系统接收上传大小限制，应不高于外部限制

建议在 `.env` 中定义，例如：

```dotenv
AIGC_DETECTION_API_BASE_URL=http://127.0.0.1:3000
AIGC_DETECTION_API_TIMEOUT_MS=30000
AIGC_DETECTION_SYNC_INTERVAL_MS=5000
AIGC_DETECTION_SYNC_STALE_MS=8000
AIGC_DETECTION_MAX_UPLOAD_BYTES=52428800
```

约束：

- 不使用 `NEXT_PUBLIC_` 前缀
- 不把外部服务地址下发到浏览器
- 所有第三方请求均由本项目服务端读取 `.env` 后发起

建议追加：

- `AIGC_DETECTION_SYNC_LOCK_MS`
  - 详情接口触发懒同步时的本地锁超时，默认 `15000`
- `AIGC_DETECTION_RESULT_CACHE_ENABLED`
  - 是否启用本地成功结果复用，默认 `false`

## 9.2 创建任务调用

本系统调用外部：

`POST /api/v1/aigc-detection/tasks`

建议映射规则：

- `file`
  - 使用本地缓存文件重新构造 multipart
- `metadata`
  - 注入本系统业务元数据，例如：
    - `workspaceId`
    - `workspaceSlug`
    - `localTaskId`
    - `createdBy`
- `force_reprocess`
  - 首期默认 `false`
- `Idempotency-Key`
  - 建议使用 `sha256 + workspaceId` 派生

说明：

- 工作区维度是否参与幂等键，需要看业务是否允许同一文件在不同工作区重复创建独立任务
- 推荐加入 `workspaceId`，避免跨工作区请求产生语义耦合
- 此调用只能在本项目服务端进行，前端只提交文件到本项目的 `/api/workspaces/[workspaceSlug]/aigc-detection/tasks`

实现要求：

- 创建本地任务、写入文件、计算哈希、保存数据库记录，必须先成功，再发起第三方提交
- 第三方提交成功后，必须在同一业务动作中回写 `external_task_id`、`submitted_at`、`status`
- 第三方提交失败时，不回滚本地任务和本地文件，而是把任务置为 `submit_failed`

## 9.3 状态同步调用

同步过程分两步：

1. `GET /api/v1/aigc-detection/tasks/{externalTaskId}`
2. 若状态为 `succeeded`，再调用 `GET /api/v1/aigc-detection/tasks/{externalTaskId}/result`

本地统一状态映射建议：

- `queued` -> `submitted`
- `preprocessing` -> `processing`
- `detecting` -> `processing`
- `aggregating` -> `processing`
- `succeeded` -> `succeeded`
- `failed` -> `failed`
- `canceled` -> `failed`

同步要求：

- 同步任务状态时只允许从“旧状态”向“更终态”推进，不允许把 `failed/succeeded` 回退到处理中
- 第三方状态查询失败时，不覆盖本地终态，只更新 `last_synced_at`、事件记录与错误上下文
- 只有在第三方状态为成功终态时，才允许拉取 `result` 并更新 `result_json`

## 9.4 结果标准化

本地不要直接把外部原始 JSON 原封不动暴露给前端。

建议输出统一 DTO：

- `taskId`
- `status`
- `overallScore`
  - 页面展示的 AIGC 率
- `humanScore`
  - 如外部有返回则保留
- `summary`
  - 结果摘要文案
- `segments`
  - 分段/分块结果
- `sentences`
  - 句级结果
- `createdAt`
- `completedAt`

同时在数据库中保留：

- `result_json`
  - 标准化结构
- `raw_result_json`
  - 外部原始结构

这样前端契约稳定，第三方升级时改动集中在服务端映射层。

## 9.5 技术方案指导

首期推荐方案：

- 单体 BFF：当前最佳解，应作为正式设计结论
- 本地 SQLite：满足任务中心、审计、重试与缓存索引需求
- 轻量轮询同步：满足现阶段异步任务编排，无需额外基础设施

备选方案与取舍：

- 方案 A：引入 Redis + Worker 主动消费队列
  - 优点：异步处理更强，适合高并发
  - 缺点：部署和运维复杂度显著提高
  - 结论：首期不采用
- 方案 B：引入独立后端微服务包装 AIGC 检测
  - 优点：服务边界清晰
  - 缺点：当前项目仍是单体 BFF，拆分过早，增加鉴权和工作区上下文传递成本
  - 结论：首期不采用
- 方案 C：浏览器直连第三方检测服务
  - 优点：实现快
  - 缺点：泄漏真实地址、难做权限与审计、无法稳定沉淀任务中心
  - 结论：明确禁止

## 10. 权限模型

当前仓库已有工作区权限体系，但尚无 AIGC 检测相关权限。建议新增：

- `aigc_detection:read`
- `aigc_detection:write`

建议授权：

- `owner`：全部
- `admin`：全部
- `editor`：`read + write`
- `viewer`：仅 `read`

说明：

- 如果产品希望查看者也能上传，可给 `viewer` 开放 `write`，但这通常不符合工作区最小权限原则
- 不建议直接复用 `project:*` 或 `credential:*` 权限名，避免语义混乱

## 11. 接口设计

本节定义本功能正式后端 API 契约。实现阶段必须以本节为准，不再由页面或调用方临时发明字段。

## 11.0 统一响应结构

成功响应：

```json
{
  "data": {}
}
```

列表响应：

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

失败响应：

```json
{
  "error": {
    "code": "AIGC_DETECTION_VALIDATION_FAILED",
    "message": "Uploaded file type is not supported",
    "details": null,
    "requestId": "01J..."
  }
}
```

约束：

- 所有接口都返回 JSON，不返回裸字符串
- `requestId` 建议从统一请求上下文注入，便于排障
- `details` 仅用于字段级校验信息或安全可暴露的业务上下文

## 11.0.1 DTO 规范

建议统一 DTO：

```ts
interface AigcDetectionTaskSummary {
  id: string;
  workspaceId: string;
  sourceFileName: string;
  sourceFileExt: 'pdf' | 'doc' | 'docx';
  sourceFileSize: number;
  sourceFileSha256: string;
  status: 'queued_local' | 'submit_failed' | 'submitted' | 'processing' | 'succeeded' | 'failed';
  externalStatus: string | null;
  progressCurrent: number | null;
  progressTotal: number | null;
  progressUnit: string | null;
  overallScore: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  retryCount: number;
  deduplicated: boolean;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}
```

```ts
interface AigcDetectionTaskDetail extends AigcDetectionTaskSummary {
  canRetry: boolean;
  resultAvailable: boolean;
  submittedAt: number | null;
  lastSyncedAt: number | null;
}
```

```ts
interface AigcDetectionResultDto {
  taskId: string;
  status: 'succeeded';
  overallScore: number;
  humanScore: number | null;
  summary: string | null;
  segments: unknown[];
  sentences: unknown[];
  createdAt: number;
  completedAt: number;
}
```

说明：

- `segments`、`sentences` 进入实现阶段时应继续细化为明确类型；若第三方结构尚不稳定，先在 `mapper.ts` 内部做严格 schema 约束后再导出
- 即使内部持久化 `raw_result_json`，对外 DTO 也不得直接透出第三方原始结构

## 11.1 创建任务

`POST /api/workspaces/[workspaceSlug]/aigc-detection/tasks`

请求类型：

- `multipart/form-data`

字段：

- `file`
- `forceReprocess`

约束：

- `file` 必填
- `forceReprocess` 可选，布尔值，默认 `false`
- 服务端最大接收体积由 `AIGC_DETECTION_MAX_UPLOAD_BYTES` 控制

成功响应：

- `201 Created`

```json
{
  "data": {
    "task": {
      "id": "01J...",
      "workspaceId": "01W...",
      "sourceFileName": "paper.pdf",
      "sourceFileExt": "pdf",
      "sourceFileSize": 123456,
      "sourceFileSha256": "abcd...",
      "status": "submitted",
      "externalStatus": "queued",
      "progressCurrent": null,
      "progressTotal": null,
      "progressUnit": null,
      "overallScore": null,
      "errorCode": null,
      "errorMessage": null,
      "retryCount": 0,
      "deduplicated": false,
      "createdAt": 1760000000000,
      "updatedAt": 1760000000000,
      "completedAt": null
    },
    "reusedResult": false
  }
}
```

返回：

- 本地任务 ID
- 当前状态
- 文件信息
- 是否复用已有结果

失败码：

- `400` `AIGC_DETECTION_BAD_REQUEST`
- `403` `AIGC_DETECTION_FORBIDDEN`
- `413` `AIGC_DETECTION_FILE_TOO_LARGE`
- `415` `AIGC_DETECTION_UNSUPPORTED_FILE_TYPE`
- `422` `AIGC_DETECTION_VALIDATION_FAILED`
- `502` `AIGC_DETECTION_EXTERNAL_SUBMIT_FAILED`
- `500` `AIGC_DETECTION_STORAGE_ERROR`

## 11.2 查询任务列表

`GET /api/workspaces/[workspaceSlug]/aigc-detection/tasks`

查询参数建议：

- `page`
- `pageSize`
- `status`
- `keyword`
- `createdBy`

默认值：

- `page = 1`
- `pageSize = 20`
- `status = all`

响应：

- `200 OK`
- `items` 元素为 `AigcDetectionTaskSummary`

排序：

- 默认 `createdAt desc`

## 11.3 查询任务详情

`GET /api/workspaces/[workspaceSlug]/aigc-detection/tasks/[taskId]`

返回：

- 任务基础信息
- 进度
- 错误信息
- 是否可重试
- 结果摘要

响应：

- `200 OK`
- `data.task` 为 `AigcDetectionTaskDetail`

行为约束：

- 如果任务状态是 `submitted/processing`，接口内部可按同步阈值触发一次懒同步
- 懒同步失败不改变 HTTP 200 语义，但需要更新任务事件与错误上下文

## 11.4 查询任务结果

`GET /api/workspaces/[workspaceSlug]/aigc-detection/tasks/[taskId]/result`

行为：

- 未完成返回业务错误
- 已完成返回标准化结果 DTO

响应：

- `200 OK`：返回 `AigcDetectionResultDto`
- `409 Conflict`：任务未完成
- `404 Not Found`：任务不存在或不属于当前工作区

## 11.5 重试任务

`POST /api/workspaces/[workspaceSlug]/aigc-detection/tasks/[taskId]/retry`

行为：

- 仅 `submit_failed` 或 `failed` 可重试
- 重试时复用原始缓存文件
- 生成新的外部任务 ID
- 增加 `retry_count`
- 写入事件表

是否生成新的本地任务记录，有两种方案：

- 方案 A：在原任务上重试
- 方案 B：复制原任务生成新任务

首期建议方案 A。

原因：

- 前端更简单
- 不会把一次业务动作拆成多条相似任务
- 对首期“看最终结果”场景更直观

成功响应：

- `200 OK`
- 返回最新 `AigcDetectionTaskDetail`

## 12. 异步同步策略

## 12.1 为什么不用真正后台队列

当前仓库没有现成队列系统。首期如果直接引入 Redis、BullMQ 或独立 Worker，会明显放大实现复杂度与部署成本。

因此建议首期采用轻量策略：

- 创建任务后立即同步一次
- 前端详情轮询本系统任务详情接口
- 任务详情接口内部按“过期判定”触发同步

技术结论：

- 该功能采用“请求驱动同步”为正式方案
- 后续只有在并发量、排队时长、失败补偿复杂度明显提升后，才升级到独立队列

## 12.2 同步触发规则

当任务状态属于：

- `submitted`
- `processing`

且满足以下任一条件时触发同步：

- `last_synced_at` 为空
- `now - last_synced_at > AIGC_DETECTION_SYNC_STALE_MS`

为避免并发重复同步，建议增加“同步锁”机制，至少满足以下之一：

- 数据库字段 `syncing_until`
- 进程内短锁

首期更建议用数据库字段或状态 CAS，避免多请求并发导致重复同步。

推荐实现：

- 表中增加 `syncing_until`
- 触发同步前执行条件更新：
  - `where id = ? and (syncing_until is null or syncing_until < now)`
- 抢锁成功的请求负责实际同步
- 同步完成后清空或回写新的 `syncing_until`

## 12.3 详情页轮询建议

前端轮询本系统详情接口即可，不直接轮询第三方。

建议：

- `submitted/processing` 状态下每 5 秒轮询
- `succeeded/failed` 后停止轮询

这样可以保证：

- 第三方凭证与错误映射都封装在服务端
- 前端不感知第三方任务结构
- 外部 API 地址不会暴露到浏览器网络层

## 13. 校验与错误处理

## 13.1 上传前后校验

前后端都要校验：

- 扩展名仅允许 `pdf`/`doc`/`docx`
- 文件大小不超过上限
- 文件不能为空

服务端还应额外校验：

- 工作区权限
- 文件写入是否成功
- `sha256` 是否计算成功

建议追加：

- `workspaceSlug` 必须可解析到当前用户有权访问的工作区
- `taskId` 必须是合法 `ulid`
- `page/pageSize` 必须做上限保护，避免异常分页参数拖垮 SQLite

## 13.2 错误分类

建议分类：

- `VALIDATION_ERROR`
  - 文件类型、大小、参数问题
- `STORAGE_ERROR`
  - 本地文件写入失败
- `EXTERNAL_SUBMIT_ERROR`
  - 调用外部创建任务失败
- `EXTERNAL_SYNC_ERROR`
  - 同步状态或结果失败
- `TASK_NOT_FOUND`
  - 本地任务不存在
- `TASK_NOT_COMPLETED`
  - 结果尚未生成

建议正式错误码收敛为：

| HTTP Status | code | 说明 |
| --- | --- | --- |
| `400` | `AIGC_DETECTION_BAD_REQUEST` | 请求格式错误 |
| `403` | `AIGC_DETECTION_FORBIDDEN` | 无工作区访问或写入权限 |
| `404` | `AIGC_DETECTION_TASK_NOT_FOUND` | 任务不存在 |
| `409` | `AIGC_DETECTION_TASK_NOT_COMPLETED` | 任务未完成，无法取结果 |
| `409` | `AIGC_DETECTION_TASK_NOT_RETRYABLE` | 当前状态不可重试 |
| `413` | `AIGC_DETECTION_FILE_TOO_LARGE` | 文件超过限制 |
| `415` | `AIGC_DETECTION_UNSUPPORTED_FILE_TYPE` | 文件类型不支持 |
| `422` | `AIGC_DETECTION_VALIDATION_FAILED` | 字段级业务校验失败 |
| `500` | `AIGC_DETECTION_STORAGE_ERROR` | 本地文件或数据库操作失败 |
| `502` | `AIGC_DETECTION_EXTERNAL_SUBMIT_FAILED` | 第三方创建任务失败 |
| `502` | `AIGC_DETECTION_EXTERNAL_SYNC_FAILED` | 第三方状态同步失败 |
| `500` | `AIGC_DETECTION_INTERNAL_ERROR` | 未分类服务端错误 |

## 13.3 用户可见错误文案

前端不要直接展示第三方原始错误。应映射为：

- 上传文件类型不支持
- 文件超过大小限制
- 检测任务提交失败，请稍后重试
- 检测处理中，请稍后刷新
- 检测失败，请重新提交

同时保留原始错误信息在数据库和日志中用于排障。

## 14. 可维护性要求

## 14.1 契约隔离

第三方返回结构必须被隔离在 `client.ts/mapper.ts` 中。页面、route、repository 不应直接依赖 OpenAPI 原始结构。

## 14.2 类型收敛

所有外部接口返回值都应先经过 zod 校验或严格类型映射，再进入业务层。禁止把 `unknown` 或隐式结构直接传到页面层。

## 14.3 路径统一

运行时目录一律通过 `app/lib/runtime-paths.ts` 扩展获取，不要在业务代码中散落 `path.resolve('data/...')`。

建议后续增加：

- `getAigcDetectionDataDir()`
- `getAigcDetectionUploadDir()`

## 14.4 事务与一致性要求

必须遵循：

- 创建任务时，“写文件 + 写本地任务记录”必须视为一个业务动作
- 若文件已落盘但数据库写入失败，必须执行补偿删除或记录孤儿文件清理事件
- 重试任务时，更新 `retry_count`、重置错误字段、刷新同步字段必须在单事务内完成
- 写入结果时，`status`、`completed_at`、`result_json`、`raw_result_json` 必须在单事务内提交

不得：

- 先把任务标记为 `succeeded`，再异步补写 `result_json`
- 在多个 route 中直接拼接 SQL 片段完成一次状态流转

## 14.5 可观测性要求

至少补充：

- 结构化日志字段：`workspaceId`、`taskId`、`externalTaskId`、`requestId`、`status`
- 关键事件日志：创建任务、提交第三方、同步状态、拉取结果、重试
- 错误日志不得包含文件正文与原文内容

## 14.6 测试要求

后端实现最少应覆盖：

- `validators.ts` 单元测试
- `mapper.ts` 单元测试
- `service.ts` 状态流转测试
- `repository.ts` 基础 CRUD 与索引字段测试
- Route Handler 的鉴权与错误码集成测试

## 15. 安全与合规

## 15.1 文件访问安全

- 文件下载或查看必须经过工作区权限校验
- 不应暴露真实磁盘路径给前端
- 不应允许通过路径参数拼接访问本地文件

## 15.2 敏感数据

论文或文档可能包含敏感内容，因此：

- 首期不要把文件内容打印到日志
- 日志中最多记录任务 ID、工作区 ID、文件名、大小、哈希前缀

## 15.3 外部服务可用性

当外部服务不可用时，本系统要做到：

- 本地任务可见
- 状态明确为 `submit_failed`
- 支持人工或用户重试

不能因为第三方失败导致用户上传动作在系统内“完全消失”。

## 16. 实施建议

建议分 4 个阶段实施。

## 16.1 阶段一：数据与基础设施

- 新增 schema 与 migration
- 新增运行时目录方法
- 新增本地文件存储封装
- 新增第三方 client 与 DTO

## 16.2 阶段二：任务 API

- 创建任务接口
- 任务列表接口
- 任务详情接口
- 任务结果接口
- 失败重试接口

## 16.3 阶段三：页面

- 工作区列表页
- 上传入口
- 任务详情页
- 状态轮询

## 16.4 阶段四：增强

- 本地哈希复用
- 事件审计页
- 清理脚本
- 更细粒度结果可视化

## 17. 推荐结论

推荐采用“工作区任务中心 + 本地文件缓存 + SQLite 任务记录 + 外部异步检测服务 + 轻量轮询同步”的方案。

该方案的核心优点：

- 贴合当前仓库技术栈，落地成本低
- 满足本地 `data/` 缓存与数据库记账要求
- 对第三方服务做了良好隔离，后续替换成本可控
- 以任务模型承接异步状态，产品形态更稳定
- 不需要首期引入复杂队列系统

如果进入实现阶段，建议优先完成：

1. 数据表与本地文件存储封装
2. 第三方 client 与任务创建链路
3. 任务详情同步逻辑
4. 工作区列表页与详情页
