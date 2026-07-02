package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// ============================================
// 供应商充值记录控制器
// ============================================

// GetAllSupplierRecharges 获取所有充值记录
// @Summary 获取所有充值记录
// @Description 获取所有供应商充值记录（分页）
// @Tags supplier
// @Accept json
// @Produce json
// @Param vendor_id query int false "供应商ID"
// @Param status query string false "状态"
// @Param page query int false "页码"
// @Param page_size query int false "每页数量"
// @Success 200 {object} common.Result
// @Router /api/supplier/recharge [get]
// @Security ApiKeyAuth
func GetAllSupplierRecharges(c *gin.Context) {
	vendorIdStr := c.Query("vendor_id")
	status := c.Query("status")

	pageInfo := common.GetPageQuery(c)

	var vendorId int
	if vendorIdStr != "" {
		vendorId, _ = strconv.Atoi(vendorIdStr)
	}

	recharges, total, err := model.SearchSupplierRecharges(vendorId, status, pageInfo)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "success",
		"data":    recharges,
		"total":   total,
	})
}

// GetSupplierRecharge 获取充值记录详情
// @Summary 获取充值记录详情
// @Description 根据ID获取充值记录详情
// @Tags supplier
// @Accept json
// @Produce json
// @Param id path int true "充值记录ID"
// @Success 200 {object} common.Result
// @Router /api/supplier/recharge/:id [get]
// @Security ApiKeyAuth
func GetSupplierRecharge(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的ID"})
		return
	}

	recharge, err := model.GetSupplierRechargeById(id)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "success",
		"data":    recharge,
	})
}

// GetAllSupplierRechargesForVendor 获取指定供应商的充值记录
// @Summary 获取指定供应商的充值记录
// @Description 根据供应商ID获取充值记录
// @Tags supplier
// @Accept json
// @Produce json
// @Param vendor_id path int true "供应商ID"
// @Param page query int false "页码"
// @Param page_size query int false "每页数量"
// @Success 200 {object} common.Result
// @Router /api/supplier/recharge/vendor/:vendor_id [get]
// @Security ApiKeyAuth
func GetAllSupplierRechargesForVendor(c *gin.Context) {
	vendorId, err := strconv.Atoi(c.Param("vendor_id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的供应商ID"})
		return
	}

	pageInfo := common.GetPageQuery(c)

	recharges, total, err := model.GetRechargesByVendor(vendorId, pageInfo)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "success",
		"data":    recharges,
		"total":   total,
	})
}

// GetSupplierRechargeStatistics 获取充值统计
// @Summary 获取充值统计
// @Description 获取供应商充值统计信息
// @Tags supplier
// @Accept json
// @Produce json
// @Param vendor_id path int true "供应商ID"
// @Param start_time query int false "开始时间"
// @Param end_time query int false "结束时间"
// @Success 200 {object} common.Result
// @Router /api/supplier/recharge/:vendor_id/statistics [get]
// @Security ApiKeyAuth
func GetSupplierRechargeStatistics(c *gin.Context) {
	vendorId, err := strconv.Atoi(c.Param("vendor_id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的供应商ID"})
		return
	}

	startTimeStr := c.Query("start_time")
	endTimeStr := c.Query("end_time")

	var startTime, endTime int64
	if startTimeStr != "" {
		startTime, _ = strconv.ParseInt(startTimeStr, 10, 64)
	}
	if endTimeStr != "" {
		endTime, _ = strconv.ParseInt(endTimeStr, 10, 64)
	}

	totalAmount := model.GetTotalRechargeAmount(vendorId, startTime, endTime)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "success",
		"data": gin.H{
			"vendor_id":    vendorId,
			"total_amount": totalAmount,
			"start_time":   startTime,
			"end_time":     endTime,
		},
	})
}

// ExportSupplierRecharges 导出充值记录
// @Summary 导出充值记录
// @Description 导出充值记录为CSV文件
// @Tags supplier
// @Accept json
// @Produce json
// @Param vendor_id query int false "供应商ID"
// @Param status query string false "状态"
// @Success 200 {object} common.Result
// @Router /api/supplier/recharge/export [get]
// @Security ApiKeyAuth
func ExportSupplierRecharges(c *gin.Context) {
	vendorIdStr := c.Query("vendor_id")
	status := c.Query("status")

	var vendorId int
	if vendorIdStr != "" {
		vendorId, _ = strconv.Atoi(vendorIdStr)
	}

	recharges, err := model.SearchSupplierRechargesForExport(vendorId, status)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "success",
		"data":    recharges,
	})
}
