package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// ============================================
// 供应商结算管理控制器
// ============================================

// GetAllSupplierSettlements 获取所有结算单
// @Summary 获取所有结算单
// @Description 获取所有结算单（分页）
// @Tags supplier
// @Accept json
// @Produce json
// @Param vendor_id query int false "供应商ID"
// @Param period query string false "结算周期"
// @Param status query string false "状态"
// @Param page query int false "页码"
// @Param page_size query int false "每页数量"
// @Success 200 {object} common.Result
// @Router /api/supplier/settlement [get]
// @Security ApiKeyAuth
func GetAllSupplierSettlements(c *gin.Context) {
	vendorIdStr := c.Query("vendor_id")
	period := c.Query("period")
	status := c.Query("status")

	pageInfo := common.GetPageQuery(c)

	var vendorId int
	if vendorIdStr != "" {
		vendorId, _ = strconv.Atoi(vendorIdStr)
	}

	serviceInstance := service.GetSupplierSettlementService()
	settlements, total, err := serviceInstance.SearchSupplierSettlements(vendorId, period, status, pageInfo)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "success",
		"data":    settlements,
		"total":   total,
	})
}

// GetSupplierSettlement 获取结算单详情
// @Summary 获取结算单详情
// @Description 根据ID获取结算单详情
// @Tags supplier
// @Accept json
// @Produce json
// @Param id path int true "结算单ID"
// @Success 200 {object} common.Result
// @Router /api/supplier/settlement/:id [get]
// @Security ApiKeyAuth
func GetSupplierSettlement(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的ID"})
		return
	}

	serviceInstance := service.GetSupplierSettlementService()
	settlement, err := serviceInstance.GetSettlementById(id)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "success",
		"data":    settlement,
	})
}

// GetSupplierSettlementDetails 获取结算单明细
// @Summary 获取结算单明细
// @Description 根据结算单ID获取明细
// @Tags supplier
// @Accept json
// @Produce json
// @Param id path int true "结算单ID"
// @Success 200 {object} common.Result
// @Router /api/supplier/settlement/:id/details [get]
// @Security ApiKeyAuth
func GetSupplierSettlementDetails(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的ID"})
		return
	}

	serviceInstance := service.GetSupplierSettlementService()
	details, err := serviceInstance.GetSettlementDetails(id)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "success",
		"data":    details,
	})
}

// GenerateSupplierSettlement 生成结算单
// @Summary 生成结算单
// @Description 为指定供应商生成结算单
// @Tags supplier
// @Accept json
// @Produce json
// @Param request body object true "生成结算单请求"
// @Success 200 {object} common.Result
// @Router /api/supplier/settlement/generate [post]
// @Security ApiKeyAuth
func GenerateSupplierSettlement(c *gin.Context) {
	var request struct {
		VendorId   int    `json:"vendor_id" binding:"required"`
		Period     string `json:"period" binding:"required"`
		PeriodType string `json:"period_type"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "参数错误"})
		return
	}

	if request.PeriodType == "" {
		request.PeriodType = model.PeriodTypeMonthly
	}

	userId := c.GetInt("id")
	serviceInstance := service.GetSupplierSettlementService()
	settlement, err := serviceInstance.GenerateSettlement(request.VendorId, request.Period, request.PeriodType, userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "生成成功",
		"data":    settlement,
	})
}

// GenerateAllSupplierSettlements 批量生成结算单
// @Summary 批量生成结算单
// @Description 为所有供应商生成结算单
// @Tags supplier
// @Accept json
// @Produce json
// @Param request body object true "批量生成请求"
// @Success 200 {object} common.Result
// @Router /api/supplier/settlement/generate-all [post]
// @Security ApiKeyAuth
func GenerateAllSupplierSettlements(c *gin.Context) {
	var request struct {
		Period     string `json:"period" binding:"required"`
		PeriodType string `json:"period_type"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "参数错误"})
		return
	}

	if request.PeriodType == "" {
		request.PeriodType = model.PeriodTypeMonthly
	}

	serviceInstance := service.GetSupplierSettlementService()
	err := serviceInstance.GenerateAllSettlements(request.Period, request.PeriodType)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "批量生成成功",
	})
}

// ConfirmSupplierSettlement 确认结算单
// @Summary 确认结算单
// @Description 确认结算单
// @Tags supplier
// @Accept json
// @Produce json
// @Param id path int true "结算单ID"
// @Success 200 {object} common.Result
// @Router /api/supplier/settlement/:id/confirm [put]
// @Security ApiKeyAuth
func ConfirmSupplierSettlement(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的ID"})
		return
	}

	userId := c.GetInt("id")
	serviceInstance := service.GetSupplierSettlementService()
	err = serviceInstance.ConfirmSettlement(id, userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "确认成功",
	})
}

// MarkSupplierSettlementPaid 标记已付款
// @Summary 标记已付款
// @Description 标记结算单为已付款
// @Tags supplier
// @Accept json
// @Produce json
// @Param id path int true "结算单ID"
// @Success 200 {object} common.Result
// @Router /api/supplier/settlement/:id/paid [put]
// @Security ApiKeyAuth
func MarkSupplierSettlementPaid(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的ID"})
		return
	}

	userId := c.GetInt("id")
	serviceInstance := service.GetSupplierSettlementService()
	err = serviceInstance.MarkAsPaid(id, userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "标记成功",
	})
}

// CancelSupplierSettlement 取消结算单
// @Summary 取消结算单
// @Description 取消结算单
// @Tags supplier
// @Accept json
// @Produce json
// @Param id path int true "结算单ID"
// @Success 200 {object} common.Result
// @Router /api/supplier/settlement/:id/cancel [put]
// @Security ApiKeyAuth
func CancelSupplierSettlement(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的ID"})
		return
	}

	userId := c.GetInt("id")
	serviceInstance := service.GetSupplierSettlementService()
	err = serviceInstance.CancelSettlement(id, userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "取消成功",
	})
}

// SearchSupplierSettlements 搜索结算单
// @Summary 搜索结算单
// @Description 搜索结算单（分页）
// @Tags supplier
// @Accept json
// @Produce json
// @Param vendor_id query int false "供应商ID"
// @Param period query string false "结算周期"
// @Param status query string false "状态"
// @Param page query int false "页码"
// @Param page_size query int false "每页数量"
// @Success 200 {object} common.Result
// @Router /api/supplier/settlement/search [get]
// @Security ApiKeyAuth
func SearchSupplierSettlements(c *gin.Context) {
	vendorIdStr := c.Query("vendor_id")
	period := c.Query("period")
	status := c.Query("status")

	pageInfo := common.GetPageQuery(c)

	var vendorId int
	if vendorIdStr != "" {
		vendorId, _ = strconv.Atoi(vendorIdStr)
	}

	serviceInstance := service.GetSupplierSettlementService()
	settlements, total, err := serviceInstance.SearchSupplierSettlements(vendorId, period, status, pageInfo)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "success",
		"data":    settlements,
		"total":   total,
	})
}

// ExportSupplierSettlements 导出结算单
// @Summary 导出结算单
// @Description 导出结算单为CSV文件
// @Tags supplier
// @Accept json
// @Produce json
// @Param vendor_id query int false "供应商ID"
// @Param period query string false "结算周期"
// @Param status query string false "状态"
// @Success 200 {object} common.Result
// @Router /api/supplier/settlement/export [get]
// @Security ApiKeyAuth
func ExportSupplierSettlements(c *gin.Context) {
	vendorIdStr := c.Query("vendor_id")
	period := c.Query("period")
	status := c.Query("status")

	var vendorId int
	if vendorIdStr != "" {
		vendorId, _ = strconv.Atoi(vendorIdStr)
	}

	serviceInstance := service.GetSupplierSettlementService()
	settlements, err := serviceInstance.SearchSupplierSettlementsForExport(vendorId, period, status)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "success",
		"data":    settlements,
	})
}

// GetSupplierSettlementStatistics 获取结算统计
// @Summary 获取结算统计
// @Description 获取供应商结算统计信息
// @Tags supplier
// @Accept json
// @Produce json
// @Param vendor_id query int false "供应商ID"
// @Success 200 {object} common.Result
// @Router /api/supplier/settlement/statistics [get]
// @Security ApiKeyAuth
func GetSupplierSettlementStatistics(c *gin.Context) {
	vendorIdStr := c.Query("vendor_id")

	var vendorId int
	if vendorIdStr != "" {
		vendorId, _ = strconv.Atoi(vendorIdStr)
	}

	serviceInstance := service.GetSupplierSettlementService()
	stats, err := serviceInstance.GetSettlementStatistics(vendorId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "success",
		"data":    stats,
	})
}
