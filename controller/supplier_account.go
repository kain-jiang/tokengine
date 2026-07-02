package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// ============================================
// 供应商账户管理控制器
// ============================================

// GetAllSupplierAccounts 获取所有账户
// @Summary 获取所有账户
// @Description 获取所有供应商账户（分页）
// @Tags supplier
// @Accept json
// @Produce json
// @Param keyword query string false "关键词"
// @Param status query string false "状态"
// @Param page query int false "页码"
// @Param page_size query int false "每页数量"
// @Success 200 {object} common.Result
// @Router /api/supplier/account [get]
// @Security ApiKeyAuth
func GetAllSupplierAccounts(c *gin.Context) {
	keyword := c.Query("keyword")
	status := c.Query("status")

	pageInfo := common.GetPageQuery(c)

	serviceInstance := service.GetSupplierAccountService()
	accounts, total, err := serviceInstance.SearchAccounts(keyword, status, pageInfo)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "success",
		"data":    accounts,
		"total":   total,
	})
}

// GetSupplierAccount 获取供应商账户
// @Summary 获取供应商账户
// @Description 根据供应商ID获取账户
// @Tags supplier
// @Accept json
// @Produce json
// @Param vendor_id path int true "供应商ID"
// @Success 200 {object} common.Result
// @Router /api/supplier/account/:vendor_id [get]
// @Security ApiKeyAuth
func GetSupplierAccount(c *gin.Context) {
	vendorId, err := strconv.Atoi(c.Param("vendor_id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的供应商ID"})
		return
	}

	serviceInstance := service.GetSupplierAccountService()
	account, err := serviceInstance.GetAccountByVendor(vendorId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "success",
		"data":    account,
	})
}

// RechargeSupplierAccount 充值
// @Summary 充值
// @Description 为供应商账户充值
// @Tags supplier
// @Accept json
// @Produce json
// @Param request body service.RechargeRequest true "充值请求"
// @Success 200 {object} common.Result
// @Router /api/supplier/account/recharge [post]
// @Security ApiKeyAuth
func RechargeSupplierAccount(c *gin.Context) {
	var request service.RechargeRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "参数错误"})
		return
	}

	userId := c.GetInt("id")
	serviceInstance := service.GetSupplierAccountService()
	err := serviceInstance.Recharge(request.Amount, request.VendorId, request.Method, userId, request.Remark)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "充值成功",
	})
}

// GetSupplierAccountStatistics 获取账户统计信息
// @Summary 获取账户统计信息
// @Description 获取供应商账户统计信息
// @Tags supplier
// @Accept json
// @Produce json
// @Param vendor_id path int true "供应商ID"
// @Success 200 {object} common.Result
// @Router /api/supplier/account/:vendor_id/statistics [get]
// @Security ApiKeyAuth
func GetSupplierAccountStatistics(c *gin.Context) {
	vendorId, err := strconv.Atoi(c.Param("vendor_id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的供应商ID"})
		return
	}

	serviceInstance := service.GetSupplierAccountService()
	stats, err := serviceInstance.GetAccountStatistics(vendorId)
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
