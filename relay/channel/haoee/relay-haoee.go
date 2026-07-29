package haoee

import (
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// geminiImageResponseHandler 将Gemini generateContent响应中的图像数据提取为OpenAI Image格式
func geminiImageResponseHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*dto.Usage, *types.NewAPIError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	service.CloseResponseBodyGracefully(resp)

	if common.DebugEnabled {
		println(string(responseBody))
	}

	var geminiResponse dto.GeminiChatResponse
	if err := common.Unmarshal(responseBody, &geminiResponse); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	if len(geminiResponse.Candidates) == 0 {
		return nil, types.NewOpenAIError(errors.New("no images generated"), types.ErrorCodeEmptyResponse, http.StatusInternalServerError)
	}

	// 获取用户请求的 response_format
	responseFormat := ""
	if req, ok := info.Request.(*dto.ImageRequest); ok {
		responseFormat = req.ResponseFormat
	}

	// 从candidates的parts中提取图像数据
	openAIResponse := dto.ImageResponse{
		Created: common.GetTimestamp(),
		Data:    make([]dto.ImageData, 0),
	}

	for _, candidate := range geminiResponse.Candidates {
		for _, part := range candidate.Content.Parts {
			if part.InlineData != nil && part.InlineData.Data != "" {
				if responseFormat == "url" {
					mimeType := part.InlineData.MimeType
					if mimeType == "" {
						mimeType = "image/png"
					}
					openAIResponse.Data = append(openAIResponse.Data, dto.ImageData{
						Url: fmt.Sprintf("data:%s;base64,%s", mimeType, part.InlineData.Data),
					})
				} else {
					openAIResponse.Data = append(openAIResponse.Data, dto.ImageData{
						B64Json: part.InlineData.Data,
					})
				}
			}
		}
	}

	if len(openAIResponse.Data) == 0 {
		return nil, types.NewOpenAIError(errors.New("no image data in response"), types.ErrorCodeEmptyResponse, http.StatusInternalServerError)
	}

	// 优先使用上游返回的真实 token 数据，回退到固定 258 tokens/张
	const imageTokens = 258
	imageCount := len(openAIResponse.Data)
	usage := &dto.Usage{
		PromptTokens:     imageTokens * imageCount,
		CompletionTokens: 0,
		TotalTokens:      imageTokens * imageCount,
	}
	if geminiResponse.UsageMetadata.TotalTokenCount > 0 {
		usage.PromptTokens = geminiResponse.UsageMetadata.PromptTokenCount
		usage.CompletionTokens = geminiResponse.UsageMetadata.CandidatesTokenCount
		usage.TotalTokens = geminiResponse.UsageMetadata.TotalTokenCount
	}

	openAIResponse.Usage = usage

	jsonResponse, err := common.Marshal(openAIResponse)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}

	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.WriteHeader(resp.StatusCode)
	_, _ = c.Writer.Write(jsonResponse)

	return usage, nil
}
