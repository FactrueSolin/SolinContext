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
- 调用业务接口开始流式生成
- 实时展示结果与 thinking
- 提供复制、停止、重试等交互

前端不负责：

- 管理模型地址
- 管理 API Key
- 直接请求第三方模型供应商

## 7.2 后端职责

- 从 `.env` 读取模型配置
- 校验请求体
- 构造 `systemPrompt` 和 `messages`
- 强制启用 `stream` 和 `thinking`
- 复用现有生成逻辑发起模型请求
- 将流式结果透传给前端

## 8. 接口架构设计

## 8.1 推荐接口

新增业务接口：

```text
POST /api/aigc-rewrite/generate
```

请求体建议为：

```ts
interface AigcRewriteGenerateRequest {
  sampleBefore: string;
  sampleAfter: string;
  targetText: string;
}
```

说明：

- 请求体只保留业务字段
- 不允许前端传 `apiKey`
- 不允许前端传 `baseUrl`
- 不允许前端传 `model`

## 8.2 服务端处理流程

推荐流程：

1. 校验 `sampleBefore`、`sampleAfter`、`targetText`
2. 从 env 读取模型配置
3. 组装 `systemPrompt`
4. 构造单轮 `messages`
5. 生成内部 `GenerateRequest`
6. 调用现有生成能力并返回 SSE

内部转换后的 `GenerateRequest` 应等价于：

```ts
const request: GenerateRequest = {
  baseUrl: env.baseUrl,
  apiKey: env.apiKey,
  model: env.model,
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
  thinkingBudget: env.thinkingBudget,
};
```

### 8.3 “复用前端自动逻辑”的具体含义

本功能中“自动”应理解为：

- `temperature` 不传
- `topP` 不传
- `topK` 不传
- `maxTokens` 不传

这样可以继续复用现有 `/api/generate` 中的默认推断逻辑，而不是在新页面重新发明一组参数面板。

也就是说：

- 必开：`stream = true`
- 必开：`thinking = true`
- 可配置但建议走 env：`thinkingBudget`
- 其他高级参数默认留空，交给现有逻辑处理

## 8.4 复用实现建议

当前 `app/api/generate/route.ts` 已经包含：

- `buildAnthropicRequestBody`
- 流式处理逻辑
- 非流式处理逻辑

为保证可维护性，建议把这些能力抽到共享服务模块，例如：

```text
app/lib/ai/generate.ts
```

然后：

- `/api/generate` 继续服务现有编辑器
- `/api/aigc-rewrite/generate` 负责业务适配后调用共享模块

不建议：

- 在新接口里直接 `fetch('/api/generate')`
- 复制一份 `/api/generate` 代码

原因是这两种方式都会加重后续维护成本。

## 9. 后端环境变量设计

建议新增以下 env：

```text
AIGC_REWRITE_BASE_URL=
AIGC_REWRITE_API_KEY=
AIGC_REWRITE_MODEL=
AIGC_REWRITE_THINKING_BUDGET=10000
```

说明：

- 这些变量与主编辑器里的用户自定义 API 配置隔离
- 页面始终使用平台统一配置
- 首期不允许用户切模型

可选扩展：

```text
AIGC_REWRITE_ENABLED=true
```

用于在不同部署环境下快速开关该功能。

## 10. 页面交互时序

```text
用户录入样本
  -> 前端校验
  -> 写入 localStorage

用户输入待改写文本并点击开始
  -> 前端 POST /api/aigc-rewrite/generate
  -> 服务端读取 env
  -> 服务端拼装 systemPrompt + user message
  -> 服务端调用共享生成模块
  -> 第三方模型流式返回
  -> 服务端透传 SSE
  -> 前端实时更新 result/thinking
```

## 11. 异常与边界处理

### 11.1 前端校验

- 样本前文本为空时禁止保存
- 样本后文本为空时禁止保存
- 样本前后完全相同时提示用户重新确认
- 待改写文本为空时禁止提交

### 11.2 服务端校验

- 缺少 env 时返回 `500`，错误码建议为 `AIGC_REWRITE_CONFIG_MISSING`
- 请求字段非法时返回 `422`
- 第三方模型失败时返回 `502`

### 11.3 流式中断

页面应支持：

- 用户主动停止
- 网络中断后保留当前已生成片段
- 点击重试后重新发起完整请求

## 12. 安全与合规

- 前端永远不返回 API Key
- 服务端日志禁止打印完整样本文本和完整模型响应
- 若需要埋点，只记录长度、状态码、耗时等元信息

## 13. 首期范围与后续演进

## 13.1 首期必须实现

- 独立页面
- 单组样本录入
- 前端本地保存
- 流式改写
- thinking 展示
- 后端 env 配置
- 复用现有生成链路

## 13.2 首期不做

- 多样本库
- 样本服务端落库
- 样本分享
- 批量改写
- 与 `Project` 历史版本联动

## 13.3 二期可扩展方向

- 多组样本切换
- 样本模板导入导出
- 改写结果 diff 对比
- 与项目正文编辑器联动
- 样本按工作区共享

## 14. 最终设计结论

“降低 AIGC”功能应落为工作区下的独立页面，通过“样本标定区 + 待改写区 + 结果区”完成完整闭环。样本数据首期保存在前端 `localStorage`，不进入主项目模型。AI 凭证和模型配置统一放在后端 `.env`，新页面新增一个业务接口负责拼装提示词，再复用现有 `/api/generate` 的流式与 thinking 能力。这样既满足当前需求，也能控制实现复杂度，并保持仓库的可维护性。
