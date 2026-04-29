# AIGC Detection API 文档

## 1. 概述

这份文档描述当前仓库已经实现的论文 AIGC 检测 API 服务。

服务职责：

1. 接收论文文件上传并创建异步检测任务
2. 提供任务状态查询接口
3. 提供任务结果查询接口
4. 提供已处理文件列表与按文件 `sha256` 查结果接口
5. 通过 Rust API 调用内部 Python 推理服务完成块级与句子级检测

当前对外 API 基础路径：

`/api/v1/aigc-detection`

辅助接口：

1. 健康检查：`GET /healthz`
2. OpenAPI JSON：`GET /openapi.json`
3. Swagger UI：`GET /swagger-ui`

OpenAPI 文件已生成到：

[`docs/openapi/aigc-detection.openapi.json`](/var/tmp/vibe-kanban/worktrees/0f33-aigc-api/aigc/docs/openapi/aigc-detection.openapi.json)

## 2. 运行方式

### 2.1 启动内部 Python 推理服务

需要先准备模型环境变量，例如：

```bash
export QWEN35_MODEL_ID=/path/to/qwen-model
export QWEN35_DEVICE_MAP=auto
export QWEN35_TORCH_DTYPE=auto
```

启动命令：

```bash
uv run ai-text-detector-internal-api
```

默认监听：

`127.0.0.1:8001`

可选环境变量：

1. `AIGC_INTERNAL_API_HOST`，默认 `127.0.0.1`
2. `AIGC_INTERNAL_API_PORT`，默认 `8001`

### 2.2 启动 Rust API 服务

```bash
just serve-api
```

默认监听：

`0.0.0.0:3000`

主要环境变量：

1. `AIGC_BIND_ADDR`，默认 `0.0.0.0:3000`
2. `AIGC_WORKDIR`，默认 `workdir`
3. `AIGC_DETECTOR_BASE_URL`，默认 `http://127.0.0.1:8001`
4. `AIGC_DETECTOR_PROBABILITY_MODE`，默认 `trained`
5. `AIGC_DETECTOR_BATCH_SIZE`，默认 `16`
6. `AIGC_MAX_UPLOAD_BYTES`，默认 `52428800`

## 3. 通用约定

### 3.1 请求头

当前实现支持或返回以下请求头：

1. `X-Request-Id`：可选；若未传，服务端会生成并在响应头返回
2. `Idempotency-Key`：建议用于创建任务接口，避免重复提交

说明：

1. 当前代码未实现 `Authorization` 校验
2. 若同一个 `Idempotency-Key` 对应不同文件内容，服务端返回 `409`

### 3.2 内容类型

1. 创建任务：`multipart/form-data`
2. 其他业务接口：`application/json`

### 3.3 支持文件类型

当前支持：

1. `pdf`
2. `doc`
3. `docx`
4. `md`

### 3.4 任务状态

任务状态枚举：

1. `queued`
2. `preprocessing`
3. `detecting`
4. `aggregating`
5. `succeeded`
6. `failed`
7. `canceled`

当前实现中实际会进入的主要状态：

1. `queued`
2. `preprocessing`
3. `detecting`
4. `aggregating`
5. `succeeded`
6. `failed`

`canceled` 状态已预留，但当前没有取消接口。

### 3.5 错误响应格式

所有错误统一返回：

```json
{
  "error": {
    "code": "TASK_NOT_FOUND",
    "message": "task `task_01...` does not exist",
    "request_id": "req_01..."
  }
}
```

常见错误码：

1. `FILE_REQUIRED`
2. `INVALID_MULTIPART`
3. `INVALID_UPLOAD`
4. `INVALID_METADATA`
5. `INVALID_FORCE_REPROCESS`
6. `UNSUPPORTED_MEDIA_TYPE`
7. `PAYLOAD_TOO_LARGE`
8. `IDEMPOTENCY_CONFLICT`
9. `TASK_NOT_FOUND`
10. `TASK_NOT_FINISHED`
11. `RESULT_NOT_FOUND`
12. `RESULT_NOT_INDEXED`
13. `INTERNAL_ERROR`

## 4. API 列表

### 4.1 健康检查

`GET /healthz`

响应：

```text
ok
```

### 4.2 获取 OpenAPI

`GET /openapi.json`

返回 OpenAPI 3.1 JSON。

### 4.3 创建检测任务

`POST /api/v1/aigc-detection/tasks`

请求类型：

`multipart/form-data`

表单字段：

1. `file`：必填，待检测文件
2. `callback_url`：可选，字符串
3. `metadata`：可选，JSON 字符串
4. `force_reprocess`：可选，`true` 或 `false`

行为说明：

1. 如果未提供 `file`，返回 `400`
2. 如果文件类型不支持，返回 `415`
3. 如果文件超出大小限制，返回 `413`
4. 如果 `force_reprocess=false` 且命中相同 `sha256` 的历史结果，服务端会直接创建一个已完成任务，并返回 `deduplicated=true`
5. 如果携带 `Idempotency-Key` 且文件内容相同，服务端会返回同一任务语义结果

成功响应：

状态码：`202 Accepted`

```json
{
  "task_id": "task_01jv7w2n4r7n5n4g0v5q3q9k4p",
  "status": "queued",
  "deduplicated": false,
  "status_url": "/api/v1/aigc-detection/tasks/task_01jv7w2n4r7n5n4g0v5q3q9k4p",
  "result_url": "/api/v1/aigc-detection/tasks/task_01jv7w2n4r7n5n4g0v5q3q9k4p/result"
}
```

`curl` 示例：

```bash
curl -X POST "http://127.0.0.1:3000/api/v1/aigc-detection/tasks" \
  -H "X-Request-Id: req-demo-001" \
  -H "Idempotency-Key: idem-demo-001" \
  -F "file=@./paper.pdf" \
  -F 'metadata={"biz_id":"paper-001","scene":"review"}' \
  -F "force_reprocess=false"
```

### 4.4 查询任务状态

`GET /api/v1/aigc-detection/tasks/{task_id}`

成功响应：

状态码：`200 OK`

```json
{
  "task_id": "task_01jv7w2n4r7n5n4g0v5q3q9k4p",
  "status": "detecting",
  "stage": "detecting",
  "progress": {
    "current": 12,
    "total": 48,
    "unit": "blocks"
  },
  "source_file_name": "paper.pdf",
  "created_at": "2026-04-29T12:00:00Z",
  "updated_at": "2026-04-29T12:00:08Z",
  "error": null
}
```

失败情况：

1. 任务不存在：`404 TASK_NOT_FOUND`

`curl` 示例：

```bash
curl "http://127.0.0.1:3000/api/v1/aigc-detection/tasks/task_01jv7w2n4r7n5n4g0v5q3q9k4p"
```

### 4.5 查询任务结果

`GET /api/v1/aigc-detection/tasks/{task_id}/result`

行为说明：

1. 当任务未完成时返回 `409 TASK_NOT_FINISHED`
2. 当任务成功时返回完整结构化结果

成功响应：

状态码：`200 OK`

```json
{
  "task_id": "task_01jv7w2n4r7n5n4g0v5q3q9k4p",
  "status": "succeeded",
  "document_result": {
    "document_ai_probability": 0.74,
    "label": "ai_likely",
    "probability_method": "trained",
    "block_count": 120,
    "scored_block_count": 118,
    "skipped_block_count": 2,
    "total_char_count": 18234,
    "total_token_count": 11520
  },
  "cleaned_document": {
    "cleaned_full_text": "第一段内容。\n\n第二段内容。",
    "cleaned_blocks": [
      {
        "block_id": "b00001",
        "order": 1,
        "text": "第一段内容。"
      }
    ]
  },
  "ai_sentences": [
    {
      "sentence_id": "s00031",
      "block_id": "b00008",
      "order": 31,
      "text": "该方法显著提高了模型的泛化能力并在多个数据集上取得最优结果。",
      "ai_probability": 0.88,
      "label": "ai_likely",
      "probability_method": "trained"
    }
  ],
  "blocks": [
    {
      "block_id": "b00001",
      "order": 1,
      "page_start": 0,
      "page_end": 0,
      "block_type": "text",
      "section_path": [],
      "text": "论文标题",
      "char_count": 8,
      "token_count": 5,
      "ai_probability": 0.13,
      "label": "human_likely",
      "probability_method": "trained"
    }
  ]
}
```

字段说明：

1. `document_result`：全文聚合结果
2. `cleaned_document.cleaned_full_text`：清洗后的全文文本
3. `cleaned_document.cleaned_blocks`：清洗后的块数组
4. `ai_sentences`：经句子级复判后命中的 AI 句子
5. `blocks`：块级检测结果

`curl` 示例：

```bash
curl "http://127.0.0.1:3000/api/v1/aigc-detection/tasks/task_01jv7w2n4r7n5n4g0v5q3q9k4p/result"
```

### 4.6 列出已处理文件

`GET /api/v1/aigc-detection/files`

查询参数：

1. `page`：默认 `1`
2. `page_size`：默认 `20`，最大 `100`
3. `status`：可选
4. `file_name`：可选，按文件名包含匹配
5. `created_from`：可选，UTC 时间
6. `created_to`：可选，UTC 时间

成功响应：

状态码：`200 OK`

```json
{
  "items": [
    {
      "sha256": "2e7d2c03a9507ae265ecf5b5356885a5...",
      "original_file_name": "paper-a.pdf",
      "size": 3482912,
      "latest_task_id": "task_01jv7w2n4r7n5n4g0v5q3q9k4p",
      "status": "succeeded",
      "finished_at": "2026-04-29T12:04:32Z"
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 20
}
```

`curl` 示例：

```bash
curl "http://127.0.0.1:3000/api/v1/aigc-detection/files?page=1&page_size=20&status=succeeded"
```

### 4.7 按文件 `sha256` 查询结果

`GET /api/v1/aigc-detection/files/{sha256}/result`

行为说明：

1. 如果该文件已建立成功结果索引，直接返回结果
2. 如果未索引，返回 `404 RESULT_NOT_INDEXED`

成功响应体与“查询任务结果”完全一致。

`curl` 示例：

```bash
curl "http://127.0.0.1:3000/api/v1/aigc-detection/files/2e7d2c03a9507ae265ecf5b5356885a5/result"
```

## 5. 结果模型说明

### 5.1 全文结果 `document_result`

字段：

1. `document_ai_probability`：全文 AIGC 概率
2. `label`：`ai_likely` 或 `human_likely`
3. `probability_method`：当前默认 `trained`
4. `block_count`：总块数
5. `scored_block_count`：成功评分块数
6. `skipped_block_count`：未评分块数
7. `total_char_count`：全文字符数
8. `total_token_count`：全文 token 数

聚合方式：

当前实现按 `token_count` 加权块级概率得到全文概率。

### 5.2 块结果 `blocks`

字段：

1. `block_id`：块 ID
2. `order`：块顺序
3. `page_start` / `page_end`：当前实现固定为 `0`
4. `block_type`：当前实现固定为 `text`
5. `section_path`：当前实现为空数组
6. `text`：块文本
7. `char_count`：字符数
8. `token_count`：token 数
9. `ai_probability`：块级 AIGC 概率
10. `label`：块标签
11. `probability_method`：概率来源

说明：

当前块来源于 `pdf_to_json` 产出的段落数组，尚未接入更精细的版面结构。

### 5.3 AI 句子 `ai_sentences`

字段：

1. `sentence_id`
2. `block_id`
3. `order`
4. `text`
5. `ai_probability`
6. `label`
7. `probability_method`

说明：

1. 句子由服务端基于标点进行切分
2. 只返回判定为 `ai_likely` 的句子

## 6. 当前实现限制

这部分很重要，避免文档和代码行为不一致。

当前已实现：

1. 任务创建与异步处理
2. 本地文件系统持久化
3. `sha256` 结果复用
4. `Idempotency-Key` 幂等控制
5. OpenAPI JSON 与 Swagger UI

当前未实现或仅预留：

1. 鉴权与权限控制
2. 任务取消接口
3. `callback_url` 实际回调投递
4. 更细粒度的分页排序能力
5. UDS 形式的 Python 通信
6. 真实页码、版面块类型、章节路径抽取

## 7. 推荐接入流程

1. 调用 `POST /api/v1/aigc-detection/tasks` 创建任务
2. 轮询 `GET /api/v1/aigc-detection/tasks/{task_id}` 直到状态为 `succeeded` 或 `failed`
3. 成功后调用 `GET /api/v1/aigc-detection/tasks/{task_id}/result` 读取完整结果
4. 对重复文件，可直接使用 `GET /api/v1/aigc-detection/files/{sha256}/result`

## 8. 相关文件

1. API 路由实现：[`src/api.rs`](/var/tmp/vibe-kanban/worktrees/0f33-aigc-api/aigc/src/api.rs)
2. 服务编排实现：[`src/service.rs`](/var/tmp/vibe-kanban/worktrees/0f33-aigc-api/aigc/src/service.rs)
3. 数据模型：[`src/models.rs`](/var/tmp/vibe-kanban/worktrees/0f33-aigc-api/aigc/src/models.rs)
4. OpenAPI 导出：[`src/openapi.rs`](/var/tmp/vibe-kanban/worktrees/0f33-aigc-api/aigc/src/openapi.rs)
5. OpenAPI JSON：[`docs/openapi/aigc-detection.openapi.json`](/var/tmp/vibe-kanban/worktrees/0f33-aigc-api/aigc/docs/openapi/aigc-detection.openapi.json)
