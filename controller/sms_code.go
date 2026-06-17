package controller

import (
	"encoding/json"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/gin-gonic/gin"
)

type Request struct {
	Telephone string `json:"telephone" validate:"required,len=11"`
}

// 发送短信验证码
func SendSmsCode(c *gin.Context) {
	var request Request
	err := json.NewDecoder(c.Request.Body).Decode(&request)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	err = common.Validate.Struct(request)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	if !common.IsSMSEnabled() {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "短信服务未配置，请联系管理员",
		})
		return
	}
	// 验证码已发送，请稍后再试
	if common.GetSMSCode(request.Telephone) != "" {
		common.ApiErrorMsg(c, "验证码已经发送，请稍后再试")
		return
	}
	code := common.GenerateSMSCode()

	err = common.SendSMS(request.Telephone, code)
	if err != nil {
		logger.LogError(c, "发送短信失败: "+err.Error())
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "短信发送失败: " + err.Error(),
		})
		return
	}

	common.RegisterSMSCodeWithKey(request.Telephone, code)

	logger.LogInfo(c, "短信验证码已发送至: "+request.Telephone)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "短信验证码已发送",
	})
	return
}
