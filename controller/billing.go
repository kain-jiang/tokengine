package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// GetModelSummary 获取模型维度汇总
func GetModelSummary(c *gin.Context) {
	var req dto.BillingSummaryRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	userId := c.GetInt("id")
	data, err := service.GetBillingSummaryService().GetModelSummary(userId, req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, data)
}

// GetTokenSummary 获取令牌维度汇总
func GetTokenSummary(c *gin.Context) {
	var req dto.BillingSummaryRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	userId := c.GetInt("id")
	data, err := service.GetBillingSummaryService().GetTokenSummary(userId, req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, data)
}
