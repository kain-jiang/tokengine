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
// 供应商费率管理控制器
// ============================================

// GetAllSupplierPricings 获取所有费率配置
// @Summary 获取所有费率配置
// @Description 获取所有费率配置（分页）
// @Tags supplier
// @Accept json
// @Produce json
// @Param page query int false "页码"
// @Param page_size query int false "每页数量"
// @Success 200 {object} common.Result
// @Router /api/supplier/pricing [get]
// @Security ApiKeyAuth
func GetAllSupplierPricings(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	serviceInstance := service.GetSupplierPricingService()
	pricings, total, err := serviceInstance.GetAllPricings(pageInfo)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "success",
		"data":    pricings,
		"total":   total,
	})
}

// GetSupplierPricing 获取费率配置详情
// @Summary 获取费率配置详情
// @Description 根据ID获取费率配置详情
// @Tags supplier
// @Accept json
// @Produce json
// @Param id path int true "费率配置ID"
// @Success 200 {object} common.Result
// @Router /api/supplier/pricing/:id [get]
// @Security ApiKeyAuth
func GetSupplierPricing(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的ID"})
		return
	}

	serviceInstance := service.GetSupplierPricingService()
	pricing, err := serviceInstance.GetPricingById(id)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "success",
		"data":    pricing,
	})
}

// CreateSupplierPricing 创建费率配置
// @Summary 创建费率配置
// @Description 创建新的费率配置
// @Tags supplier
// @Accept json
// @Produce json
// @Param pricing body model.SupplierPricing true "费率配置数据"
// @Success 200 {object} common.Result
// @Router /api/supplier/pricing [post]
// @Security ApiKeyAuth
func CreateSupplierPricing(c *gin.Context) {
	var pricing model.SupplierPricing
	if err := c.ShouldBindJSON(&pricing); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "参数错误: " + err.Error()})
		return
	}

	serviceInstance := service.GetSupplierPricingService()
	if err := serviceInstance.CreatePricing(&pricing); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "创建成功",
		"data":    pricing,
	})
}

// UpdateSupplierPricing 更新费率配置
// @Summary 更新费率配置
// @Description 更新费率配置
// @Tags supplier
// @Accept json
// @Produce json
// @Param pricing body model.SupplierPricing true "费率配置数据"
// @Success 200 {object} common.Result
// @Router /api/supplier/pricing [put]
// @Security ApiKeyAuth
func UpdateSupplierPricing(c *gin.Context) {
	var pricing model.SupplierPricing
	if err := c.ShouldBindJSON(&pricing); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "参数错误: " + err.Error()})
		return
	}

	serviceInstance := service.GetSupplierPricingService()
	if err := serviceInstance.UpdatePricing(&pricing); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "更新成功",
	})
}

// DeleteSupplierPricing 删除费率配置
// @Summary 删除费率配置
// @Description 根据ID删除费率配置
// @Tags supplier
// @Accept json
// @Produce json
// @Param id path int true "费率配置ID"
// @Success 200 {object} common.Result
// @Router /api/supplier/pricing/:id [delete]
// @Security ApiKeyAuth
func DeleteSupplierPricing(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的ID"})
		return
	}

	serviceInstance := service.GetSupplierPricingService()
	if err := serviceInstance.DeletePricing(id); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "删除成功",
	})
}

// SearchSupplierPricings 搜索费率配置
// @Summary 搜索费率配置
// @Description 搜索费率配置
// @Tags supplier
// @Accept json
// @Produce json
// @Param keyword query string false "关键词"
// @Param vendor_id query int false "供应商ID"
// @Param model_id query int false "模型ID"
// @Param page query int false "页码"
// @Param page_size query int false "每页数量"
// @Success 200 {object} common.Result
// @Router /api/supplier/pricing/search [get]
// @Security ApiKeyAuth
func SearchSupplierPricings(c *gin.Context) {
	keyword := c.Query("keyword")
	vendorIdStr := c.Query("vendor_id")
	modelIdStr := c.Query("model_id")

	pageInfo := common.GetPageQuery(c)

	var vendorId, modelId int
	if vendorIdStr != "" {
		vendorId, _ = strconv.Atoi(vendorIdStr)
	}
	if modelIdStr != "" {
		modelId, _ = strconv.Atoi(modelIdStr)
	}

	serviceInstance := service.GetSupplierPricingService()
	pricings, total, err := serviceInstance.SearchPricings(keyword, vendorId, modelId, pageInfo)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "success",
		"data":    pricings,
		"total":   total,
	})
}

// ImportSupplierPricings 批量导入费率配置
// @Summary 批量导入费率配置
// @Description 从CSV文件批量导入费率配置
// @Tags supplier
// @Accept multipart/form-data
// @Produce json
// @Param file formData file true "CSV文件"
// @Param vendor_id query int true "供应商ID"
// @Success 200 {object} common.Result
// @Router /api/supplier/pricing/import [post]
// @Security ApiKeyAuth
func ImportSupplierPricings(c *gin.Context) {
	vendorIdStr := c.Query("vendor_id")
	if vendorIdStr == "" {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "供应商ID不能为空"})
		return
	}

	vendorId, err := strconv.Atoi(vendorIdStr)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的供应商ID"})
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "文件上传失败"})
		return
	}

	open, err := file.Open()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "文件读取失败"})
		return
	}
	defer open.Close()

	buf := make([]byte, 1024*1024) // 1MB
	count, err := open.Read(buf)
	if err != nil && err.Error() != "EOF" {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "文件读取失败"})
		return
	}

	serviceInstance := service.GetSupplierPricingService()
	successCount, failCount, importErr := serviceInstance.ImportPricingsFromCSV(vendorId, buf[:count])
	if importErr != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": importErr.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "导入完成",
		"data": gin.H{
			"success_count": successCount,
			"fail_count":    failCount,
		},
	})
}

// BatchUpdateSupplierPricings 批量更新费率配置
// @Summary 批量更新费率配置
// @Description 批量更新费率配置状态
// @Tags supplier
// @Accept json
// @Produce json
// @Param request body object true "批量更新请求"
// @Success 200 {object} common.Result
// @Router /api/supplier/pricing/batch [post]
// @Security ApiKeyAuth
func BatchUpdateSupplierPricings(c *gin.Context) {
	var request struct {
		Ids    []int  `json:"ids" binding:"required"`
		Status string `json:"status" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "参数错误"})
		return
	}

	for _, id := range request.Ids {
		pricing, err := model.GetSupplierPricingById(id)
		if err == nil {
			pricing.Status = request.Status
			pricing.Update()
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "批量更新成功",
	})
}
