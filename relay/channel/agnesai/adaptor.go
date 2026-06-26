package agnesai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

// Adaptor implements the channel.Adaptor interface for Agnes AI
type Adaptor struct {
	ChannelType    int
	ResponseFormat string
}

// Init initializes the adaptor with relay info
func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
	a.ChannelType = info.ChannelType
}

// GetRequestURL returns the request URL for Agnes AI API
func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	// Agnes AI uses OpenAI-compatible API endpoint
	baseURL := info.ChannelBaseUrl
	if baseURL == "" {
		baseURL = "https://apihub.agnes-ai.com"
	}

	requestURL := info.RequestURLPath
	if requestURL == "" {
		switch info.RelayMode {
		case relayconstant.RelayModeChatCompletions:
			requestURL = "/v1/chat/completions"
		case relayconstant.RelayModeEmbeddings:
			requestURL = "/v1/embeddings"
		case relayconstant.RelayModeImagesGenerations:
			requestURL = "/v1/images/generations"
		default:
			requestURL = "/v1/chat/completions"
		}
	}

	return fmt.Sprintf("%s%s", strings.TrimRight(baseURL, "/"), requestURL), nil
}

// SetupRequestHeader sets up the request headers for Agnes AI API
func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	hasAuthOverride := false
	header := *req
	for k := range header {
		if strings.EqualFold(k, "Authorization") {
			hasAuthOverride = true
			break
		}
	}
	if !hasAuthOverride {
		header.Set("Authorization", "Bearer "+info.ApiKey)
	}
	header.Set("Content-Type", "application/json")
	header.Set("Accept", "application/json")
	return nil
}

// normalizeRequestBody 在 pass-through 模式下规范化请求体中的模型名称
// Agnes AI API 要求模型名称使用小写
func normalizeRequestBody(requestBody io.Reader, info *relaycommon.RelayInfo) (io.Reader, error) {
	if info == nil || info.UpstreamModelName == "" {
		return requestBody, nil
	}

	// 检查是否需要进行大小写转换
	normalizedModel := strings.ToLower(info.UpstreamModelName)
	if info.UpstreamModelName == normalizedModel {
		// 模型名称已经是小写，不需要转换
		return requestBody, nil
	}

	// 读取原始请求体
	bodyBytes, err := io.ReadAll(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to read request body: %w", err)
	}

	// 解析 JSON
	var jsonData map[string]any
	if err := json.Unmarshal(bodyBytes, &jsonData); err != nil {
		// 如果解析失败，返回原始请求体
		logger.LogDebug(context.Background(), "[AGNESAI] Failed to parse request body as JSON: %v, skipping model name normalization", err)
		return bytes.NewReader(bodyBytes), nil
	}

	// 检查并替换 model 字段
	if model, ok := jsonData["model"].(string); ok {
		normalizedModel := strings.ToLower(model)
		if model != normalizedModel {
			logger.LogDebug(context.Background(), "[AGNESAI] Converting model name in pass-through mode: %s -> %s", model, normalizedModel)
			jsonData["model"] = normalizedModel
			info.UpstreamModelName = normalizedModel

			// 重新序列化为 JSON
			newBodyBytes, err := json.Marshal(jsonData)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal request body: %w", err)
			}

			return bytes.NewReader(newBodyBytes), nil
		}
	}

	// 不需要转换，返回原始请求体
	return bytes.NewReader(bodyBytes), nil
}

// ConvertOpenAIRequest converts the request for Agnes AI API
// Agnes AI requires lowercase model names
func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}

	// Convert model name to lowercase for Agnes AI API
	originalModel := request.Model
	normalizedModel := strings.ToLower(request.Model)
	if originalModel != normalizedModel {
		logger.LogDebug(c.Request.Context(), "[AGNESAI] Converting model name: %s -> %s", originalModel, normalizedModel)
		request.Model = normalizedModel
		info.UpstreamModelName = normalizedModel
	}

	return request, nil
}

// ConvertRerankRequest converts the request for Agnes AI rerank API
func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return request, nil
}

// ConvertEmbeddingRequest converts the request for Agnes AI embedding API
func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	// Convert model name to lowercase for Agnes AI API
	originalModel := request.Model
	normalizedModel := strings.ToLower(request.Model)
	if originalModel != normalizedModel {
		logger.LogDebug(c.Request.Context(), "[AGNESAI] Converting model name for embedding: %s -> %s", originalModel, normalizedModel)
		request.Model = normalizedModel
		info.UpstreamModelName = normalizedModel
	}
	return request, nil
}

// ConvertAudioRequest converts the request for Agnes AI audio API
func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	var requestBody bytes.Buffer
	writer := multipart.NewWriter(&requestBody)

	writer.WriteField("model", strings.ToLower(request.Model))

	formData, err := common.ParseMultipartFormReusable(c)
	if err != nil {
		return nil, fmt.Errorf("error parsing multipart form: %w", err)
	}

	for key, values := range formData.Value {
		for _, value := range values {
			writer.WriteField(key, value)
		}
	}

	writer.Close()
	return &requestBody, nil
}

// ConvertImageRequest converts the request for Agnes AI image API
func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	// Agnes AI models (e.g. agnes-t2i-general-model) do not support response_format parameter.
	// Remove it to avoid 400 Bad Request errors.
	request.ResponseFormat = ""

	// Convert model name to lowercase for Agnes AI API (if applicable)
	return request, nil
}

// ConvertOpenAIResponsesRequest converts the request for Agnes AI responses API
func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	// Convert model name to lowercase for Agnes AI API
	if request.Model != "" {
		originalModel := request.Model
		normalizedModel := strings.ToLower(request.Model)
		if originalModel != normalizedModel {
			logger.LogDebug(c.Request.Context(), "[AGNESAI] Converting model name for responses: %s -> %s", originalModel, normalizedModel)
			request.Model = normalizedModel
			info.UpstreamModelName = normalizedModel
		}
	}
	return request, nil
}

// DoRequest sends the HTTP request to Agnes AI API
func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	if info.RelayMode == relayconstant.RelayModeAudioTranscription ||
		info.RelayMode == relayconstant.RelayModeAudioTranslation ||
		info.RelayMode == relayconstant.RelayModeImagesEdits {
		return channel.DoFormRequest(a, c, info, requestBody)
	} else {
		// 在 pass-through 模式下，需要规范化请求体中的模型名称
		normalizedBody, err := normalizeRequestBody(requestBody, info)
		if err != nil {
			logger.LogError(c.Request.Context(), fmt.Sprintf("[AGNESAI] Failed to normalize request body: %v", err))
			// 如果规范化失败，使用原始请求体
			normalizedBody = requestBody
		}
		return channel.DoApiRequest(a, c, info, normalizedBody)
	}
}

// DoResponse processes the HTTP response from Agnes AI API
func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	if info.IsStream {
		usage, err = openai.OaiStreamHandler(c, info, resp)
	} else {
		usage, err = openai.OpenaiHandler(c, info, resp)
	}
	return
}

// GetModelList returns the list of supported models
func (a *Adaptor) GetModelList() []string {
	return nil // Agnes AI model list is dynamic
}

// GetChannelName returns the channel name
func (a *Adaptor) GetChannelName() string {
	return "AgnesAI"
}

// ConvertClaudeRequest is not supported for Agnes AI
func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	return nil, errors.New("Claude API is not supported for Agnes AI")
}

// ConvertGeminiRequest is not supported for Agnes AI
func (a *Adaptor) ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error) {
	return nil, errors.New("Gemini API is not supported for Agnes AI")
}
