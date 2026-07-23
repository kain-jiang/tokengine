package jingwei

import (
	"bytes"
	"context"
	"crypto/rand"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
	"github.com/samber/lo"
)

// ============================
// Request / Response structures
// ============================

type ContentItem struct {
	Type     string    `json:"type,omitempty"`
	Text     string    `json:"text,omitempty"`
	ImageURL *MediaURL `json:"image_url,omitempty"`
	VideoURL *MediaURL `json:"video_url,omitempty"`
	AudioURL *MediaURL `json:"audio_url,omitempty"`
	Role     string    `json:"role,omitempty"`
}

type MediaURL struct {
	URL string `json:"url,omitempty"`
}

type requestPayload struct {
	Model         string         `json:"model"`
	Content       []ContentItem  `json:"content,omitempty"`
	CallbackURL   string         `json:"callback_url,omitempty"`
	GenerateAudio *dto.BoolValue `json:"generate_audio,omitempty"`
	Resolution    string         `json:"resolution,omitempty"`
	Ratio         string         `json:"ratio,omitempty"`
	Duration      *dto.IntValue  `json:"duration,omitempty"`
	Frames        *dto.IntValue  `json:"frames,omitempty"`
	Watermark     *dto.BoolValue `json:"watermark,omitempty"`
}

type responsePayload struct {
	ID             string `json:"id"`      // task_id
	TaskID         string `json:"task_id"` // task_id
	Object         string `json:"object"`
	Model          string `json:"model"`
	Status         string `json:"status"`
	Progress       int    `json:"progress"`
	CreatedAt      int64  `json:"created_at"`
	UpstreamTaskID string `json:"upstream_task_id"` // 火山原始任务id
}

const ChannelName = "Jingwei"

// 鲸纬查询响应结构（三层嵌套）
type queryResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Data    struct {
		Status    string `json:"status"`
		ResultURL string `json:"result_url"`
		Data      struct {
			Data struct {
				Content struct {
					VideoURL string `json:"video_url"`
				} `json:"content"`
				Cost struct {
					Currency   string `json:"currency"`
					InputCost  string `json:"input_cost"`
					OutputCost string `json:"output_cost"`
					TotalCost  string `json:"total_cost"`
				} `json:"cost"`
				CreatedAt       int64  `json:"created_at"`
				Duration        int    `json:"duration"`
				FramesPerSecond int    `json:"framespersecond"`
				GenerateAudio   bool   `json:"generate_audio"`
				Model           string `json:"model"`
				Ratio           string `json:"ratio"`
				Resolution      string `json:"resolution"`
				Seed            int    `json:"seed"`
				Status          string `json:"status"`
				Usage           struct {
					CompletionTokens int `json:"completion_tokens"`
					TotalTokens      int `json:"total_tokens"`
				} `json:"usage"`
			} `json:"data"`
		} `json:"data"`
	} `json:"data"`
}

// ============================
// Adaptor implementation
// ============================

type TaskAdaptor struct {
	taskcommon.BaseBilling
	ChannelType int
	apiKey      string
	baseURL     string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.ChannelType = info.ChannelType
	a.baseURL = info.ChannelBaseUrl
	a.apiKey = info.ApiKey
}

// ValidateRequestAndSetAction parses body, validates fields and sets default action.
func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) (taskErr *dto.TaskError) {
	// Accept only POST /v1/video/generations as "generate" action.
	return relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionGenerate)
}

// BuildRequestURL constructs the upstream URL.
func (a *TaskAdaptor) BuildRequestURL(_ *relaycommon.RelayInfo) (string, error) {
	return fmt.Sprintf("%s/v1/video/generations", a.baseURL), nil
}

// BuildRequestHeader sets required headers.
func (a *TaskAdaptor) BuildRequestHeader(_ *gin.Context, req *http.Request, _ *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", formatBearerToken(a.apiKey))
	req.Header.Set("X-Trace-ID", generateTraceID())
	return nil
}

func formatBearerToken(apiKey string) string {
	apiKey = strings.TrimSpace(apiKey)
	if strings.HasPrefix(strings.ToLower(apiKey), "bearer ") {
		return apiKey
	}
	return "Bearer " + apiKey
}

// EstimateBilling 根据分辨率和视频输入计算 OtherRatios。
func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil
	}

	// 解析分辨率
	resolution := ResolveJingweiResolution(req.Metadata, req.Size)
	resRatio := GetResolutionRatio(resolution)

	otherRatios := make(map[string]float64)
	otherRatios["resolution"] = resRatio

	// 检查是否有视频输入
	hasVideo := hasVideoInMetadata(req.Metadata)
	if hasVideo {
		if videoRatio, ok := GetVideoInputRatio(info.OriginModelName, resolution); ok {
			otherRatios["video_input"] = videoRatio
		}
	}

	return otherRatios
}

// hasVideoInMetadata 检查 metadata 是否包含视频输入
func hasVideoInMetadata(metadata map[string]interface{}) bool {
	if metadata == nil {
		return false
	}

	// 检查 content 数组中的 video_url 条目
	contentRaw, ok := metadata["content"]
	if !ok {
		return false
	}
	contentSlice, ok := contentRaw.([]interface{})
	if !ok {
		return false
	}
	for _, item := range contentSlice {
		itemMap, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		if itemMap["type"] == "video_url" {
			return true
		}
		if _, has := itemMap["video_url"]; has {
			return true
		}
	}
	return false
}

// BuildRequestBody converts request into Jingwei specific format.
func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil, err
	}

	body, err := a.convertToRequestPayload(&req)
	if err != nil {
		return nil, errors.Wrap(err, "convert request payload failed")
	}
	if info.IsModelMapped {
		body.Model = info.UpstreamModelName
	} else {
		info.UpstreamModelName = body.Model
	}
	data, err := common.Marshal(body)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

// DoRequest delegates to common helper.
func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

// DoResponse handles upstream response, returns taskID etc.
func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *dto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
		return
	}
	_ = resp.Body.Close()

	// Parse Jingwei response
	var dResp responsePayload
	if err := common.Unmarshal(responseBody, &dResp); err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}

	if dResp.ID == "" {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("task_id is empty"), "invalid_response", http.StatusInternalServerError)
		return
	}

	ov := dto.NewOpenAIVideo()
	ov.ID = info.PublicTaskID
	ov.TaskID = info.PublicTaskID
	ov.CreatedAt = time.Now().Unix()
	ov.Model = info.OriginModelName

	c.JSON(http.StatusOK, ov)
	return dResp.ID, responseBody, nil
}

// FetchTask fetch task status
func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid task_id")
	}

	uri := fmt.Sprintf("%s/v1/video/generations/%s", baseUrl, taskID)

	req, err := http.NewRequest(http.MethodGet, uri, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", formatBearerToken(key))
	req.Header.Set("X-Trace-ID", generateTraceID())

	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	logger.LogInfo(context.Background(), fmt.Sprintf("Jingwei FetchTask: URL=%s, Status=%d", req.URL.String(), resp.StatusCode))
	return resp, nil
}

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
}

func (a *TaskAdaptor) convertToRequestPayload(req *relaycommon.TaskSubmitReq) (*requestPayload, error) {
	r := requestPayload{
		Model:         req.Model,
		GenerateAudio: lo.ToPtr(dto.BoolValue(true)),
		Ratio:         req.Size,
	}

	// 处理 content：优先使用 metadata.content，否则从 prompt 和 req.Images 构建
	metadata := req.Metadata
	if metadata != nil {
		// 检查是否有完整的 content 数组
		if contentRaw, ok := metadata["content"]; ok {
			if contentSlice, ok := contentRaw.([]interface{}); ok && len(contentSlice) > 0 {
				// 直接使用 metadata 中的 content
				for _, item := range contentSlice {
					itemMap, ok := item.(map[string]interface{})
					if !ok {
						continue
					}
					contentItem := ContentItem{}
					if itemType, ok := itemMap["type"].(string); ok {
						contentItem.Type = itemType
					}
					if text, ok := itemMap["text"].(string); ok {
						contentItem.Text = text
					}
					if role, ok := itemMap["role"].(string); ok {
						contentItem.Role = role
					}
					// 处理 image_url
					if imageURLMap, ok := itemMap["image_url"].(map[string]interface{}); ok {
						if url, ok := imageURLMap["url"].(string); ok {
							contentItem.ImageURL = &MediaURL{URL: url}
						}
					}
					// 处理 video_url
					if videoURLMap, ok := itemMap["video_url"].(map[string]interface{}); ok {
						if url, ok := videoURLMap["url"].(string); ok {
							contentItem.VideoURL = &MediaURL{URL: url}
						}
					}
					// 处理 audio_url
					if audioURLMap, ok := itemMap["audio_url"].(map[string]interface{}); ok {
						if url, ok := audioURLMap["url"].(string); ok {
							contentItem.AudioURL = &MediaURL{URL: url}
						}
					}
					r.Content = append(r.Content, contentItem)
				}
			}
		}
	}

	// 如果没有从 metadata 获取 content，则从 prompt 和 req.Images 构建
	if len(r.Content) == 0 {
		r.Content = []ContentItem{{
			Type: "text",
			Text: req.Prompt,
		}}
		// 处理图片输入
		if len(req.Images) > 0 {
			for _, imgURL := range req.Images {
				if imgURL == "" {
					continue
				}
				r.Content = append(r.Content, ContentItem{
					Type:     "image_url",
					ImageURL: &MediaURL{URL: imgURL},
					Role:     "reference_image",
				})
			}
		}
	}

	// 从 metadata 解析其他参数
	if err := taskcommon.UnmarshalMetadata(metadata, &r); err != nil {
		return nil, errors.Wrap(err, "unmarshal metadata failed")
	}

	// 设置宽高比
	// Seedance 2.0 系列、Seedance 1.5 Pro 默认值为 adaptive
	// 其他模型：文生视频默认值 16:9，图生视频默认值 adaptive
	if r.Ratio == "" {
		if isSeedance2Or15Pro(r.Model) {
			r.Ratio = "adaptive"
		} else if len(req.Images) > 0 {
			// 图生视频场景，使用 adaptive
			r.Ratio = "adaptive"
		} else {
			// 文生视频场景，使用 16:9
			r.Ratio = "16:9"
		}
	}

	// 设置时长 默认值：5 秒
	if sec, _ := strconv.Atoi(req.Seconds); sec > 0 {
		r.Duration = lo.ToPtr(dto.IntValue(sec))
	} else if req.Duration > 0 {
		r.Duration = lo.ToPtr(dto.IntValue(req.Duration))
	}
	if r.Duration == nil {
		defaultDuration := dto.IntValue(5)
		r.Duration = &defaultDuration
	}

	if r.Watermark == nil {
		watermark := dto.BoolValue(false)
		r.Watermark = &watermark
	}

	// 设置分辨率：从 metadata 中解析，size 参数是宽高比，不用于解析分辨率
	if r.Resolution == "" {
		r.Resolution = ResolveJingweiResolution(req.Metadata, req.Size)
	}

	return &r, nil
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var qResp queryResponse
	if err := common.Unmarshal(respBody, &qResp); err != nil {
		return nil, errors.Wrap(err, "unmarshal jingwei task result failed")
	}

	taskResult := relaycommon.TaskInfo{
		Code: 0,
	}

	// 使用内层火山原生状态（小写）
	status := strings.ToLower(qResp.Data.Status)

	// Map Jingwei status to internal status
	switch status {
	case "queued", "pending", "not_start":
		taskResult.Status = model.TaskStatusQueued
		taskResult.Progress = "10%"
	case "running", "processing", "in_progress":
		taskResult.Status = model.TaskStatusInProgress
		taskResult.Progress = "50%"
	case "succeeded", "success":
		taskResult.Status = model.TaskStatusSuccess
		taskResult.Progress = "100%"
		// 优先使用 result_url，其次使用内层 video_url
		if qResp.Data.ResultURL != "" {
			taskResult.Url = qResp.Data.ResultURL
		} else {
			taskResult.Url = qResp.Data.Data.Data.Content.VideoURL
		}
		// 解析 usage 信息用于按倍率计费
		taskResult.CompletionTokens = qResp.Data.Data.Data.Usage.CompletionTokens
		taskResult.TotalTokens = qResp.Data.Data.Data.Usage.TotalTokens
	case "failed", "cancelled", "canceled", "error", "failure":
		taskResult.Status = model.TaskStatusFailure
		taskResult.Progress = "100%"
		taskResult.Reason = qResp.Message
	default:
		// Unknown status, treat as processing
		taskResult.Status = model.TaskStatusInProgress
		taskResult.Progress = "30%"
	}
	return &taskResult, nil
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(originTask *model.Task) ([]byte, error) {
	var qResp queryResponse
	if err := common.Unmarshal(originTask.Data, &qResp); err != nil {
		return nil, errors.Wrap(err, "unmarshal jingwei task data failed")
	}

	openAIVideo := dto.NewOpenAIVideo()
	openAIVideo.ID = originTask.TaskID
	openAIVideo.TaskID = originTask.TaskID
	openAIVideo.Status = originTask.Status.ToVideoStatus()
	openAIVideo.SetProgressStr(originTask.Progress)

	// 优先使用 result_url，其次使用内层 video_url
	videoURL := qResp.Data.ResultURL
	if videoURL == "" {
		videoURL = qResp.Data.Data.Data.Content.VideoURL
	}
	openAIVideo.SetMetadata("url", videoURL)
	openAIVideo.CreatedAt = originTask.CreatedAt
	openAIVideo.CompletedAt = originTask.UpdatedAt
	openAIVideo.Model = originTask.Properties.OriginModelName

	if strings.ToLower(qResp.Data.Data.Data.Status) == "failed" {
		openAIVideo.Error = &dto.OpenAIVideoError{
			Message: qResp.Message,
			Code:    qResp.Code,
		}
	}

	return common.Marshal(openAIVideo)
}

// generateTraceID 生成 32 位随机字符串，用于 X-Trace-ID 头
func generateTraceID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return fmt.Sprintf("%x", b)
}

// ============================
// Model helpers
// ============================

// isSeedance2Or15Pro 判断模型是否为 Seedance 2.0 系列或 Seedance 1.5 Pro
func isSeedance2Or15Pro(model string) bool {
	return strings.Contains(model, "seedance-2.0") ||
		strings.Contains(model, "seedance-1.5-pro")
}
