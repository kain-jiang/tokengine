package controller

import (
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

	// 无手机号流程：直接调用 Token 接口，Carbot 会在首次请求时自动注册平台用户并建立渠道用户映射。
	// 后续使用相同 channel_user_id 会复用同一平台用户，不会重复注册。
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
