package controller

import (
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
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

// ExportModelSummary 导出模型维度汇总
func ExportModelSummary(c *gin.Context) {
	var req dto.BillingSummaryRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	userId := c.GetInt("id")

	// 验证日期范围（最大半年）
	if req.StartDate != "" && req.EndDate != "" {
		startTime, _ := time.Parse("2006-01-02", req.StartDate)
		endTime, _ := time.Parse("2006-01-02", req.EndDate)
		diffDays := int(endTime.Sub(startTime).Hours() / 24)
		if diffDays > 180 {
			common.ApiErrorMsg(c, "导出时间范围不能超过半年（180天）")
			return
		}
	}

	data, err := service.GetBillingSummaryService().GetModelSummary(userId, req)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// 生成 CSV
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=model_summary_%d.csv", time.Now().Unix()))

	// 添加 BOM 以支持 Excel 正确识别 UTF-8
	c.Writer.WriteString("\xef\xbb\xbf")

	// 写入表头
	c.Writer.WriteString("用户名,模型名称,调用次数,Token总数,消费金额\n")

	// 写入数据
	for _, item := range data.Items.([]dto.ModelSummaryItem) {
		c.Writer.WriteString(fmt.Sprintf("%s,%s,%d,%d,%.6f\n",
			item.Username,
			item.ModelName,
			item.RequestCount,
			item.TotalTokens,
			item.QuotaConsumed*operation_setting.USDExchangeRate,
		))
	}
}

// ExportTokenSummary 导出令牌维度汇总
func ExportTokenSummary(c *gin.Context) {
	var req dto.BillingSummaryRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	userId := c.GetInt("id")

	// 验证日期范围（最大半年）
	if req.StartDate != "" && req.EndDate != "" {
		startTime, _ := time.Parse("2006-01-02", req.StartDate)
		endTime, _ := time.Parse("2006-01-02", req.EndDate)
		diffDays := int(endTime.Sub(startTime).Hours() / 24)
		if diffDays > 180 {
			common.ApiErrorMsg(c, "导出时间范围不能超过半年（180天）")
			return
		}
	}

	data, err := service.GetBillingSummaryService().GetTokenSummary(userId, req)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// 生成 CSV
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=token_summary_%d.csv", time.Now().Unix()))

	// 添加 BOM 以支持 Excel 正确识别 UTF-8
	c.Writer.WriteString("\xef\xbb\xbf")

	// 写入表头
	c.Writer.WriteString("用户名,令牌名称,调用次数/用量,Token总数,消费金额\n")

	// 写入数据
	for _, item := range data.Items.([]dto.TokenSummaryItem) {
		c.Writer.WriteString(fmt.Sprintf("%s,%s,%d,%d,%.6f\n",
			item.Username,
			item.TokenName,
			item.RequestCount,
			item.TotalTokens,
			item.QuotaConsumed*operation_setting.USDExchangeRate,
		))
	}
}
