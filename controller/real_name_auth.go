package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// RealNameAuthRequest 实名认证请求结构
type RealNameAuthRequest struct {
	AuthType               string `json:"auth_type"`
	Username               string `json:"username" validate:"max=20"`
	PersonICard            string `json:"person_icard" validate:"max=18"`
	CompanyName            string `json:"company_name" validate:"max=100"`
	USCC                   string `json:"uscc" validate:"max=20"`
	CompanyBusinessLicense string `json:"company_business_license"`
	CompanyContactPerson   string `json:"company_contact_person" validate:"max=100"`
	CompanyContactPhone    string `json:"company_contact_phone" validate:"max=11"`
	MediaUrl               string `json:"mediaUrl"`
}

// GetRealNameAuth 获取用户实名认证信息
func GetRealNameAuth(c *gin.Context) {
	userId := c.GetInt("id")

	auth, err := model.GetRealNameAuthByUserId(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    auth,
	})
}

// SubmitRealNameAuth 提交/更新实名认证信息
func SubmitRealNameAuth(c *gin.Context) {
	userId := c.GetInt("id")

	var req RealNameAuthRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	if err := common.Validate.Struct(&req); err != nil {
		logger.LogError(c, "实名认证参数错误: "+err.Error())
		common.ApiErrorI18n(c, i18n.MsgUserInputInvalid, map[string]any{"Error": err.Error()})
		return
	}

	// 验证认证类型
	if req.AuthType != model.PersonalAuth && req.AuthType != model.CompanyAuth {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的认证类型",
		})
		return
	}

	// 验证必填字段
	if req.AuthType == model.PersonalAuth {
		if req.Username == "" || req.PersonICard == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "请填写完整的个人认证信息",
			})
			return
		}
	} else {
		if req.Username == "" || req.CompanyName == "" || req.USCC == "" || req.CompanyBusinessLicense == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "请填写完整的企业认证信息",
			})
			return
		}
	}

	// 检查是否已有认证记录
	existing, err := model.GetRealNameAuthByUserId(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	now := common.GetTimestamp()

	if existing != nil {
		// 更新现有认证记录
		existing.AuthType = req.AuthType
		existing.Username = req.Username
		existing.PersonICard = req.PersonICard
		existing.CompanyName = req.CompanyName
		existing.CompanyUSCC = req.USCC
		// 这里存储medialUrl,营业执照的url地址
		existing.CompanyBusinessLicense = req.MediaUrl
		existing.CompanyContactPerson = req.CompanyContactPerson
		existing.CompanyContactPhone = req.CompanyContactPhone
		existing.Status = model.AuditPending
		existing.UpdatedAt = now

		if err := existing.Update(); err != nil {
			common.ApiError(c, err)
			return
		}
	} else {
		// 创建新的认证记录
		auth := &model.RealNameAuth{
			UserId:                 userId,
			AuthType:               req.AuthType,
			Username:               req.Username,
			PersonICard:            req.PersonICard,
			CompanyName:            req.CompanyName,
			CompanyUSCC:            req.USCC,
			CompanyBusinessLicense: req.MediaUrl,
			CompanyContactPerson:   req.CompanyContactPerson,
			CompanyContactPhone:    req.CompanyContactPhone,
			Status:                 model.AuditPending,
			CreatedAt:              now,
			UpdatedAt:              now,
		}

		if err := auth.Create(); err != nil {
			common.ApiError(c, err)
			return
		}
	}

	// 实名认证成功，赠送100万tokens, 100万tokens=2美元
	// todo 要改，赠送的额度要与充值的额度分级使用，赠送额度只能使用某些模型
	//common.QuotaPerUnit

	//usdExchangeRate := operation_setting.USDExchangeRate
	//if usdExchangeRate <= 0 {
	//	usdExchangeRate = 7.3 // 默认汇率
	//}
	//cnyMoney := 2 * usdExchangeRate
	//dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
	//quotaToAdd := int(decimal.NewFromFloat(cnyMoney).Div(decimal.NewFromFloat(usdExchangeRate)).Mul(dQuotaPerUnit).IntPart())
	//if err = model.IncreaseUserQuota(userId, quotaToAdd, true); err != nil {
	//	common.ApiError(c, err)
	//	return
	//}
	//logger.LogInfo(c, fmt.Sprintf("实名认证成功，赠送用户【%d】额度 %s", userId, logger.LogQuota(quotaToAdd)))
	//model.RecordLog(userId, model.LogTypeManage,
	//	fmt.Sprintf("实名认证成功，系统赠送用户【%d】额度 %s", userId, logger.LogQuota(quotaToAdd)))
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "提交成功，等待审核",
	})
}
