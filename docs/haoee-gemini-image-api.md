# Gemini 图像生成 API 接口文档

## 接口信息

- **URL**: `POST /v1/images/generations`
- **协议**: OpenAI 兼容格式
- **认证**: `Authorization: Bearer <your_api_key>`

## 支持的模型

| 模型名 | 说明 | 支持的分辨率 |
|---|---|---|
| `gemini-2.5-flash-image` | Gemini 2.5 Flash 图像生成 | 1K |
| `gemini-3-pro-image-preview` | Gemini 3 Pro 图像预览 | 1K, 2K, 4K |
| `gemini-3-pro-image-preview-lite` | Gemini 3 Pro 图像预览（轻量版） | 1K |
| `gemini-3.1-flash-image-preview` | Gemini 3.1 Flash 图像预览 | 512, 1K, 2K, 4K |
| `gemini-3.1-flash-image-preview-lite` | Gemini 3.1 Flash 图像预览（轻量版） | 1K |

## 请求参数

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

## 请求示例

### 基础请求

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

### 高清 + 宽屏请求

```bash
curl -X POST https://your-domain/v1/images/generations \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-3.1-flash-image-preview",
    "prompt": "夕阳下的城市天际线，高楼大厦的玻璃幕墙反射着金色光芒",
    "n": 1,
    "size": "1792x1024",
    "quality": "hd",
    "response_format": "url"
  }'
```

### 直接使用比例格式

```bash
curl -X POST https://your-domain/v1/images/generations \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-3-pro-image-preview",
    "prompt": "一幅水墨画风格的山水图",
    "size": "16:9",
    "quality": "4K"
  }'
```

## 成功响应

### HTTP 状态码

`200 OK`

### 响应结构

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

### 成功响应示例（b64_json 格式）

```json
{
  "created": 1722232800,
  "data": [
    {
      "url": "",
      "b64_json": "iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAYAAAD0eNT6AAAACXBIWXMAAA7EAAAOxAGVKw4bAAB..."
    }
  ],
  "usage": {
    "prompt_tokens": 258,
    "completion_tokens": 0,
    "total_tokens": 258
  }
}
```

### 成功响应示例（url 格式）

```json
{
  "created": 1722232800,
  "data": [
    {
      "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAYAAAD0eNT6AAAACXBIWXMAAA7EAAAOxAGVKw4bAAB...",
      "b64_json": ""
    }
  ],
  "usage": {
    "prompt_tokens": 258,
    "completion_tokens": 0,
    "total_tokens": 258
  }
}
```

## 失败响应

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

## 限制说明

1. **同步接口**: 图像生成为同步操作，请求后直接返回结果，不支持异步轮询
2. **分辨率限制**: 不同模型支持的分辨率不同，详见模型表
3. **不支持图像编辑**: 当前仅支持文本生成图像，不支持参考图片输入
4. **Token 计费**: 优先使用上游返回的真实 token 数据，若无则按每张图固定 258 tokens 计算
5. **风格控制**: 无 API 参数控制风格，请在 prompt 中描述所需风格
