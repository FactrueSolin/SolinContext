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

## 7. 数据模型设计

建议至少新增两张表。

## 7.1 `aigc_detection_tasks`

用途：记录本地业务任务。

建议字段：

- `id`
  - 本地任务 ID，主键，`ulid`
- `workspace_id`
  - 所属工作区
- `created_by`
  - 创建用户
- `updated_by`
  - 最近更新用户，可为空
- `source_file_name`
  - 原始文件名
- `source_file_ext`
  - 文件扩展名，限定 `pdf | doc | docx`
- `source_mime_type`
  - 上传时识别出的 MIME
- `source_file_size`
  - 文件大小，字节
- `source_file_sha256`
  - 文件哈希
- `storage_path`
  - 本地缓存绝对或相对路径
- `storage_status`
  - `active | deleted`
- `external_task_id`
  - 外部服务返回的任务 ID
- `external_status`
  - 外部任务状态镜像
- `status`
  - 本地统一状态
- `progress_current`
  - 当前进度
- `progress_total`
  - 总进度
- `progress_unit`
  - 进度单位，例如 `blocks`
- `deduplicated`
  - 是否命中外部去重
- `idempotency_key`
  - 提交第三方时使用的幂等键
- `result_json`
  - 标准化结果 JSON
- `raw_result_json`
  - 外部原始结果 JSON
- `error_code`
  - 业务或外部错误码
- `error_message`
  - 错误信息
- `submitted_at`
  - 提交到外部时间
- `completed_at`
  - 完成时间
- `last_synced_at`
  - 最近同步外部状态时间
- `retry_count`
  - 重试次数
- `created_at`
  - 创建时间
- `updated_at`
  - 更新时间

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

建议索引：

- `(workspace_id, created_at desc)`
- `(workspace_id, status, updated_at desc)`
- `(source_file_sha256)`
- `(external_task_id)`
- `(created_by, created_at desc)`

## 7.2 `aigc_detection_task_events`

用途：记录状态流转与调试事件，避免后续排障只能看最终状态。

建议字段：

- `id`
- `task_id`
- `workspace_id`
- `event_type`
  - 例如 `file_saved`、`submitted`、`sync_status`、`sync_result`、`retry`
- `payload_json`
- `created_by`
- `created_at`

这张表不是首期硬性必需，但强烈建议保留。异步任务链路如果没有事件表，后续很难排查“为何失败”“何时同步过”“外部返回过什么”。

## 7.3 是否拆分结果表

首期不建议额外拆出 `aigc_detection_results`。

原因：

- 当前结果来源完全依赖外部服务
- 首期更关注任务状态跑通
- 结果 JSON 结构未来可能调整，直接存 `result_json` 更灵活

后续如果需要做结果搜索、统计聚合、句子级筛选，再考虑结果明细表拆分。

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

## 11.1 创建任务

`POST /api/workspaces/[workspaceSlug]/aigc-detection/tasks`

请求类型：

- `multipart/form-data`

字段：

- `file`
- `forceReprocess`

返回：

- 本地任务 ID
- 当前状态
- 文件信息
- 是否复用已有结果

## 11.2 查询任务列表

`GET /api/workspaces/[workspaceSlug]/aigc-detection/tasks`

查询参数建议：

- `page`
- `pageSize`
- `status`
- `keyword`
- `createdBy`

## 11.3 查询任务详情

`GET /api/workspaces/[workspaceSlug]/aigc-detection/tasks/[taskId]`

返回：

- 任务基础信息
- 进度
- 错误信息
- 是否可重试
- 结果摘要

## 11.4 查询任务结果

`GET /api/workspaces/[workspaceSlug]/aigc-detection/tasks/[taskId]/result`

行为：

- 未完成返回业务错误
- 已完成返回标准化结果 DTO

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

## 12. 异步同步策略

## 12.1 为什么不用真正后台队列

当前仓库没有现成队列系统。首期如果直接引入 Redis、BullMQ 或独立 Worker，会明显放大实现复杂度与部署成本。

因此建议首期采用轻量策略：

- 创建任务后立即同步一次
- 前端详情轮询本系统任务详情接口
- 任务详情接口内部按“过期判定”触发同步

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
