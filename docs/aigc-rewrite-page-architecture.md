# 降低 AIGC 页面架构设计

## 1. 文档定位

本文定义“降低 AIGC”功能的新页面架构，目标是为后续实现提供单一设计基线。本文覆盖：

- 页面定位与交互流程
- 前端状态与本地存储方案
- 提示词上下文构造方式
- 与现有生成链路的复用边界
- 后端环境变量与接口职责

本文不覆盖：

- 具体视觉稿
- 数据库落库设计
- 多样本模板管理后台

## 2. 背景与核心约束

### 2.1 业务目标

“降低 AIGC”页面的目标不是做通用润色工具，而是让用户先提供一组“原文 -> 自己改写后的文本”作为风格样本，再让模型按这组样本去改写新的目标文本，从而尽量模仿真实大学生的表达习惯，降低文本的 AI 痕迹。

### 2.2 已知约束

- AI 配置必须在后端 `.env` 中完成，前端页面不再暴露 `baseUrl`、`apiKey`、`model`
- 样本数据先保存在前端，不要求首期落库
- 实际改写由 AI 完成
- 请求链路必须复用现有前端“自动”参数思路
- 必须启用流式返回
- 必须启用 thinking 模式

### 2.3 设计原则

#### 原则 A：样本是前端私有工作数据

用户录入的“改写前/改写后”样本只保存在浏览器侧，用于当前页面反复试写，不进入项目主数据模型，不进入数据库。

#### 原则 B：模型配置后置到服务端

前端只提交业务字段，不提交 AI 密钥与底层服务地址。这样可以避免把能力入口做成“另一个 API 配置面板”。

#### 原则 C：复用现有生成能力，不复制一套调用协议

当前仓库已经有 `/api/generate`，并且支持：

- Anthropic 兼容消息格式
- `stream`
- `thinking`
- 自动推断部分高级参数

新页面应尽量复用这套生成能力，只在服务端增加一层“业务适配”。

## 3. 产品定位

### 3.1 推荐定位

“降低 AIGC”应作为工作区下的独立页面模块，而不是塞进现有 `Project` 编辑页。

推荐路由：

```text
/w/:workspaceSlug/aigc-rewrite
```

原因：

- 该能力有独立的操作心智，不属于通用消息编辑
- 它不依赖当前 `Project.messages` 的多轮对话结构
- 单独页面更容易收敛状态、表单校验和结果展示

### 3.2 路由扩展建议

当前 `WorkspaceModule` 建议新增：

- `aigc-rewrite`

这会让页面在工作区导航中成为稳定模块，后续若需要加入“历史样本”“多模板切换”，扩展成本更低。

## 4. 页面信息架构

页面建议拆成 3 个主区域。

### 4.1 区域一：样本标定区

用途：录入用户自己的风格样本。

字段：

- `改写前文本`
- `改写后文本`

动作：

- `保存样本`
- `清空样本`

交互要求：

- 两个字段都必填
- 两段文本不能完全相同
- 允许输入一整章或一整节
- 保存后在页面顶部显示“当前已加载 1 组样本”

### 4.2 区域二：待改写区

用途：输入本次需要改写的目标文本。

字段：

- `待改写文本`

动作：

- `开始改写`
- `停止生成`
- `清空`

交互要求：

- 没有样本时禁止提交
- 待改写文本为空时禁止提交
- 提交后按钮进入 loading 状态

### 4.3 区域三：结果区

用途：展示 AI 流式输出的改写结果。

字段：

- `改写结果`

动作：

- `复制结果`
- `替换待改写区`
- `继续调整后再次生成`

交互要求：

- 流式过程中实时追加文本
- thinking 内容默认折叠展示
- 异常时保留已生成内容和错误提示

## 5. 前端状态设计

## 5.1 页面状态模型

首期建议使用页面级本地状态 + `localStorage` 持久化，不进入全局 `EditorContext`。

建议的数据结构：

```ts
interface AigcRewriteDraft {
  sampleBefore: string;
  sampleAfter: string;
  targetText: string;
  resultText: string;
  thinkingText: string;
  isGenerating: boolean;
  lastError: string | null;
  updatedAt: string;
}
```

说明：

- 不使用 `any`
- `resultText` 和 `thinkingText` 分离，便于 UI 控制
- `updatedAt` 用于后续做“最近保存于”提示

### 5.2 本地存储策略

建议使用工作区维度的存储 key：

```text
aicontext:aigc-rewrite:{workspaceSlug}
```

原因：

- 满足“保存在前端”的要求
- 刷新页面不丢失
- 不污染当前 `Project` 数据

首期不做：

- 服务端同步
- 多设备同步
- 样本版本管理

## 6. 提示词构造设计

## 6.1 构造原则

发送给 AI 的上下文分两部分：

- `system`：固定任务说明 + 用户样本对
- `user`：本次待改写文本

不把“待改写文本”拼进 `system`，而是放在 `user` 消息中，保持职责清晰。

## 6.2 System Prompt 模板

系统提示词使用固定模板，保留用户给出的 XML 风格结构，并将样本动态插入到示例位置。

推荐模板骨架如下：

```xml
<system>
  <target>
  你的目标是降低aigc率，所以需要模仿真实大学生的写法
  </target>

  <info>
  你会获得输入的文本，然后你将输出修改后的文本。
  </info>

  <instruct>
  下面是一组用户自己提供的改写样本，你需要学习这种改写方式。

  <example>
    <before>
    {{sampleBefore}}
    </before>

    <after>
    {{sampleAfter}}
    </after>
  </example>

  要求：
  1. 保持原文核心含义不变
  2. 尽量模仿样本中的表达习惯、句式变化和段落组织方式
  3. 不要解释你的思路
  4. 不要输出额外说明
  5. 直接输出改写后的正文
  </instruct>
</system>
```

说明：

- 用户提供的完整示例可以作为默认内置模板文案的一部分
- 运行时真正可变的部分只有 `sampleBefore` 和 `sampleAfter`
- 插值前需要做基础清洗，至少保证字符串存在且不为纯空白

## 6.3 User Message 模板

用户消息固定为：

```xml
<user>
{{targetText}}
</user>
```

这样可以让服务端复用当前 `messages` 结构，不需要为这个页面发明另一套协议。

## 7. 前后端职责划分

## 7.1 前端职责

- 采集并校验样本文本
- 将样本保存在浏览器本地
- 采集待改写文本
- 调用工作区业务接口开始流式生成
- 解析统一 SSE 事件并实时展示 `result` 与 `thinking`
- 提供复制、停止、重试等交互

前端不负责：

- 管理模型地址
- 管理 API Key
- 决定实际使用的供应商与模型
- 直接请求第三方模型供应商

## 7.2 后端职责

- 解析登录态、工作区和权限
- 校验请求体并执行长度与内容约束
- 解析平台级 AIGC 配置或工作区凭证映射
- 构造 `systemPrompt` 和标准 `messages`
- 强制启用 `stream` 与 `thinking`
- 复用共享 AI 生成模块发起模型请求
- 将上游供应商事件转换为统一 SSE 协议
- 记录 `requestId`、workspace、provider、耗时与错误码

结论：

- “降低 AIGC”是工作区页面，因此后端接口也必须落在工作区路由下
- 即使首期仍使用平台统一 `.env`，也不能绕开工作区鉴权、限流和日志归属

## 8. 接口架构设计

## 8.1 推荐接口

新增业务接口：

```text
POST /api/workspaces/:workspaceSlug/aigc-rewrite/generate
```

采用该路径，而不是 `/api/aigc-rewrite/generate`，原因如下：

- 与仓库既定“工作区资源显式入路径”规范保持一致
- 日志、限流、审计和权限判断都能天然带上工作区上下文
- 后续若引入工作区级凭证、配额或模板共享，无需再迁移接口

## 8.2 鉴权与权限要求

服务端固定执行以下校验步骤：

1. 从 Session 解析当前用户
2. 根据 `workspaceSlug` 解析当前工作区
3. 校验当前用户属于该工作区
4. 校验当前用户具备 `credential:use` 权限
5. 校验当前工作区未被归档或禁用
6. 再进入样本校验和模型调用

权限建议：

- `owner`、`admin`、`editor`：允许调用
- `viewer`：默认禁止调用，返回 `403 PERMISSION_DENIED`

## 8.3 请求规范

请求头：

- `Content-Type: application/json`
- `Accept: text/event-stream`
- `X-Request-Id: <uuid>` 可选，不传则服务端生成

请求体：

```ts
interface AigcRewriteGenerateRequest {
  sampleBefore: string;
  sampleAfter: string;
  targetText: string;
}
```

字段约束：

- `sampleBefore`：必填，去首尾空白后长度 `1-12000`
- `sampleAfter`：必填，去首尾空白后长度 `1-12000`
- `targetText`：必填，去首尾空白后长度 `1-20000`
- `sampleBefore !== sampleAfter`
- 禁止前端传入 `apiKey`、`baseUrl`、`model`、`thinkingBudget` 等底层模型字段
- 禁止接受未声明字段，避免前端绕过服务端策略

推荐校验模型：

```ts
interface AigcRewriteValidatedInput {
  sampleBefore: string;
  sampleAfter: string;
  targetText: string;
}
```

说明：

- 所有文本在进入 service 前完成 `trim`
- 校验错误统一返回 `422 AIGC_REWRITE_VALIDATION_FAILED`
- 不使用 `any`

## 8.4 成功响应规范

该接口是流式命令接口，成功响应类型固定为：

```text
Content-Type: text/event-stream
```

前端只依赖平台统一 SSE 事件，不直接解析第三方供应商原始协议。

推荐事件定义：

```text
event: meta
data: {"requestId":"req_123","workspaceSlug":"demo","model":"claude-sonnet-4","provider":"anthropic"}

event: delta
data: {"channel":"thinking","text":"..."}

event: delta
data: {"channel":"output","text":"..."}

event: done
data: {"stopReason":"end_turn","usage":{"inputTokens":123,"outputTokens":456}}
```

约束：

- `meta` 只发送一次
- `delta.channel` 仅允许 `thinking` 或 `output`
- `done` 表示正常结束，并附带最终 `usage`
- 若流式阶段失败，发送 `event: error`

流式错误事件示例：

```text
event: error
data: {"code":"AIGC_REWRITE_UPSTREAM_ERROR","message":"Model request failed","requestId":"req_123","retryable":true}
```

## 8.5 非流式失败响应规范

若错误发生在流开始之前，统一返回 JSON 错误包：

```json
{
  "error": {
    "code": "AIGC_REWRITE_VALIDATION_FAILED",
    "message": "Request body is invalid",
    "details": {
      "targetText": ["Target text is required"]
    },
    "requestId": "req_123"
  }
}
```

推荐错误码：

| HTTP Status | code | 场景 |
| --- | --- | --- |
| `401` | `UNAUTHENTICATED` | 未登录或 session 失效 |
| `403` | `WORKSPACE_FORBIDDEN` | 当前用户不属于该工作区 |
| `403` | `PERMISSION_DENIED` | 无 `credential:use` 权限 |
| `404` | `WORKSPACE_NOT_FOUND` | 工作区不存在 |
| `422` | `AIGC_REWRITE_VALIDATION_FAILED` | 样本或目标文本不合法 |
| `429` | `AIGC_REWRITE_RATE_LIMITED` | 触发频率或并发限制 |
| `500` | `AIGC_REWRITE_DISABLED` | 功能被关闭 |
| `500` | `AIGC_REWRITE_CONFIG_MISSING` | 缺少运行时配置 |
| `502` | `AIGC_REWRITE_UPSTREAM_ERROR` | 第三方模型调用失败 |

## 8.6 服务端处理流程

推荐流程：

1. `Route Handler` 解析 `workspaceSlug`、请求头和 JSON 请求体
2. `Validator` 完成字段裁剪、长度限制和结构校验
3. `Service` 解析当前工作区、成员关系与权限
4. `Service` 解析运行时配置、限流与超时参数
5. `Service` 组装 `systemPrompt` 与单轮 `messages`
6. `AI Adapter` 生成内部 `GenerateRequest`
7. `Provider Client` 调用模型供应商
8. `Stream Mapper` 将上游事件转换为统一 SSE 事件
9. `Route Handler` 将事件流回传前端

内部转换后的 `GenerateRequest` 应等价于：

```ts
const request: GenerateRequest = {
  baseUrl: runtime.baseUrl,
  apiKey: runtime.apiKey,
  model: runtime.model,
  systemPrompt,
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: targetText,
        },
      ],
    },
  ],
  stream: true,
  thinking: true,
  thinkingBudget: runtime.thinkingBudget,
};
```

### 8.7 “复用自动逻辑”的具体含义

本功能中“自动”应理解为：

- `temperature` 不传
- `topP` 不传
- `topK` 不传
- `maxTokens` 不传

这样可以继续复用共享生成模块中的默认推断逻辑，而不是在新页面重新发明一组参数面板。

也就是说：

- 必开：`stream = true`
- 必开：`thinking = true`
- 可配置但只允许服务端配置：`thinkingBudget`
- 其他高级参数默认留空，交给共享 AI 模块处理

## 9. 后端技术规范

### 9.1 技术选型结论

首期建议沿用当前单体 BFF 技术栈：

- 接口形态：`Next.js Route Handlers`
- 语言：`TypeScript`
- 请求校验：`zod`
- 鉴权与工作区解析：复用现有 `app/lib/auth/*`
- AI 供应商调用：抽取到共享 `app/lib/ai/*`
- 测试：`vitest`

原因：

- 该功能是现有工作区产品的一部分，不值得单独拆服务
- 它强依赖 Session、工作区、权限和统一错误结构
- 首期不落库，真正复杂度在鉴权、流式协议和可维护性，而不在数据层

### 9.2 推荐分层

建议最小目录结构如下：

```text
app/api/workspaces/[workspaceSlug]/aigc-rewrite/generate/route.ts
app/lib/aigc-rewrite/validators.ts
app/lib/aigc-rewrite/service.ts
app/lib/aigc-rewrite/prompt.ts
app/lib/ai/generate.ts
app/lib/ai/providers/anthropic.ts
app/lib/ai/stream-events.ts
```

职责约束：

- `route.ts`
  - 只负责认证入口、参数解析、调用 service、返回 HTTP/SSE
- `validators.ts`
  - 只负责请求校验和字段归一化
- `service.ts`
  - 负责权限、限流、运行时配置选择、提示词拼装、调用 AI 模块
- `prompt.ts`
  - 负责构造系统提示词模板，避免模板字符串散落在 route 中
- `app/lib/ai/*`
  - 负责供应商适配、请求构建、SSE 映射和超时控制

禁止：

- 在新接口里直接 `fetch('/api/generate')`
- 复制一份 `/api/generate` 代码
- 在 `Route Handler` 里直接写供应商协议拼装逻辑

### 9.3 供应商适配策略

首期技术策略：

- 先只支持一个 Anthropic 兼容供应商
- 对外暴露统一领域事件，不把 Anthropic SSE 事件直接暴露给页面
- 供应商差异封装在 `app/lib/ai/providers/*`

二期演进策略：

- 若后续接入 OpenAI 兼容或其他模型供应商，只新增 provider adapter
- `aigc-rewrite/service.ts` 不感知供应商字段差异
- 页面协议保持不变

### 9.4 并发、超时与限流

后端必须补充以下保护：

- 单请求超时控制，超时后终止上游连接
- 以 `workspaceId + userId` 为维度的频率限制
- 同一用户同一工作区的并发生成限制
- 上游断流后主动关闭本地流

推荐运行策略：

- 默认超时通过 env 配置，不硬编码在页面
- 限流命中返回 `429 AIGC_REWRITE_RATE_LIMITED`
- 用户主动中止时不记为服务端错误

## 10. 运行时配置与凭证策略

### 10.1 首期配置来源

首期继续采用平台统一配置，但配置只存在后端：

```text
AIGC_REWRITE_ENABLED=true
AIGC_REWRITE_PROVIDER=anthropic
AIGC_REWRITE_BASE_URL=
AIGC_REWRITE_API_KEY=
AIGC_REWRITE_MODEL=
AIGC_REWRITE_THINKING_BUDGET=10000
AIGC_REWRITE_REQUEST_TIMEOUT_MS=120000
```

说明：

- 前端页面不允许切模型
- 前端页面不允许覆盖 `thinkingBudget`
- 不读取 `Project.apiConfig`
- 不接受前端透传 `apiKey`

### 10.2 与工作区凭证架构的关系

该功能虽然首期读取平台级 `.env`，但架构上仍需与工作区凭证体系兼容。

明确约束：

- 当前 `.env` 只是“默认执行凭证来源”，不是长期数据模型
- 后续若 `credential_profiles` 落地，应优先支持“工作区绑定的系统凭证”
- 页面与前端协议不因为凭证来源切换而改变

推荐演进顺序：

1. `Phase 1`：平台统一 `.env`
2. `Phase 2`：支持工作区级 `credential_profile`
3. `Phase 3`：支持配额、调用统计和工作区级模型策略

### 10.3 不允许的配置来源

以下来源明确禁止：

- 前端表单传入的 `apiKey`
- `Project` 中的 `apiConfig.apiKey`
- 浏览器本地持久化的模型凭证
- URL query 中的任何供应商配置

## 11. 页面交互时序

```text
用户录入样本
  -> 前端校验
  -> 写入 localStorage

用户输入待改写文本并点击开始
  -> 前端 POST /api/workspaces/:workspaceSlug/aigc-rewrite/generate
  -> 服务端解析 session / workspace / permission
  -> 服务端读取 runtime config
  -> 服务端拼装 systemPrompt + user message
  -> 服务端调用共享 AI 模块
  -> Provider 返回原始流
  -> 服务端映射为统一 SSE 事件
  -> 前端实时更新 result/thinking
```

## 12. 异常、边界与可观测性

### 12.1 前端校验

- 样本前文本为空时禁止保存
- 样本后文本为空时禁止保存
- 样本前后完全相同时提示用户重新确认
- 待改写文本为空时禁止提交

### 12.2 服务端校验

- 缺少运行时配置时返回 `500 AIGC_REWRITE_CONFIG_MISSING`
- 功能被关闭时返回 `500 AIGC_REWRITE_DISABLED`
- 请求字段非法时返回 `422 AIGC_REWRITE_VALIDATION_FAILED`
- 第三方模型失败时返回 `502 AIGC_REWRITE_UPSTREAM_ERROR`
- 频率限制触发时返回 `429 AIGC_REWRITE_RATE_LIMITED`

### 12.3 流式中断

页面与服务端都应支持：

- 用户主动停止
- 网络中断后保留当前已生成片段
- 点击重试后重新发起完整请求
- 服务端在连接断开后及时取消上游请求

### 12.4 日志与指标

服务端至少记录以下结构化字段：

- `request_id`
- `user_id`
- `workspace_id`
- `workspace_slug`
- `route`
- `provider`
- `model`
- `status_code`
- `latency_ms`
- `input_chars`
- `output_chars`

禁止日志内容：

- 完整 `sampleBefore`
- 完整 `sampleAfter`
- 完整 `targetText`
- 完整模型返回文本
- 明文 `apiKey`

## 13. 安全与合规

- 前端永远不返回 API Key
- 流式错误信息禁止暴露上游供应商的原始堆栈
- 供应商请求失败时只返回可观测的稳定错误码
- 如需后续埋点，应优先记录长度、计数、耗时等元信息

## 14. 首期范围与后续演进

### 14.1 首期必须实现

- 独立页面
- 单组样本录入
- 前端本地保存
- 工作区显式路由
- 统一 SSE 协议
- 流式改写
- thinking 展示
- 后端平台级配置
- 复用共享 AI 生成链路

### 14.2 首期不做

- 多样本库
- 样本服务端落库
- 样本分享
- 批量改写
- 与 `Project` 历史版本联动
- 用户自定义模型面板

### 14.3 二期可扩展方向

- 多组样本切换
- 样本模板导入导出
- 改写结果 diff 对比
- 与项目正文编辑器联动
- 样本按工作区共享
- 接入工作区级 `credential_profile`

## 15. 最终设计结论

“降低 AIGC”功能应落为工作区下的独立页面，通过“样本标定区 + 待改写区 + 结果区”完成闭环。后端接口必须采用 `/api/workspaces/:workspaceSlug/aigc-rewrite/generate`，统一承担鉴权、权限、运行时配置、提示词拼装、SSE 映射和可观测性职责。首期允许继续使用后端 `.env` 作为平台统一执行凭证，但这一选择不能破坏多工作区架构边界；后续凭证来源可以演进到 `credential_profiles`，而页面协议和 API 契约保持稳定。这样既满足当前需求，也能控制实现复杂度，并保持仓库的可维护性。
