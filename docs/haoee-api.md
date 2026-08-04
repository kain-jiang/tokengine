# 好易智算 (Haoee) API 接口文档

## 渠道信息

- **渠道类型**: `ChannelTypeHaoee = 61`
- **BaseURL**: `https://maas.haoee.com`
- **认证**: `Authorization: Bearer <your_api_key>`
- **协议**: OpenAI 兼容格式（Gemini 图像模型除外，使用 Gemini 原生格式）

## 支持的 API 类型

好易智算渠道支持三类 API，对应不同模型分组：

| API 类型 | 端点 | 模型分组 | 响应格式 |
|---|---|---|---|
| 文本对话 | `POST /v1/chat/completions` | gpt-5.x / gemini-3.x-flash / gemini-3.x-pro | OpenAI Chat Completion |
| Gemini 图像生成 | `POST /v1beta/models/<model>:generateContent` | gemini-*-image-* | base64 / data URI |
| gpt-image-2 系列图像生成 | `POST /v1/images/generations` | gpt-image-2 / gpt-image-2-1k2k / gpt-image-2-2k / gpt-image-2-4k | 真实 URL（对象存储） |

> **路由说明**: Gemini 图像模型由 adaptor 自动改写为 `/v1beta/models/<model>:generateContent` 原生接口；其余模型直接透传到 `/v1/...` OpenAI 兼容路径。

---

## 1. 文本对话 API

### 接口信息

- **URL**: `POST /v1/chat/completions`
- **协议**: OpenAI Chat Completion 兼容格式

### 支持的模型

文本对话模型分为两组，响应结构略有差异：

| 模型名 | 说明 | 分组 |
|---|---|---|
| `gpt-5.5` | GPT 5.5 对话模型 | GPT 系列 |
| `gpt-5.6-luna` | GPT 5.6 Luna | GPT 系列 |
| `gpt-5.6-sol` | GPT 5.6 Sol | GPT 系列 |
| `gpt-5.6-terra` | GPT 5.6 Terra | GPT 系列 |
| `gemini-3-flash-preview` | Gemini 3 Flash 预览 | Gemini 系列 |
| `gemini-3.1-pro-preview` | Gemini 3.1 Pro 预览 | Gemini 系列 |
| `gemini-3.5-flash` | Gemini 3.5 Flash | Gemini 系列 |

### 请求示例

```bash
curl -X POST https://your-domain/v1/chat/completions \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-5.6-luna",
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

### 成功响应示例（GPT 系列）

GPT 系列模型返回标准 OpenAI Chat Completion 格式，`usage` 结构简洁：

```json
{
  "id": "resp_02fae7f2202f30fe016a717f5eb5f4819ba1f4c2b7dd9bac59",
  "object": "chat.completion",
  "created": 1785823071,
  "model": "gpt-5.6-luna",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "你好！有什么我可以帮你的吗？"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 7,
    "completion_tokens": 13,
    "total_tokens": 20
  }
}
```

### 成功响应示例（Gemini 系列）

Gemini 系列模型返回的 `usage` 包含 token 明细字段（含推理 token）：

```json
{
  "id": "chatcmpl-202608040547505843574468268d9d64MT4Rb36",
  "model": "gemini-3-flash-preview",
  "object": "chat.completion",
  "created": 1785822473,
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "你好！有什么我可以帮您的吗？"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 2,
    "completion_tokens": 230,
    "total_tokens": 232,
    "prompt_tokens_details": {
      "cached_tokens": 0,
      "text_tokens": 2,
      "audio_tokens": 0,
      "image_tokens": 0
    },
    "completion_tokens_details": {
      "text_tokens": 0,
      "audio_tokens": 0,
      "image_tokens": 0,
      "reasoning_tokens": 222
    },
    "input_tokens": 0,
    "output_tokens": 0,
    "input_tokens_details": null,
    "claude_cache_creation_5_m_tokens": 0,
    "claude_cache_creation_1_h_tokens": 0
  }
}
```

### 响应字段说明

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 响应 ID |
| `model` | string | 实际使用的模型名 |
| `object` | string | 固定 `chat.completion` |
| `created` | int | Unix 时间戳 |
| `choices` | array | 候选结果数组 |
| `choices[].message.role` | string | 助手角色，固定 `assistant` |
| `choices[].message.content` | string | 模型回复内容 |
| `choices[].finish_reason` | string | 结束原因（`stop`/`length` 等） |
| `usage.prompt_tokens` | int | 输入 token 数 |
| `usage.completion_tokens` | int | 输出 token 数（Gemini 系列含推理） |
| `usage.total_tokens` | int | 总 token 数 |
| `usage.prompt_tokens_details` | object | 输入 token 明细（仅 Gemini 系列，文本/音频/图像/缓存） |
| `usage.completion_tokens_details` | object | 输出 token 明细（仅 Gemini 系列，文本/音频/图像/推理） |

### 两组模型响应差异

| 差异点 | GPT 系列 | Gemini 系列 |
|---|---|---|
| `usage` 结构 | 仅 `prompt_tokens`/`completion_tokens`/`total_tokens` | 额外含 `prompt_tokens_details`/`completion_tokens_details` |
| 推理 token | 不单独披露 | `completion_tokens_details.reasoning_tokens` 单独披露 |
| `input_tokens`/`output_tokens` | 不含 | 含（值为 0，new-api 扩展字段） |
| `claude_cache_creation_*` | 不含 | 含（值为 0，new-api 扩展字段） |

> **计费说明**: 两组模型均以 `prompt_tokens`/`completion_tokens` 为准计费。Gemini 系列的 `completion_tokens` 已包含推理 token，无需额外计算。`input_tokens`/`output_tokens`/`claude_cache_creation_*` 为 new-api 兼容多渠道的扩展字段，好易智算不填充（值为 0）。

---

## 2. Gemini 图像生成 API

### 接口信息

- **URL**: `POST /v1beta/models/<model>:generateContent`（由 adaptor 自动改写，客户端按 OpenAI 格式调用 `/v1/images/generations` 即可）
- **协议**: 客户端使用 OpenAI 图像生成格式，adaptor 转换为 Gemini 原生 `generateContent` 格式
- **特殊 Header**: adaptor 自动添加 `ModelName: <model>` 请求头

### 支持的模型

| 模型名 | 说明 | 支持的分辨率 |
|---|---|---|
| `gemini-2.5-flash-image` | Gemini 2.5 Flash 图像生成 | 1K |
| `gemini-3-pro-image-preview` | Gemini 3 Pro 图像预览 | 1K, 2K, 4K |
| `gemini-3-pro-image-preview-lite` | Gemini 3 Pro 图像预览（轻量版） | 1K |
| `gemini-3.1-flash-image-preview` | Gemini 3.1 Flash 图像预览 | 512, 1K, 2K, 4K |
| `gemini-3.1-flash-image-preview-lite` | Gemini 3.1 Flash 图像预览（轻量版） | 1K |

> **URL 映射规则**: `-lite` 后缀模型在 URL 路径中去掉 `-lite`，使用基础模型名（如 `gemini-3-pro-image-preview-lite` → URL 中使用 `gemini-3-pro-image-preview`）。

### 请求参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|
| `model` | string | 是 | - | 模型名，见上表 |
| `prompt` | string | 是 | - | 图像描述提示词 |
| `n` | int | 否 | `1` | 生成图像数量 |
| `size` | string | 否 | `1024x1024` | 图像尺寸/宽高比，见下方映射表 |
| `quality` | string | 否 | `standard` | 图像分辨率，见下方映射表 |
| `response_format` | string | 否 | `b64_json` | 响应格式：`url` 或 `b64_json` |

### `size` 参数

支持两种格式：

**像素格式（OpenAI 兼容）：**

| size 值 | 映射宽高比 |
|---|---|
| `256x256` | 1:1 |
| `512x512` | 1:1 |
| `1024x1024` | 1:1 |
| `1536x1024` | 3:2 |
| `1024x1536` | 2:3 |
| `1024x1792` | 9:16 |
| `1792x1024` | 16:9 |

**比例格式（直接透传）：**

`1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9`

### `quality` 参数

| quality 值 | 映射分辨率 | 说明 |
|---|---|---|
| `standard` 或不传 | 1K | 默认分辨率 |
| `hd` | 2K | 高清 |
| `512` | 512 | 低分辨率（仅部分模型支持） |
| `2K` | 2K | 直接指定 |
| `4K` | 4K | 超高清 |

> **注意**: `style`、`watermark`、`user` 参数不支持，Gemini API 无对应字段，传入后会被忽略。如需控制风格，请在 `prompt` 中描述。

### 请求示例

```bash
curl -X POST https://your-domain/v1/images/generations \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-3.1-flash-image-preview-lite",
    "prompt": "一只橘色的猫坐在窗台上，温暖的阳光洒在它身上",
    "n": 1,
    "size": "1024x1024",
    "quality": "standard",
    "response_format": "b64_json"
  }'
```

### 成功响应

```json
{
  "created": 1722232800,
  "data": [
    {
      "url": "",
      "b64_json": "iVBORw0KGgoAAAANSUhEUgAA..."
    }
  ],
  "usage": {
    "prompt_tokens": 258,
    "completion_tokens": 0,
    "total_tokens": 258
  }
}
```

### 响应字段说明

| 字段 | 类型 | 说明 |
|---|---|---|
| `created` | int | Unix 时间戳 |
| `data` | array | 图像数据数组 |
| `data[].url` | string | 当 `response_format=url` 时，返回 data URI 格式（`data:image/png;base64,...`） |
| `data[].b64_json` | string | 当 `response_format=b64_json` 或未指定时，返回纯 base64 编码 |
| `usage` | object | Token 消耗信息 |
| `usage.prompt_tokens` | int | 输入 token 数 |
| `usage.completion_tokens` | int | 输出 token 数（图像生成通常为 0） |
| `usage.total_tokens` | int | 总 token 数 |

### `response_format` 行为

| response_format | 返回字段 | 内容格式 |
|---|---|---|
| `b64_json` 或不传 | `b64_json` | 纯 base64 字符串 |
| `url` | `url` | `data:image/png;base64,<base64数据>` data URI |

> **说明**: Gemini API 仅返回 base64 图像数据，不提供图片 URL。当请求 `url` 格式时，系统将 base64 数据包装为 data URI 返回。

---

## 3. gpt-image-2 系列图像生成 API

### 接口信息

- **URL**: `POST /v1/images/generations`（图像生成）、`POST /v1/images/edits`（图像编辑）
- **协议**: OpenAI 图像生成兼容格式，直接透传上游
- **计费方式**: 按次计费（非 token 计费）

### 支持的模型

| 模型名 | 说明 | 支持的分辨率 | 计费价格 |
|---|---|---|---|
| `gpt-image-2` | GPT-Image-2 基础版 | 1K | 按次 |
| `gpt-image-2-1k2k` | GPT-Image-2 支持 1K/2K | 1K, 2K | 0.04 元/次 |
| `gpt-image-2-2k` | GPT-Image-2 支持 1K/2K | 1K, 2K | 0.055 元/次 |
| `gpt-image-2-4k` | GPT-Image-2 支持 1K/2K/4K | 1K, 2K, 4K | 0.065 元/次 |

### 请求参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|
| `model` | string | 是 | - | 模型名，见上表 |
| `prompt` | string | 是 | - | 图像描述提示词 |
| `n` | int | 否 | `1` | 生成图像数量 |
| `size` | string | 否 | `1024x1024` | 图像尺寸 |
| `quality` | string | 否 | `auto` | 图像质量，见下方映射表 |
| `response_format` | string | 否 | `url` | 响应格式 |
| `background` | string | 否 | `opaque` | 背景：`opaque`/`transparent` |

### `quality` 参数映射

好易智算 gpt-image 系列上游仅支持 `low`/`medium`/`high`/`auto`，不支持 OpenAI DALL-E 标准的 `standard`/`hd`，adaptor 自动映射：

| 客户端传入 | 映射后 | 说明 |
|---|---|---|
| `standard` 或不传 | `auto` | 默认自动质量 |
| `hd` | `high` | 高清 |
| `low`/`medium`/`high`/`auto` | 原值透传 | 上游原生支持 |
| 其他未知值 | `auto` | 兜底避免上游报错 |

> **重要**: `watermark` 参数会被 adaptor 自动剥离，因为好易智算上游不支持该参数，透传会导致 400 错误。

### 请求示例

```bash
curl -X POST https://your-domain/v1/images/generations \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-image-2-2k",
    "prompt": "一只橘色的猫坐在窗台上",
    "n": 1,
    "size": "1024x1024",
    "quality": "medium"
  }'
```

### 成功响应示例

```json
{
  "created": 1785815391,
  "background": "opaque",
  "data": [
    {
      "b64_json": null,
      "revised_prompt": null,
      "url": "https://skyai-video-02.tos-ap-southeast-1.bytepluses.com/g/td1_sk...png?X-Tos-Algorithm=..."
    }
  ],
  "output_format": "png",
  "quality": "medium",
  "size": "1024x1024",
  "usage": {
    "input_tokens": 30,
    "input_tokens_details": {
      "image_tokens": 0,
      "text_tokens": 30,
      "prompt_image_tokens": 0,
      "prompt_text_tokens": 30
    },
    "output_tokens": 1756,
    "total_tokens": 1786,
    "output_tokens_details": {
      "image_tokens": 1756,
      "text_tokens": 0,
      "parts_image_tokens": 1756,
      "parts_text_tokens": 0
    }
  }
}
```

### 响应字段说明

| 字段 | 类型 | 说明 |
|---|---|---|
| `created` | int | Unix 时间戳 |
| `background` | string | 背景模式（`opaque`/`transparent`） |
| `data` | array | 图像数据数组 |
| `data[].url` | string | **真实图片 URL**（对象存储签名链接，有效期 24 小时） |
| `data[].b64_json` | string | base64 数据（通常为 `null`，此系列默认返回 URL） |
| `data[].revised_prompt` | string | 修订后的提示词（通常为 `null`） |
| `output_format` | string | 输出格式（`png` 等） |
| `quality` | string | 实际使用的质量等级 |
| `size` | string | 实际输出尺寸 |
| `usage` | object | Token 消耗信息 |
| `usage.input_tokens` | int | 输入 token 数 |
| `usage.output_tokens` | int | 输出 token 数（图像 token） |
| `usage.total_tokens` | int | 总 token 数 |
| `usage.input_tokens_details` | object | 输入明细（text_tokens/image_tokens） |
| `usage.output_tokens_details` | object | 输出明细（image_tokens/text_tokens） |

> **与 Gemini 图像响应的关键差异**:
> 1. `data[].url` 是**真实 URL**（TOS 对象存储签名链接），而非 data URI
> 2. 包含 `background`/`output_format`/`quality`/`size` 顶层字段
> 3. `usage` 使用 `input_tokens`/`output_tokens` 结构，而非 `prompt_tokens`/`completion_tokens`
> 4. URL 有时效性（24 小时），如需长期保存请及时下载

---

## 通用错误处理

### HTTP 状态码

`400`, `401`, `403`, `429`, `500` 等

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

| type | code | 说明 |
|---|---|---|
| `upstream_error` | `bad_response_status_code` | 上游 API 返回错误 |
| `new_api_error` | `invalid_request` | 请求参数无效 |
| `new_api_error` | `channel_disabled` | 渠道已禁用 |
| `new_api_error` | `quota_not_enough` | 余额不足 |

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

**上游路由错误：**

```json
{
  "error": {
    "message": "未找到匹配的 LLM 接口路由: path=/v1beta/models/xxx:generateContent",
    "type": "upstream_error",
    "param": "",
    "code": "bad_response_status_code"
  }
}
```

**缺少必需参数错误：**

```json
{
  "error": {
    "message": "规格维度缺失: imageSize",
    "type": "upstream_error",
    "param": "",
    "code": "bad_response_status_code"
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

---

## 限制说明

1. **同步接口**: 图像生成为同步操作，请求后直接返回结果，不支持异步轮询
2. **分辨率限制**: 不同模型支持的分辨率不同，详见各模型表
3. **图像编辑**: gpt-image-2 系列支持 `/v1/images/edits` 图像编辑接口；Gemini 图像模型仅支持文本生成图像
4. **Token 计费**:
   - 文本对话：按上游返回的 `prompt_tokens`/`completion_tokens` 计费
   - Gemini 图像：优先使用上游返回的真实 token 数据，若无则按每张图固定 258 tokens 计算
   - gpt-image-2 系列：按次计费（ModelPrice），不按 token 计费
5. **风格控制**: 无 API 参数控制风格，请在 prompt 中描述所需风格
6. **URL 时效**: gpt-image-2 系列返回的图片 URL 有时效性（24 小时），如需长期保存请及时下载
