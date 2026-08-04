package haoee

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/gemini"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

type Adaptor struct {
}

func isGeminiImageModel(modelName string) bool {
	return strings.HasPrefix(modelName, "gemini-") && strings.Contains(modelName, "image")
}

// geminiImageUrlMap 定义 Gemini 图像生成模型到 URL 路径中模型名的映射
// 规则：-lite 后缀模型在 URL 中去掉 -lite，使用基础模型名
var geminiImageUrlMap = map[string]string{
	"gemini-3-pro-image-preview-lite":     "gemini-3-pro-image-preview",
	"gemini-3.1-flash-image-preview-lite": "gemini-3.1-flash-image-preview",
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	baseURL := info.ChannelBaseUrl
	if baseURL == "" {
		baseURL = "https://maas.haoee.com"
	}

	// Gemini图像生成模型使用原生 :generateContent 接口
	if isGeminiImageModel(info.UpstreamModelName) || model_setting.IsGeminiModelSupportImagine(info.UpstreamModelName) {
		action := "generateContent"
		if info.IsStream {
			action = "streamGenerateContent?alt=sse"
		}
		// -lite 后缀模型在 URL 路径中去掉 -lite（上游 API 规则）
		urlModelName := info.UpstreamModelName
		if mapped, ok := geminiImageUrlMap[info.UpstreamModelName]; ok {
			urlModelName = mapped
		}
		return fmt.Sprintf("%s/v1beta/models/%s:%s", strings.TrimRight(baseURL, "/"), urlModelName, action), nil
	}

	requestURL := info.RequestURLPath
	if requestURL == "" {
		switch info.RelayMode {
		case relayconstant.RelayModeChatCompletions:
			requestURL = "/v1/chat/completions"
		case relayconstant.RelayModeImagesGenerations:
			requestURL = "/v1/images/generations"
		case relayconstant.RelayModeEmbeddings:
			requestURL = "/v1/embeddings"
		default:
			requestURL = "/v1/chat/completions"
		}
	}

	return fmt.Sprintf("%s%s", strings.TrimRight(baseURL, "/"), requestURL), nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)
	req.Set("Authorization", info.ApiKey)
	// Gemini图像生成模型需要 ModelName header
	if isGeminiImageModel(info.UpstreamModelName) || model_setting.IsGeminiModelSupportImagine(info.UpstreamModelName) {
		req.Set("ModelName", info.UpstreamModelName)
	}
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}

	// Gemini图像生成模型需要转换为Gemini原生格式
	if isGeminiImageModel(info.UpstreamModelName) || model_setting.IsGeminiModelSupportImagine(info.UpstreamModelName) {
		return gemini.CovertOpenAI2Gemini(c, *request, info)
	}

	return request, nil
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return request, nil
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return request, nil
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	// Gemini图像生成模型需要转换为Gemini原生 generateContent 格式
	if isGeminiImageModel(info.UpstreamModelName) || model_setting.IsGeminiModelSupportImagine(info.UpstreamModelName) {
		geminiRequest := &dto.GeminiChatRequest{
			Contents: []dto.GeminiChatContent{
				{
					Role: "user",
					Parts: []dto.GeminiPart{
						{
							Text: request.Prompt,
						},
					},
				},
			},
			GenerationConfig: dto.GeminiChatGenerationConfig{
				ResponseModalities: []string{"TEXT", "IMAGE"},
			},
		}

		// imageConfig 为上游必需字段，必须包含 imageSize
		aspectRatio := "1:1"
		imageSize := "1K"
		if request.Size != "" {
			if strings.Contains(request.Size, ":") {
				aspectRatio = request.Size
			} else {
				switch request.Size {
				case "256x256", "512x512", "1024x1024":
					aspectRatio = "1:1"
				case "1536x1024":
					aspectRatio = "3:2"
				case "1024x1536":
					aspectRatio = "2:3"
				case "1024x1792":
					aspectRatio = "9:16"
				case "1792x1024":
					aspectRatio = "16:9"
				}
			}
		}
		// quality 参数映射到 imageSize
		switch request.Quality {
		case "hd":
			imageSize = "2K"
		case "4K", "4k":
			imageSize = "4K"
		case "2K", "2k":
			imageSize = "2K"
		case "512":
			imageSize = "512"
		case "standard", "":
			imageSize = "1K"
		default:
			imageSize = request.Quality
		}
		imageConfig := map[string]interface{}{
			"aspectRatio": aspectRatio,
			"imageSize":   imageSize,
		}
		imageConfigBytes, err := common.Marshal(imageConfig)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal imageConfig: %w", err)
		}
		geminiRequest.GenerationConfig.ImageConfig = imageConfigBytes

		// 处理 n 参数
		if request.N != nil && *request.N > 1 {
			geminiRequest.GenerationConfig.CandidateCount = common.GetPointer(int(*request.N))
		}

		return geminiRequest, nil
	}

	// 非Gemini图像模型（如gpt-image系列）：好易智算上游 /v1/images/generations
	// 不支持 watermark 参数（参考好易智算API文档 maas-api.haoee.com），
	// 透传会导致上游400错误 "got an unexpected keyword argument 'watermark'"。
	// 此处剥离 watermark 字段，避免影响上游调用。
	// 注意：仅影响 haoee 渠道，不影响其他 adaptor；Gemini 路径已在上方分支提前返回。
	request.Watermark = nil

	// 好易智算 gpt-image 系列 quality 仅支持 low/medium/high/auto（默认 auto），
	// 不支持 OpenAI DALL-E 标准的 standard/hd，需做映射避免上游400 invalid_value。
	// 参考好易智算API文档：编辑 gpt-image-1.5 接口 quality 字段说明。
	switch request.Quality {
	case "standard":
		request.Quality = "medium"
	case "hd":
		request.Quality = "high"
	case "low", "medium", "high", "auto":
		// 上游原生支持的值，保持不变
	case "":
		request.Quality = "auto"
	default:
		// 未知值兜底为 auto，避免上游报错
		request.Quality = "auto"
	}

	return request, nil
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	return request, nil
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	// Gemini图像生成模型使用Gemini响应处理器
	if isGeminiImageModel(info.UpstreamModelName) || model_setting.IsGeminiModelSupportImagine(info.UpstreamModelName) {
		switch info.RelayMode {
		case relayconstant.RelayModeImagesGenerations:
			// 图像生成接口，将GeminiChatResponse中的inlineData提取为OpenAI Image格式
			usage, err = geminiImageResponseHandler(c, resp, info)
		case relayconstant.RelayModeGemini:
			// 原生Gemini模式，返回Gemini格式响应
			if info.IsStream {
				usage, err = gemini.GeminiTextGenerationStreamHandler(c, info, resp)
			} else {
				usage, err = gemini.GeminiTextGenerationHandler(c, info, resp)
			}
		default:
			// Chat兼容模式，将Gemini响应转换为OpenAI格式
			if info.IsStream {
				usage, err = gemini.GeminiChatStreamHandler(c, info, resp)
			} else {
				usage, err = gemini.GeminiChatHandler(c, info, resp)
			}
		}
		return
	}

	if info.IsStream {
		usage, err = openai.OaiStreamHandler(c, info, resp)
	} else {
		usage, err = openai.OpenaiHandler(c, info, resp)
	}
	return
}

func (a *Adaptor) GetModelList() []string {
	return nil
}

func (a *Adaptor) GetChannelName() string {
	return "Haoee"
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	return nil, errors.New("Claude API is not supported for Haoee")
}

func (a *Adaptor) ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}
	// Gemini原生请求直接透传
	return request, nil
}
