package controller

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

type zefengTokenResponse struct {
	AccessToken      string `json:"access_token"`
	IssuedTokenType  string `json:"issued_token_type"`
	TokenType        string `json:"token_type"`
	ExpiresIn        int    `json:"expires_in"`
	Scope            string `json:"scope"`
	Error            string `json:"error,omitempty"`
	ErrorDescription string `json:"error_description,omitempty"`
}

type zefengBindResponse struct {
	ChannelUserID    string `json:"channel_user_id"`
	UserID           int64  `json:"user_id"`
	MappingID        int64  `json:"mapping_id"`
	CreatedUser      bool   `json:"created_user"`
	CreatedMapping   bool   `json:"created_mapping"`
	Error            string `json:"error,omitempty"`
	ErrorDescription string `json:"error_description,omitempty"`
}

func GetZefengOAuthToken(c *gin.Context) {
	clientSecret := common.GetZefengClientSecret()
	if clientSecret == "" {
		common.ApiErrorMsg(c, "Zefeng OAuth is not configured: ZEFENG_CLIENT_SECRET is not set")
		return
	}

	clientID := common.GetZefengClientID()
	if clientID == "" {
		common.ApiErrorMsg(c, "Zefeng OAuth is not configured: ZEFENG_CLIENT_ID is not set")
		return
	}

	userID := c.GetInt("id")
	if userID == 0 {
		common.ApiErrorMsg(c, "User not authenticated")
		return
	}

	username := c.GetString("username")
	displayName := c.GetString("display_name")

	apiURL := common.GetZefengAPIURL()
	scope := common.GetZefengOAuthScope()
	httpClient := &http.Client{Timeout: 15 * time.Second}

	// v2 API 绑定接口要求 mobile 必填，使用固定手机号
	mobile := "13888888888"

	// Step 1: 绑定用户到 Carbot 平台 (幂等操作)
	bindBody, _ := common.Marshal(map[string]string{
		"channel_user_id":  fmt.Sprintf("%d", userID),
		"mobile":           mobile,
		"channel_username": username,
		"channel_nickname": displayName,
	})

	bindReq, err := http.NewRequest("POST", apiURL+"/oauth/channel_user/bind", bytes.NewReader(bindBody))
	if err != nil {
		common.ApiErrorMsg(c, "Failed to create bind request to Zefeng OAuth API")
		return
	}
	bindReq.SetBasicAuth(clientID, clientSecret)
	bindReq.Header.Set("Content-Type", "application/json")

	bindResp, err := httpClient.Do(bindReq)
	if err != nil {
		common.ApiErrorMsg(c, "Failed to connect to Zefeng OAuth API for user binding: "+err.Error())
		return
	}
	bindRespBody, _ := io.ReadAll(bindResp.Body)
	bindResp.Body.Close()

	common.SysLog(fmt.Sprintf("Zefeng bind response: status=%d, body=%s", bindResp.StatusCode, string(bindRespBody)))

	var bindResult zefengBindResponse
	if err := common.Unmarshal(bindRespBody, &bindResult); err != nil {
		common.ApiErrorMsg(c, "Failed to parse bind response from Zefeng OAuth API: "+err.Error())
		return
	}

	// 绑定接口 409 表示手机号冲突或 ID 冲突
	if bindResp.StatusCode != http.StatusOK {
		errMsg := bindResult.ErrorDescription
		if errMsg == "" {
			errMsg = bindResult.Error
		}
		if errMsg == "" {
			errMsg = fmt.Sprintf("Zefeng user bind API returned HTTP %d", bindResp.StatusCode)
		}
		common.ApiErrorMsg(c, errMsg)
		return
	}

	// Step 2: 获取登录令牌
	formData := url.Values{
		"grant_type":       {"client_credentials"},
		"channel_user_id":  {fmt.Sprintf("%d", userID)},
		"scope":            {scope},
		"channel_username": {username},
		"channel_nickname": {displayName},
	}

	tokenReq, err := http.NewRequest("POST", apiURL+"/oauth/token", strings.NewReader(formData.Encode()))
	if err != nil {
		common.ApiErrorMsg(c, "Failed to create token request to Zefeng OAuth API")
		return
	}

	tokenReq.SetBasicAuth(clientID, clientSecret)
	tokenReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	tokenResp, err := httpClient.Do(tokenReq)
	if err != nil {
		common.ApiErrorMsg(c, "Failed to connect to Zefeng OAuth API: "+err.Error())
		return
	}
	defer tokenResp.Body.Close()

	tokenBody, err := io.ReadAll(tokenResp.Body)
	if err != nil {
		common.ApiErrorMsg(c, "Failed to read response from Zefeng OAuth API")
		return
	}

	var tokenResult zefengTokenResponse
	if err := common.Unmarshal(tokenBody, &tokenResult); err != nil {
		common.ApiErrorMsg(c, "Failed to parse response from Zefeng OAuth API")
		return
	}

	if tokenResp.StatusCode != http.StatusOK || tokenResult.Error != "" {
		errMsg := tokenResult.ErrorDescription
		if errMsg == "" {
			errMsg = tokenResult.Error
		}
		if errMsg == "" {
			errMsg = fmt.Sprintf("Zefeng OAuth API returned HTTP %d", tokenResp.StatusCode)
		}
		common.ApiErrorMsg(c, errMsg)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"access_token": tokenResult.AccessToken,
			"expires_in":   tokenResult.ExpiresIn,
			"carbot_url":   common.GetZefengCarbotURL(),
		},
	})
}
