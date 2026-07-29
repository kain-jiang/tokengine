# Chat Completions API 接口文档

## 接口信息

- **URL**: `POST /v1/chat/completions`
- **协议**: OpenAI 兼容格式
- **认证**: `Authorization: Bearer <your_api_key>`
- **Content-Type**: `application/json`

## 请求参数

### 核心参数（必填）

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `model` | string | 是 | 模型名，如 `gpt-4o`、`claude-3-5-sonnet`、`gemini-2.5-flash` 等 |
| `messages` | array | 是 | 对话消息数组，见下方 `Message` 结构 |

### `messages` 数组元素结构

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `role` | string | 是 | 角色：`system`、`user`、`assistant`、`tool` |
| `content` | string / array | 是 | 消息内容，纯文本为 string，多模态为 array |
| `name` | string | 否 | 参与者名称 |
| `tool_calls` | array | 否 | assistant 消息的工具调用 |
| `tool_call_id` | string | 否 | tool 角色消息对应的工具调用 ID |

### `content` 多模态数组元素结构

| 参数 | 类型 | 说明 |
|---|---|---|
| `type` | string | 内容类型：`text`、`image_url`、`input_audio`、`file`、`video_url` |
| `text` | string | 文本内容（`type=text` 时） |
| `image_url` | object | 图片 URL 对象（`type=image_url` 时） |
| `input_audio` | object | 音频对象（`type=input_audio` 时） |

### 采样控制参数（可选）

| 参数 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `temperature` | float | 模型默认 | 温度参数，控制随机性，范围 0-2 |
| `top_p` | float | 模型默认 | 核采样参数，范围 0-1 |
| `top_k` | int | - | Top-K 采样，限制候选 token 数量 |
| `frequency_penalty` | float | `0` | 频率惩罚，范围 -2 到 2 |
| `presence_penalty` | float | `0` | 存在惩罚，范围 -2 到 2 |
| `seed` | float | - | 随机种子，用于可复现输出 |
| `stop` | string / array | - | 停止词，遇到时停止生成 |
| `n` | int | `1` | 生成回复数量 |

### Token 控制参数（可选）

| 参数 | 类型 | 说明 |
|---|---|---|
| `max_tokens` | uint | 最大生成 token 数（旧版参数） |
| `max_completion_tokens` | uint | 最大生成 token 数（新版参数，推荐使用） |
| `reasoning_effort` | string | 推理强度：`low`、`medium`、`high`（适用于推理模型） |

### 流式参数（可选）

| 参数 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `stream` | bool | `false` | 是否流式输出 |
| `stream_options` | object | - | 流式选项 |

#### `stream_options` 结构

| 参数 | 类型 | 说明 |
|---|---|---|
| `include_usage` | bool | 是否在流式响应的最后一个 chunk 中返回 usage 信息 |

### 工具调用参数（可选）

| 参数 | 类型 | 说明 |
|---|---|---|
| `tools` | array | 工具/函数定义列表 |
| `tool_choice` | string / object | 工具选择策略：`none`、`auto`、`required` 或指定工具 |
| `parallel_tool_calls` | bool | 是否允许并行工具调用 |

#### `tools` 数组元素结构

| 参数 | 类型 | 说明 |
|---|---|---|
| `type` | string | 工具类型，通常为 `function` |
| `function` | object | 函数定义 |
| `function.name` | string | 函数名 |
| `function.description` | string | 函数描述 |
| `function.parameters` | object | 函数参数 JSON Schema |

### 输出格式参数（可选）

| 参数 | 类型 | 说明 |
|---|---|---|
| `response_format` | object | 强制输出格式 |
| `logprobs` | bool | 是否返回对数概率 |
| `top_logprobs` | int | 每个位置返回的 top N 概率（需 `logprobs=true`） |

#### `response_format` 结构

| 参数 | 类型 | 说明 |
|---|---|---|
| `type` | string | `text`、`json_schema`、`json_object` |
| `json_schema` | object | JSON Schema 定义（`type=json_schema` 时） |

### 其他参数（可选）

| 参数 | 类型 | 说明 |
|---|---|---|
| `user` | string | 用户标识，用于日志和计费 |
| `service_tier` | string | 服务等级（可能影响计费） |
| `store` | bool | 是否存储请求供模型蒸馏/评估 |
| `prompt_cache_key` | string | 缓存键，优化缓存命中率 |
| `logit_bias` | object | token ID 到偏置值的映射 |
| `metadata` | object | 请求元数据 |
| `prediction` | object | 预测内容（可预测输出优化） |
| `modalities` | array | 输出模态：`text`、`audio` |
| `audio` | object | 音频输出配置 |
| `dimensions` | int | 嵌入维度 |

## 请求示例

### 最简请求

```bash
curl -X POST https://your-domain/v1/chat/completions \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "你好"}
    ]
  }'
```

### 带系统提示词

```bash
curl -X POST https://your-domain/v1/chat/completions \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "system", "content": "你是一个专业的翻译助手"},
      {"role": "user", "content": "翻译以下内容为英文：你好世界"}
    ],
    "temperature": 0.3
  }'
```

### 流式请求

```bash
curl -X POST https://your-domain/v1/chat/completions \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "写一首关于春天的诗"}
    ],
    "stream": true,
    "stream_options": {"include_usage": true}
  }'
```

### 多模态请求（图片）

```bash
curl -X POST https://your-domain/v1/chat/completions \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {
        "role": "user",
        "content": [
          {"type": "text", "text": "描述这张图片"},
          {"type": "image_url", "image_url": {"url": "https://example.com/image.jpg"}}
        ]
      }
    ]
  }'
```

### JSON 格式输出

```bash
curl -X POST https://your-domain/v1/chat/completions \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "列出三种水果及其颜色，以JSON格式输出"}
    ],
    "response_format": {"type": "json_object"}
  }'
```

### 工具调用请求

```bash
curl -X POST https://your-domain/v1/chat/completions \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "北京今天天气怎么样？"}
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "get_weather",
          "description": "获取指定城市的天气",
          "parameters": {
            "type": "object",
            "properties": {
              "city": {"type": "string", "description": "城市名"}
            },
            "required": ["city"]
          }
        }
      }
    ],
    "tool_choice": "auto"
  }'
```

## 成功响应

### 非流式响应

#### HTTP 状态码

`200 OK`

#### 响应结构

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1722232800,
  "model": "gpt-4o",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "你好！有什么可以帮助你的吗？"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 15,
    "total_tokens": 25
  }
}
```

#### 响应字段说明

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 唯一响应 ID |
| `object` | string | 对象类型，固定为 `chat.completion` |
| `created` | int | Unix 时间戳 |
| `model` | string | 实际使用的模型名 |
| `choices` | array | 回复选项数组 |
| `choices[].index` | int | 选项索引 |
| `choices[].message.role` | string | 角色，通常为 `assistant` |
| `choices[].message.content` | string | 回复内容 |
| `choices[].message.tool_calls` | array | 工具调用（如有） |
| `choices[].finish_reason` | string | 结束原因：`stop`、`length`、`tool_calls`、`content_filter` |
| `usage` | object | Token 消耗信息 |
| `usage.prompt_tokens` | int | 输入 token 数 |
| `usage.completion_tokens` | int | 输出 token 数 |
| `usage.total_tokens` | int | 总 token 数 |

#### `finish_reason` 值说明

| 值 | 说明 |
|---|---|
| `stop` | 正常结束或遇到停止词 |
| `length` | 达到最大 token 数限制 |
| `tool_calls` | 模型决定调用工具 |
| `content_filter` | 内容被过滤 |

### 流式响应

#### HTTP 状态码

`200 OK`

#### 响应格式

`Content-Type: text/event-stream`

每个 chunk 以 `data: ` 前缀输出，最后以 `data: [DONE]` 结束。

#### 流式 chunk 结构

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion.chunk",
  "created": 1722232800,
  "model": "gpt-4o",
  "choices": [
    {
      "index": 0,
      "delta": {
        "content": "你"
      },
      "finish_reason": null
    }
  ]
}
```

#### 流式完整示例

```
data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1722232800,"model":"gpt-4o","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1722232800,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"你"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1722232800,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"好"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1722232800,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"！"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1722232800,"model":"gpt-4o","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1722232800,"model":"gpt-4o","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":3,"total_tokens":13}}

data: [DONE]
```

#### 流式 chunk 字段说明

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 唯一响应 ID（同一请求的所有 chunk 相同） |
| `object` | string | 固定为 `chat.completion.chunk` |
| `created` | int | Unix 时间戳 |
| `model` | string | 实际使用的模型名 |
| `choices[].index` | int | 选项索引 |
| `choices[].delta.content` | string | 增量内容 |
| `choices[].delta.role` | string | 角色（仅第一个 chunk 包含） |
| `choices[].delta.tool_calls` | array | 增量工具调用 |
| `choices[].finish_reason` | string / null | 结束原因，最后一个 chunk 为 `stop` 等，其余为 `null` |
| `usage` | object / null | Token 消耗（仅 `stream_options.include_usage=true` 时在最后一个 chunk 返回） |

### 工具调用响应示例

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1722232800,
  "model": "gpt-4o",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": null,
        "tool_calls": [
          {
            "id": "call_abc123",
            "type": "function",
            "function": {
              "name": "get_weather",
              "arguments": "{\"city\":\"北京\"}"
            }
          }
        ]
      },
      "finish_reason": "tool_calls"
    }
  ],
  "usage": {
    "prompt_tokens": 50,
    "completion_tokens": 20,
    "total_tokens": 70
  }
}
```

## 失败响应

### HTTP 状态码

`400`, `401`, `403`, `404`, `429`, `500`, `502`, `503` 等

### 错误响应结构

```json
{
  "error": {
    "message": "错误描述信息",
    "type": "error_type",
    "param": "",
    "code": "error_code"
  }
}
```

### 错误字段说明

| 字段 | 类型 | 说明 |
|---|---|---|
| `error` | object | 错误对象 |
| `error.message` | string | 错误详细信息 |
| `error.type` | string | 错误类型 |
| `error.param` | string | 相关参数（通常为空） |
| `error.code` | string | 错误码 |

### 常见错误类型

| type | code | HTTP 状态码 | 说明 |
|---|---|---|---|
| `new_api_error` | `invalid_request` | 400 | 请求参数无效 |
| `new_api_error` | `invalid_token` | 401 | 认证失败，令牌无效 |
| `new_api_error` | `channel_disabled` | 403 | 渠道已禁用 |
| `new_api_error` | `quota_not_enough` | 403 | 余额不足 |
| `new_api_error` | `model_not_found` | 404 | 模型不存在 |
| `new_api_error` | `rate_limit_exceeded` | 429 | 请求频率超限 |
| `upstream_error` | `bad_response_status_code` | 400/500 | 上游 API 返回错误 |

### 错误响应示例

**参数缺失错误：**

```json
{
  "error": {
    "message": "model is required",
    "type": "new_api_error",
    "param": "",
    "code": "invalid_request"
  }
}
```

**认证失败错误：**

```json
{
  "error": {
    "message": "无效的令牌",
    "type": "new_api_error",
    "param": "",
    "code": "invalid_token"
  }
}
```

**余额不足错误：**

```json
{
  "error": {
    "message": "余额不足，请充值后再试",
    "type": "new_api_error",
    "param": "",
    "code": "quota_not_enough"
  }
}
```

**模型不存在错误：**

```json
{
  "error": {
    "message": "模型 not-a-real-model 不存在",
    "type": "new_api_error",
    "param": "",
    "code": "model_not_found"
  }
}
```

**上游 API 错误：**

```json
{
  "error": {
    "message": "Rate limit exceeded for model gpt-4o",
    "type": "upstream_error",
    "param": "",
    "code": "bad_response_status_code"
  }
}
```

**频率限制错误：**

```json
{
  "error": {
    "message": "请求过于频繁，请稍后再试",
    "type": "new_api_error",
    "param": "",
    "code": "rate_limit_exceeded"
  }
}
```

## 补充说明

1. **兼容性**: 本接口完全兼容 OpenAI Chat Completions API，可直接使用 OpenAI SDK 调用
2. **多模态**: 支持 `text`、`image_url`、`input_audio` 等多模态输入，具体支持取决于所选模型
3. **工具调用**: 支持 OpenAI Function Calling 格式，模型返回 `tool_calls` 后需再次请求传入工具结果
4. **流式输出**: 设置 `stream: true` 时返回 SSE 格式，每个 chunk 以 `data: ` 前缀输出
5. **Token 计费**: 响应中的 `usage` 字段包含实际 token 消耗，用于计费
6. **推理模型**: 部分模型支持 `reasoning_effort` 参数控制推理深度，响应中可能包含 `reasoning_content` 字段
