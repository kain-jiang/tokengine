package sora

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
	"github.com/tidwall/sjson"
)

// ============================
// Request / Response structures
// ============================

type ContentItem struct {
	Type     string    `json:"type"`                // "text" or "image_url"
	Text     string    `json:"text,omitempty"`      // for text type
	ImageURL *ImageURL `json:"image_url,omitempty"` // for image_url type
}

type ImageURL struct {
	URL string `json:"url"`
}

type responseTask struct {
	ID                 string `json:"id"`
	TaskID             string `json:"task_id,omitempty"` //兼容旧接口
	Object             string `json:"object"`
	Model              string `json:"model"`
	Status             string `json:"status"`
	Progress           int    `json:"progress"`
	CreatedAt          int64  `json:"created_at"`
	CompletedAt        int64  `json:"completed_at,omitempty"`
	ExpiresAt          int64  `json:"expires_at,omitempty"`
	Seconds            string `json:"seconds,omitempty"`
	Size               string `json:"size,omitempty"`
	RemixedFromVideoID string `json:"remixed_from_video_id,omitempty"`
	Metadata           *struct {
		URL      string `json:"url,omitempty"`
		VideoURL string `json:"video_url,omitempty"`
	} `json:"metadata,omitempty"`
	Error *struct {
		Message string `json:"message"`
		Code    string `json:"code"`
	} `json:"error,omitempty"`
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

func validateRemixRequest(c *gin.Context) *dto.TaskError {
	var req relaycommon.TaskSubmitReq
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	if strings.TrimSpace(req.Prompt) == "" {
		return service.TaskErrorWrapperLocal(fmt.Errorf("field prompt is required"), "invalid_request", http.StatusBadRequest)
	}
	// 存储原始请求到 context，与 ValidateMultipartDirect 路径保持一致
	c.Set("task_request", req)
	return nil
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) (taskErr *dto.TaskError) {
	if info.Action == constant.TaskActionRemix {
		return validateRemixRequest(c)
	}
	taskErr = relaycommon.ValidateMultipartDirect(c, info)
	if taskErr != nil {
		return
	}
	// Agnes AI requires lowercase model names for channel matching
	// Convert model name to lowercase so it matches channel-configured models
	if info.OriginModelName != "" && strings.Contains(info.OriginModelName, "Agnes") {
		lowerModel := strings.ToLower(info.OriginModelName)
		if lowerModel != info.OriginModelName {
			logger.LogInfo(c, fmt.Sprintf("[AGNESAI] Converting model name for channel matching: %s -> %s", info.OriginModelName, lowerModel))
			info.OriginModelName = lowerModel
			info.UpstreamModelName = lowerModel
			// Update context for distributor to use the converted model name
			common.SetContextKey(c, constant.ContextKeyOriginalModel, lowerModel)
		}
	}
	return nil
}

// EstimateBilling 根据用户请求的 seconds 和 size 计算 OtherRatios。
func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	// remix 路径的 OtherRatios 已在 ResolveOriginTask 中设置
	if info.Action == constant.TaskActionRemix {
		return nil
	}

	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil
	}

	seconds, _ := strconv.Atoi(req.Seconds)
	if seconds == 0 {
		seconds = req.Duration
	}
	if seconds <= 0 {
		seconds = 4
	}

	size := req.Size
	if size == "" {
		size = "720x1280"
	}

	ratios := map[string]float64{
		"seconds": float64(seconds),
		"size":    1,
	}
	if size == "1792x1024" || size == "1024x1792" {
		ratios["size"] = 1.666667
	}

	// ToAPIs seedance-2: resolution-based pricing and input video discount
	if a.ChannelType == constant.ChannelTypeToAPIs {
		// Read original request body to detect resolution and input fields
		storage, storageErr := common.GetBodyStorage(c)
		if storageErr == nil {
			cachedBody, bodyErr := storage.Bytes()
			if bodyErr == nil {
				var bodyMap map[string]interface{}
				if common.Unmarshal(cachedBody, &bodyMap) == nil {
					// Resolution-based size ratio for seedance-2
					// Base price is 720p; other resolutions scale accordingly
					if info.OriginModelName == "seedance-2" {
						resolution, _ := bodyMap["resolution"].(string)
						switch resolution {
						case "480p":
							ratios["size"] = 0.5
						case "720p":
							ratios["size"] = 1.0
						case "1080p":
							ratios["size"] = 2.5
						case "4k":
							ratios["size"] = 5.5556
						}
						// Input video discount: with-input price is 0.6x of no-input price
						if hasToAPIsInputVideo(bodyMap) {
							ratios["input_discount"] = 0.6
						}
					}
					// seedance-2-fast and seedance-2-mini: same price across resolutions, no input discount
				}
			}
		}
	}

	return ratios
}

// hasToAPIsInputVideo checks if the request body contains input video/image fields
func hasToAPIsInputVideo(bodyMap map[string]interface{}) bool {
	// Check image_with_roles (ToAPIs specific field)
	if imageWithRoles, ok := bodyMap["image_with_roles"].([]interface{}); ok && len(imageWithRoles) > 0 {
		return true
	}
	// Check video_with_roles (ToAPIs specific field)
	if videoWithRoles, ok := bodyMap["video_with_roles"].([]interface{}); ok && len(videoWithRoles) > 0 {
		return true
	}
	// Check image_urls (compatibility field)
	if imageUrls, ok := bodyMap["image_urls"].([]interface{}); ok && len(imageUrls) > 0 {
		return true
	}
	return false
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	if info.Action == constant.TaskActionRemix {
		return fmt.Sprintf("%s/v1/videos/%s/remix", a.baseURL, info.OriginTaskID), nil
	}
	// ToAPIs uses /v1/videos/generations endpoint
	if a.ChannelType == constant.ChannelTypeToAPIs {
		return fmt.Sprintf("%s/v1/videos/generations", a.baseURL), nil
	}
	return fmt.Sprintf("%s/v1/videos", a.baseURL), nil
}

// BuildRequestHeader sets required headers.
func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	req.Header.Set("Content-Type", c.Request.Header.Get("Content-Type"))
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil, errors.Wrap(err, "get_request_body_failed")
	}
	cachedBody, err := storage.Bytes()
	if err != nil {
		return nil, errors.Wrap(err, "read_body_bytes_failed")
	}
	contentType := c.GetHeader("Content-Type")

	logger.LogInfo(c, fmt.Sprintf("[AGNESAI_DEBUG] BuildRequestBody: contentType=%s, upstreamModel=%s, cachedBody=%s", contentType, info.UpstreamModelName, string(cachedBody)))

	if strings.HasPrefix(contentType, "application/json") {
		var bodyMap map[string]interface{}
		if err := common.Unmarshal(cachedBody, &bodyMap); err == nil {
			// Agnes AI requires lowercase model names
			modelName := info.UpstreamModelName
			if strings.Contains(info.UpstreamModelName, "Agnes") || strings.Contains(info.UpstreamModelName, "agnes") {
				modelName = strings.ToLower(info.UpstreamModelName)
			}
			bodyMap["model"] = modelName
			// Agnes AI video API doesn't need 'group' field in the request body
			delete(bodyMap, "group")
			logger.LogInfo(c, fmt.Sprintf("[AGNESAI_DEBUG] BuildRequestBody: originalModel=%s, convertedModel=%s, body=%v", info.UpstreamModelName, modelName, bodyMap))
			if newBody, err := common.Marshal(bodyMap); err == nil {
				return bytes.NewReader(newBody), nil
			}
		}
		return bytes.NewReader(cachedBody), nil
	}

	if strings.Contains(contentType, "multipart/form-data") {
		formData, err := common.ParseMultipartFormReusable(c)
		if err != nil {
			return bytes.NewReader(cachedBody), nil
		}
		var buf bytes.Buffer
		writer := multipart.NewWriter(&buf)
		writer.WriteField("model", info.UpstreamModelName)
		for key, values := range formData.Value {
			if key == "model" {
				continue
			}
			for _, v := range values {
				writer.WriteField(key, v)
			}
		}
		for fieldName, fileHeaders := range formData.File {
			for _, fh := range fileHeaders {
				f, err := fh.Open()
				if err != nil {
					continue
				}
				ct := fh.Header.Get("Content-Type")
				if ct == "" || ct == "application/octet-stream" {
					buf512 := make([]byte, 512)
					n, _ := io.ReadFull(f, buf512)
					ct = http.DetectContentType(buf512[:n])
					// Re-open after sniffing so the full content is copied below
					f.Close()
					f, err = fh.Open()
					if err != nil {
						continue
					}
				}
				h := make(textproto.MIMEHeader)
				h.Set("Content-Disposition", fmt.Sprintf(`form-data; name="%s"; filename="%s"`, fieldName, fh.Filename))
				h.Set("Content-Type", ct)
				part, err := writer.CreatePart(h)
				if err != nil {
					f.Close()
					continue
				}
				io.Copy(part, f)
				f.Close()
			}
		}
		writer.Close()
		c.Request.Header.Set("Content-Type", writer.FormDataContentType())
		return &buf, nil
	}

	return common.ReaderOnly(storage), nil
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

	// Parse Sora response
	var dResp responseTask
	if err := common.Unmarshal(responseBody, &dResp); err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}

	upstreamID := dResp.ID
	if upstreamID == "" {
		upstreamID = dResp.TaskID
	}
	if upstreamID == "" {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("task_id is empty"), "invalid_response", http.StatusInternalServerError)
		return
	}

	// 使用公开 task_xxxx ID 返回给客户端
	dResp.ID = info.PublicTaskID
	dResp.TaskID = info.PublicTaskID
	c.JSON(http.StatusOK, dResp)
	return upstreamID, responseBody, nil
}

// FetchTask fetch task status
// Agnes AI Video V2.0 官方文档：使用 GET /v1/videos/{task_id} 查询任务状态
// 参考：https://agnes-ai.com/doc/agnes-video-v20
func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid task_id")
	}

	// ToAPIs uses /v1/videos/generations/{task_id} endpoint
	// Sora/AgnesAI use GET /v1/videos/{task_id}
	var uri string
	if a.ChannelType == constant.ChannelTypeToAPIs {
		uri = fmt.Sprintf("%s/v1/videos/generations/%s", baseUrl, taskID)
	} else {
		uri = fmt.Sprintf("%s/v1/videos/%s", baseUrl, taskID)
	}

	req, err := http.NewRequest(http.MethodGet, uri, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+key)

	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	return client.Do(req)
}

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	resTask := responseTask{}
	if err := common.Unmarshal(respBody, &resTask); err != nil {
		return nil, errors.Wrap(err, "unmarshal task result failed")
	}

	taskResult := relaycommon.TaskInfo{
		Code: 0,
	}

	// Normalize status: AgnesAI may return "success"/"failed" instead of "completed"/"failed"
	status := strings.ToLower(resTask.Status)

	switch status {
	case "queued", "pending", "submitting", "submitted":
		taskResult.Status = model.TaskStatusQueued
	case "processing", "in_progress", "running", "pending_review":
		taskResult.Status = model.TaskStatusInProgress
	case "completed", "success":
		taskResult.Status = model.TaskStatusSuccess
		// Agnes returns the playable CDN URL under metadata.url.
		if resTask.Metadata != nil {
			taskResult.Url = strings.TrimSpace(resTask.Metadata.URL)
			if taskResult.Url == "" {
				taskResult.Url = strings.TrimSpace(resTask.Metadata.VideoURL)
			}
		}
	case "failed", "cancelled", "canceled", "error", "failure":
		taskResult.Status = model.TaskStatusFailure
		if resTask.Error != nil {
			taskResult.Reason = resTask.Error.Message
		} else {
			taskResult.Reason = "task failed"
		}
	default:
		logger.LogDebug(context.Background(), fmt.Sprintf("[SORA/AGNESAI] Unrecognized status: %s, keeping task in current state", resTask.Status))
		// Return empty status to keep the task in its current state (don't force a state change)
		taskResult.Status = ""
	}
	if resTask.Progress > 0 && resTask.Progress < 100 {
		taskResult.Progress = fmt.Sprintf("%d%%", resTask.Progress)
	}

	return &taskResult, nil
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(task *model.Task) ([]byte, error) {
	data := task.Data
	var err error
	if data, err = sjson.SetBytes(data, "id", task.TaskID); err != nil {
		return nil, errors.Wrap(err, "set id failed")
	}
	return data, nil
}
