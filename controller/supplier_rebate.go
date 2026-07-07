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
// SupplierRebateController 供应商返点控制器
// ============================================

// GetSupplierSettlementList 获取供应商结算列表（聚合查询）
// @Summary 获取供应商结算列表（聚合查询）
// @Description 获取供应商结算列表，聚合多个表数据
// @Tags supplier
// @Accept json
// @Produce json
// @Param vendor_id query int false "供应商ID"
// @Param model_id query int false "模型ID"
// @Param status query string false "状态"
// @Param page query int false "页码"
// @Param page_size query int false "每页数量"
// @Success 200 {object} common.Result
// @Router /api/supplier/settlement/aggregation [get]
func GetSupplierSettlementList(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	vendorId, _ := strconv.Atoi(c.Query("vendor_id"))
	modelId, _ := strconv.Atoi(c.Query("model_id"))
	status := c.Query("status")

	pageInfo := &common.PageInfo{
		Page:     page,
		PageSize: pageSize,
	}

	list, total, err := service.GetSupplierSettlementAggregationService().GetSupplierSettlementList(pageInfo, vendorId, modelId, status)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "success",
		"data":    list,
		"total":   total,
	})
}

// GetRebateList 获取返点记录列表
// @Summary 获取返点记录列表
// @Description 获取供应商返点记录列表
// @Tags supplier
// @Accept json
// @Produce json
// @Param vendor_id query int false "供应商ID"
// @Param status query string false "状态"
// @Param page query int false "页码"
// @Param page_size query int false "每页数量"
// @Success 200 {object} common.Result
// @Router /api/supplier/rebates [get]
func GetRebateList(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	vendorId, _ := strconv.Atoi(c.Query("vendor_id"))
	status := c.Query("status")

	pageInfo := &common.PageInfo{
		Page:     page,
		PageSize: pageSize,
	}

	list, total, err := service.GetSupplierSettlementAggregationService().GetRebateList(pageInfo, vendorId, status)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "success",
		"data":    list,
		"total":   total,
	})
}

// GetRebateStatistics 获取返点统计
// @Summary 获取返点统计
// @Description 获取供应商返点统计信息
// @Tags supplier
// @Accept json
// @Produce json
// @Param vendor_id query int false "供应商ID"
// @Success 200 {object} common.Result
// @Router /api/supplier/rebates/statistics [get]
func GetRebateStatistics(c *gin.Context) {
	vendorId, _ := strconv.Atoi(c.Query("vendor_id"))

	stats, err := service.GetSupplierSettlementAggregationService().GetRebateStatistics(vendorId)
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

// CreateManualSettlement 手动创建供应商结算记录
// @Summary 手动创建供应商结算记录
// @Description 手动创建供应商结算记录
// @Tags supplier
// @Accept json
// @Produce json
// @Param request body object true "创建结算记录请求"
// @Success 200 {object} common.Result
// @Router /api/supplier/settlement/manual [post]
func CreateManualSettlement(c *gin.Context) {
	var req model.SupplierSettlement
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "参数错误"})
		return
	}

	err := service.GetSupplierSettlementAggregationService().CreateManualSettlement(&req)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "创建成功",
		"data":    req,
	})
}

// CreateManualRebate 手动创建返点记录
// @Summary 手动创建返点记录
// @Description 手动创建供应商返点记录
// @Tags supplier
// @Accept json
// @Produce json
// @Param request body object true "创建返点记录请求"
// @Success 200 {object} common.Result
// @Router /api/supplier/rebates [post]
func CreateManualRebate(c *gin.Context) {
	var req model.SupplierRebate
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "参数错误"})
		return
	}

	err := service.GetSupplierSettlementAggregationService().CreateManualRebate(&req)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "创建成功",
		"data":    req,
	})
}

// UpdateRebateStatus 更新返点记录状态
// @Summary 更新返点记录状态
// @Description 更新返点记录状态
// @Tags supplier
// @Accept json
// @Produce json
// @Param id path int true "返点记录ID"
// @Param request body object true "更新状态请求"
// @Success 200 {object} common.Result
// @Router /api/supplier/rebates/:id/status [put]
func UpdateRebateStatus(c *gin.Context) {
	rebateId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的ID"})
		return
	}

	var req struct {
		Status string `json:"status" binding:"required"`
		Remark string `json:"remark"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "参数错误"})
		return
	}

	err = service.GetSupplierSettlementAggregationService().UpdateRebateStatus(rebateId, req.Status, req.Remark)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "更新成功",
	})
}

// GetRebateById 获取返点记录详情
// @Summary 获取返点记录详情
// @Description 根据ID获取返点记录详情
// @Tags supplier
// @Accept json
// @Produce json
// @Param id path int true "返点记录ID"
// @Success 200 {object} common.Result
// @Router /api/supplier/rebates/:id [get]
func GetRebateById(c *gin.Context) {
	rebateId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的ID"})
		return
	}

	rebate, err := model.GetSupplierRebateById(rebateId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "success",
		"data":    rebate,
	})
}

// UpdateRebate 更新返点记录
// @Summary 更新返点记录
// @Description 更新返点记录
// @Tags supplier
// @Accept json
// @Produce json
// @Param id path int true "返点记录ID"
// @Param request body object true "更新返点记录请求"
// @Success 200 {object} common.Result
// @Router /api/supplier/rebates/:id [put]
func UpdateRebate(c *gin.Context) {
	rebateId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的ID"})
		return
	}

	var req model.SupplierRebate
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "参数错误"})
		return
	}

	req.Id = rebateId
	err = req.Update()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "更新成功",
	})
}

// DeleteRebate 删除返点记录
// @Summary 删除返点记录
// @Description 删除返点记录
// @Tags supplier
// @Accept json
// @Produce json
// @Param id path int true "返点记录ID"
// @Success 200 {object} common.Result
// @Router /api/supplier/rebates/:id [delete]
func DeleteRebate(c *gin.Context) {
	rebateId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的ID"})
		return
	}

	rebate, err := model.GetSupplierRebateById(rebateId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	err = rebate.Delete()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "删除成功",
	})
}

// ============================================
// 返点接口配置管理
// ============================================

// GetRebateConfigList 获取返点接口配置列表
// @Summary 获取返点接口配置列表
// @Description 获取供应商返点接口配置列表
// @Tags supplier
// @Accept json
// @Produce json
// @Param vendor_id query int false "供应商ID"
// @Param status query string false "状态"
// @Param page query int false "页码"
// @Param page_size query int false "每页数量"
// @Success 200 {object} common.Result
// @Router /api/supplier/rebate-configs [get]
func GetRebateConfigList(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	vendorId, _ := strconv.Atoi(c.Query("vendor_id"))
	status := c.Query("status")

	pageInfo := &common.PageInfo{
		Page:     page,
		PageSize: pageSize,
	}

	list, total, err := model.SearchRebateConfigs(vendorId, status, pageInfo)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "success",
		"data":    list,
		"total":   total,
	})
}

// CreateRebateConfig 创建返点接口配置
// @Summary 创建返点接口配置
// @Description 创建供应商返点接口配置
// @Tags supplier
// @Accept json
// @Produce json
// @Param request body object true "创建配置请求"
// @Success 200 {object} common.Result
// @Router /api/supplier/rebate-configs [post]
func CreateRebateConfig(c *gin.Context) {
	var req model.SupplierRebateConfig
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "参数错误"})
		return
	}

	err := req.Insert()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "创建成功",
		"data":    req,
	})
}

// UpdateRebateConfig 更新返点接口配置
// @Summary 更新返点接口配置
// @Description 更新供应商返点接口配置
// @Tags supplier
// @Accept json
// @Produce json
// @Param id path int true "配置ID"
// @Param request body object true "更新配置请求"
// @Success 200 {object} common.Result
// @Router /api/supplier/rebate-configs/:id [put]
func UpdateRebateConfig(c *gin.Context) {
	configId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的ID"})
		return
	}

	var req model.SupplierRebateConfig
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "参数错误"})
		return
	}

	req.Id = configId
	err = req.Update()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "更新成功",
	})
}

// DeleteRebateConfig 删除返点接口配置
// @Summary 删除返点接口配置
// @Description 删除供应商返点接口配置
// @Tags supplier
// @Accept json
// @Produce json
// @Param id path int true "配置ID"
// @Success 200 {object} common.Result
// @Router /api/supplier/rebate-configs/:id [delete]
func DeleteRebateConfig(c *gin.Context) {
	configId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的ID"})
		return
	}

	config, err := model.GetRebateConfigById(configId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	err = config.Delete()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "删除成功",
	})
}

// ToggleRebateConfig 启用/禁用返点接口配置
// @Summary 启用/禁用返点接口配置
// @Description 启用或禁用供应商返点接口配置
// @Tags supplier
// @Accept json
// @Produce json
// @Param id path int true "配置ID"
// @Param request body object true "启用状态请求"
// @Success 200 {object} common.Result
// @Router /api/supplier/rebate-configs/:id/toggle [put]
func ToggleRebateConfig(c *gin.Context) {
	configId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的ID"})
		return
	}

	var req struct {
		SyncEnabled int `json:"sync_enabled" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "参数错误"})
		return
	}

	config, err := model.GetRebateConfigById(configId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	config.SyncEnabled = req.SyncEnabled
	err = config.Update()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "更新成功",
	})
}

// ExportSupplierSettlementList 导出供应商结算列表
// @Summary 导出供应商结算列表
// @Description 导出供应商结算列表数据（用于CSV导出）
// @Tags supplier
// @Accept json
// @Produce json
// @Param vendor_id query int false "供应商ID"
// @Param model_id query int false "模型ID"
// @Param status query string false "状态"
// @Success 200 {object} common.Result
// @Router /api/supplier/settlement/export [get]
func ExportSupplierSettlementList(c *gin.Context) {
	vendorId, _ := strconv.Atoi(c.Query("vendor_id"))
	modelId, _ := strconv.Atoi(c.Query("model_id"))
	status := c.Query("status")

	items, err := service.GetSupplierSettlementAggregationService().ExportSupplierSettlementList(vendorId, modelId, status)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "success",
		"data":    items,
	})
}

// ExportRebateList 导出返点列表
// @Summary 导出返点列表
// @Description 导出返点列表数据（用于CSV导出）
// @Tags supplier
// @Accept json
// @Produce json
// @Param vendor_id query int false "供应商ID"
// @Param status query string false "状态"
// @Success 200 {object} common.Result
// @Router /api/supplier/rebates/export [get]
func ExportRebateList(c *gin.Context) {
	vendorId, _ := strconv.Atoi(c.Query("vendor_id"))
	status := c.Query("status")

	items, err := service.GetSupplierSettlementAggregationService().ExportRebateList(vendorId, status)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "success",
		"data":    items,
	})
}
