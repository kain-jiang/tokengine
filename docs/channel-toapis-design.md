# ToAPIs 渠道接入设计文档

## 1. 需求概述

接入新供应商 **ToAPIs**（`https://toapis.com`），支持：
- **视频生成**：seedance-2 系列（seedance-2、seedance-2-fast、seedance-2-mini）
- **兼容其他模型系列**：文本对话、图像生成等，为后续接入留好扩展

## 2. 供应商信息

| 项目 | 值 |
|------|------|
| 供应商名称 | ToAPIs |
| 官网 | https://toapis.com |
| API 文档 | https://docs.toapis.com/docs/cn/quickstart |
| Base URL | `https://toapis.com` |
| 认证方式 | `Authorization: Bearer YOUR_API_KEY` |
| API 兼容性 | OpenAI 兼容 |

## 3. API 分析

### 3.1 端点总览

| 能力 | 端点 | HTTP 方法 | 模式 |
|------|------|-----------|------|
| 文本对话 | `/v1/chat/completions` | POST | 同步/流式 |
| 图像生成 | `/v1/images/generations` | POST | 异步任务 |
| 图像任务查询 | `/v1/images/generations/{task_id}` | GET | 异步轮询 |
| 视频生成 | `/v1/videos/generations` | POST | 异步任务 |
| 视频任务查询 | `/v1/videos/generations/{task_id}` | GET | 异步轮询 |
| 列出模型 | `/v1/models` | GET | 同步 |

### 3.2 视频生成 API（seedance-2 系列）

**请求**：`POST /v1/videos/generations`

```json
{
  "model": "seedance-2",
  "prompt": "微距镜头拍摄一只玻璃蛙停在叶片上",
  "duration": 5,
  "aspect_ratio": "16:9",
  "resolution": "720p",
  "generate_audio": true,
  "image_with_roles": [
    {"url": "https://example.com/first-frame.png", "role": "first_frame"},
    {"url": "https://example.com/last-frame.png", "role": "last_frame"}
  ]
}
```

**可用模型**：
- `seedance-2` — 标准版，更高质量输出
- `seedance-2-fast` — 快速版，更低延迟
- `seedance-2-mini` — 轻量版，低成本草稿

**请求参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| model | string | 是 | 模型名称 |
| prompt | string | 是 | 视频内容描述 |
| client_business_id | string | 否 | 客户侧业务 ID |
| duration | integer | 否 | 视频时长（秒），4-15，0=自动 |
| aspect_ratio | string | 否 | 宽高比：21:9/16:9/4:3/1:1/3:4/9:16/adaptive |
| resolution | string | 否 | 分辨率：480p/720p |
| image_urls | string[] | 否 | 兼容模式图片 URL 数组 |
| image_with_roles | array | 否 | 带角色的图片数组（first_frame/last_frame/reference_image） |
| video_with_roles | array | 否 | 参考视频数组（reference_video） |
| audio_with_roles | array | 否 | 参考音频数组（reference_audio） |
| generate_audio | boolean | 否 | 是否生成音频 |
| return_last_frame | boolean | 否 | 是否返回尾帧图 |
| web_search | boolean | 否 | 是否联网搜索 |

**响应**（提交任务）：

```json
{
  "id": "video_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "object": "generation.task",
  "model": "seedance-2",
  "status": "queued",
  "progress": 0,
  "created_at": 1768380222
}
```

### 3.3 视频任务查询

**请求**：`GET /v1/videos/generations/{task_id}`

**响应**（已完成）：

```json
{
  "id": "video_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "object": "generation.task",
  "model": "seedance-2",
  "status": "completed",
  "progress": 100,
  "created_at": 1768380222,
  "completed_at": 1768380514,
  "expires_at": 1768466914,
  "result": {
    "type": "video",
    "data": [
      {
        "url": "https://files.toapis.com/seedance/xxxxx.mp4",
        "format": "mp4"
      }
    ]
  }
}
```

**响应**（失败）：

```json
{
  "id": "video_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "object": "generation.task",
  "model": "seedance-2",
  "status": "failed",
  "progress": 0,
  "created_at": 1768380222,
  "error": {
    "code": "generation_failed",
    "message": "生成失败: 内容违反了内容政策"
  }
}
```

**任务状态枚举**：`queued` / `in_progress` / `completed` / `failed`

### 3.4 文本对话 API

标准 OpenAI 兼容格式：

```bash
curl --request POST \
  --url https://toapis.com/v1/chat/completions \
  --header "Authorization: Bearer YOUR_API_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "model": "gpt-5.6-terra",
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

### 3.5 图像生成 API

```bash
curl --request POST \
  --url https://toapis.com/v1/images/generations \
  --header "Authorization: Bearer YOUR_API_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "model": "gpt-image-2",
    "prompt": "一只可爱的熊猫",
    "size": "1:1",
    "resolution": "1k",
    "n": 1
  }'
```

## 4. 兼容性分析

### 4.1 与现有 Sora Task Adaptor 的兼容性

ToAPIs 视频 API 格式与现有 Sora adaptor **高度兼容**：

| 对比项 | Sora Adaptor | ToAPIs | 兼容性 |
|--------|-------------|--------|--------|
| 提交端点 | `POST /v1/videos` | `POST /v1/videos/generations` | 需适配 URL |
| 查询端点 | `GET /v1/videos/{task_id}` | `GET /v1/videos/generations/{task_id}` | 需适配 URL |
| 响应字段 | `id, object, model, status, progress` | `id, object, model, status, progress` | 完全一致 |
| 状态枚举 | `queued/in_progress/completed/failed` | `queued/in_progress/completed/failed` | 完全一致 |
| 结果格式 | `result.data[].url` | `result.data[].url` | 完全一致 |
| 错误格式 | `error.code, error.message` | `error.code, error.message` | 完全一致 |

**结论**：可以复用 `tasksora.TaskAdaptor{}`，仅需在 `BuildRequestURL` 和 `FetchTask` 中适配 URL 路径差异。

### 4.2 URL 路径差异处理

现有 Sora adaptor 的 URL 构造：
- 提交：`{baseURL}/v1/videos`
- 查询：`{baseURL}/v1/videos/{task_id}`

ToAPIs 的 URL：
- 提交：`{baseURL}/v1/videos/generations`
- 查询：`{baseURL}/v1/videos/generations/{task_id}`

**处理方案**：在 Sora adaptor 中根据 `ChannelType` 判断 URL 路径。如果 `ChannelType == ChannelTypeToAPIs`，使用 `/v1/videos/generations`，否则使用 `/v1/videos`。

### 4.3 文本/图像兼容性

ToAPIs 文本对话和图像生成均为标准 OpenAI 兼容格式，可直接使用 `openai.Adaptor{}` 进行 relay。

## 5. 实施方案

### 5.1 架构设计

```
ChannelType=62 (ToAPIs) → APIType=APITypeToAPIs
  ├── Relay Adaptor: openai.Adaptor{} (文本对话/图像生成)
  └── Task Adaptor: tasksora.TaskAdaptor{} (视频生成/查询)
```

### 5.2 渠道编号

| 常量 | 值 | 说明 |
|------|------|------|
| `ChannelTypeToAPIs` | 62 | ToAPIs 渠道类型 |
| `ChannelTypeDummy` | 63 | 计数占位（原 62 → 63） |
| `APITypeToAPIs` | 新增 | ToAPIs API 类型 |

### 5.3 代码修改清单

#### Phase 1: 代码注册（6个注册点）

**1. `constant/channel.go`**

```go
ChannelTypeToAPIs         = 62 // ToAPIs
ChannelTypeDummy          = 63 // this one is only for count, do not add any channel after this
```

ChannelBaseURLs 数组追加：
```go
"https://toapis.com",                       //62 - ToAPIs
```

ChannelTypeNames 追加：
```go
ChannelTypeToAPIs:         "ToAPIs",
```

**2. `constant/api_type.go`**

```go
APITypeHaoee
APITypeToAPIs  // 新增
APITypeDummy // this one is only for count, do not add any channel after this
```

**3. `common/api_type.go`**

```go
case constant.ChannelTypeToAPIs:
    apiType = constant.APITypeToAPIs // ToAPIs 使用 OpenAI 兼容 API
```

**4. `relay/relay_adaptor.go`**

GetAdaptor 追加：
```go
case constant.APITypeToAPIs:
    return &openai.Adaptor{}
```

GetTaskAdaptor 追加：
```go
case constant.ChannelTypeToAPIs:
    return &tasksora.TaskAdaptor{}
```

**5. `web/src/constants/channel.constants.js`**

```js
{
  value: 62,
  color: 'purple',
  label: 'ToAPIs',
},
```

**6. `web/src/helpers/render.jsx`**

```jsx
case 62: // ToAPIs（使用通用图标）
  return <OpenAI size={iconSize} />;
```

#### Phase 2: Sora Adaptor URL 适配

在 `relay/channel/task/sora/adaptor.go` 中修改 `BuildRequestURL` 和 `FetchTask`，根据 `ChannelType` 区分 URL 路径：

**BuildRequestURL 修改**：
```go
func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
    if info.Action == constant.TaskActionRemix {
        return fmt.Sprintf("%s/v1/videos/%s/remix", a.baseURL, info.OriginTaskID), nil
    }
    // ToAPIs 使用 /v1/videos/generations 端点
    if a.ChannelType == constant.ChannelTypeToAPIs {
        return fmt.Sprintf("%s/v1/videos/generations", a.baseURL), nil
    }
    return fmt.Sprintf("%s/v1/videos", a.baseURL), nil
}
```

**FetchTask 修改**：
```go
func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
    taskID, ok := body["task_id"].(string)
    if !ok {
        return nil, fmt.Errorf("invalid task_id")
    }

    var uri string
    if a.ChannelType == constant.ChannelTypeToAPIs {
        uri = fmt.Sprintf("%s/v1/videos/generations/%s", baseUrl, taskID)
    } else {
        uri = fmt.Sprintf("%s/v1/videos/%s", baseUrl, taskID)
    }

    req, err := http.NewRequest(http.MethodGet, uri, nil)
    // ...
}
```

#### Phase 3: 模型列表

在 Sora adaptor 的 ModelList 中添加 seedance-2 系列模型（可选，主要依赖渠道配置的模型列表）：

```go
var ModelList = []string{
    // 现有模型...
    "seedance-2",
    "seedance-2-fast",
    "seedance-2-mini",
}
```

## 6. 路由映射

现有路由已支持 ToAPIs 的视频端点：

| 客户端请求 | 路由 | Controller |
|-----------|------|------------|
| `POST /v1/videos` | `videoV1Router.POST("/videos")` | `controller.RelayTask` |
| `GET /v1/videos/{task_id}` | `videoV1Router.GET("/videos/:task_id")` | `controller.RelayTaskFetch` |
| `POST /v1/chat/completions` | 已有 OpenAI 兼容路由 | `controller.RelayChatCompletions` |
| `POST /v1/images/generations` | 已有 OpenAI 兼容路由 | `controller.RelayImageGenerations` |

**无需新增路由**。

## 7. 回滚方案

- **回滚方法**：`git revert` 回退所有修改
- 所有修改均为增量添加（新常量、新映射），不修改现有渠道逻辑
- Sora adaptor 的修改通过 `ChannelType` 条件分支隔离，不影响现有 Sora/AgnesAI 渠道
- 回滚后不影响现有任何渠道功能

## 8. 验收标准

- [ ] `go build` 编译通过
- [ ] 前端渠道下拉框显示 "ToAPIs" 选项
- [ ] 添加渠道后，文本对话 API 正常调用（`POST /v1/chat/completions`）
- [ ] 视频生成 API 返回 task_id（`POST /v1/videos` with model=seedance-2）
- [ ] 视频任务查询返回正确状态（`GET /v1/videos/{task_id}`）
- [ ] 现有 Sora/AgnesAI 渠道功能不受影响

## 9. 定价策略

### 9.1 计费公式

```
Quota = ModelPrice × seconds × size_ratio × input_discount
```

- `ModelPrice`：基础单价（USD/秒），按 720p 无输入视频定价
- `seconds`：输出视频时长（用户请求的 duration/seconds 字段）
- `size_ratio`：分辨率调整系数
- `input_discount`：有输入视频时的折扣系数（仅 seedance-2）

### 9.2 换算关系

- new-api 内部：1 USD = 500 积分(quota)
- ToAPIs 积分直接对应 new-api 积分（1:1）
- **ModelPrice = ToAPIs积分/s / 500**

### 9.3 ModelPrice 配置（720p 无输入视频基准）

| 模型 | ToAPIs 积分/s | ModelPrice (USD) |
|------|-------------|-----------------|
| seedance-2 | 25.71 | 0.05142 |
| seedance-2-fast | 20.57 | 0.04114 |
| seedance-2-mini | 14.29 | 0.02858 |

### 9.4 分辨率调整系数（仅 seedance-2）

| 分辨率 | 无输入(积分/s) | 有输入(积分/s) | size_ratio | input_discount |
|--------|---------------|---------------|------------|----------------|
| 480p | 12.86 | 7.71 | 0.5 | 0.6 |
| 720p | 25.71 | 15.43 | 1.0 | 0.6 |
| 1080p | 64.29 | 38.57 | 2.5 | 0.6 |
| 4k | 143 | 85.74 | 5.5556 | 0.6 |

> seedance-2-fast 和 seedance-2-mini 所有分辨率价格相同，不适用分辨率调整。

### 9.5 计费示例

| 场景 | 计算 | 结果(积分) |
|------|------|----------|
| seedance-2 720p 5s 无输入 | 0.05142 × 500 × 5 × 1.0 | 128.55 = 25.71×5 ✓ |
| seedance-2 720p 5s 有输入 | 0.05142 × 500 × 5 × 1.0 × 0.6 | 77.13 = 15.43×5 ✓ |
| seedance-2 1080p 5s 无输入 | 0.05142 × 500 × 5 × 2.5 | 321.38 = 64.29×5 ✓ |
| seedance-2 1080p 5s 有输入 | 0.05142 × 500 × 5 × 2.5 × 0.6 | 192.83 = 38.57×5 ✓ |
| seedance-2 4k 5s 无输入 | 0.05142 × 500 × 5 × 5.5556 | 714.73 = 143×5 ✓ |
| seedance-2 480p 5s 有输入 | 0.05142 × 500 × 5 × 0.5 × 0.6 | 38.57 = 7.71×5 ✓ |
| seedance-2-fast 720p 5s | 0.04114 × 500 × 5 × 1.0 | 102.85 = 20.57×5 ✓ |
| seedance-2-mini 720p 5s | 0.02858 × 500 × 5 × 1.0 | 71.45 = 14.29×5 ✓ |

### 9.6 完整换算过程示例（seedance-2 720p 5s 无输入）

**ToAPIs 原价**：25.71 积分/s × 5s = 128.55 积分 = ¥4.5

**new-api 计费**：

```
步骤1: ModelPrice = ToAPIs积分/s ÷ 500 = 25.71 ÷ 500 = 0.05142 USD

步骤2: Quota = ModelPrice × 500 × seconds × size_ratio
              = 0.05142 × 500 × 5 × 1.0
              = 128.55 积分

步骤3: 人民币 = 128.55 × 0.035 = ¥4.5
```

**前端展示价格**：

```
前端显示 = ModelPrice × USD2RMB(7.3) = 0.05142 × 7.3 = ¥0.375/次
```

> **注意**：前端显示 `¥0.375/次` 是按 USD→RMB 汇率换算的单次价格，实际扣费按积分计算（`128.55 积分 = ¥4.5`）。两者不一致是因为 new-api 内部 `1 USD = 500 积分`，而 `500 × 0.035 = ¥17.5 ≠ ¥7.3`，两套汇率体系存在差异。这是系统级问题，非 ToAPIs 特有。

### 9.7 输入视频检测

`EstimateBilling` 通过读取原始请求体检测以下字段来判断是否有输入视频：
- `image_with_roles`：带角色的图片数组（first_frame/last_frame/reference_image）
- `video_with_roles`：参考视频数组
- `image_urls`：兼容模式图片 URL 数组

任一字段非空即视为有输入视频，应用 0.6 折扣。

## 10. 后续扩展

ToAPIs 支持的模型系列（当前仅接入 seedance-2，后续可按需接入）：

| 类型 | 模型 | 端点 |
|------|------|------|
| 文本 | gpt-5.6-terra/sol/luna, claude-4.7, deepseek-v3 | `/v1/chat/completions` |
| 图像 | gpt-image-2, seedream-5.0, flux-kontext | `/v1/images/generations` |
| 视频 | sora-2-vvip, veo3, kling-v3, wan2.6 | `/v1/videos/generations` |

扩展时只需在渠道配置中添加对应模型名称即可，无需修改代码。
