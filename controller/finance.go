package controller

import (
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// GetFinanceDashboard 获取财务概览数据
// @Summary 获取财务概览
// @Description 获取财务概览数据（管理员/用户）
// @Tags finance
// @Accept json
// @Produce json
// @Param start_date query string false "开始日期"
// @Param end_date query string false "结束日期"
// @Success 200 {object} dto.FinanceDashboardResponse
// @Router /finance/dashboard [get]
// @Security ApiKeyAuth
func GetFinanceDashboard(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "未登录"})
		return
	}
	isAdmin := model.IsAdmin(userId)

	var req dto.FinanceDashboardRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	serviceInstance := service.GetFinanceService()
	response, err := serviceInstance.GetFinanceDashboard(userId, isAdmin, req)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": response})
}

// GetOrders 获取订单列表
// @Summary 获取订单列表
// @Description 获取订单列表（管理员/用户）
// @Tags finance
// @Accept json
// @Produce json
// @Param start_date query string false "开始日期"
// @Param end_date query string false "结束日期"
// @Param status query string false "状态"
// @Param payment_method query string false "支付方式"
// @Param keyword query string false "关键词"
// @Param page query int false "页码"
// @Param page_size query int false "每页数量"
// @Success 200 {object} dto.OrderListResponse
// @Router /finance/orders [get]
// @Security ApiKeyAuth
func GetOrders(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "未登录"})
		return
	}
	isAdmin := model.IsAdmin(userId)

	var req dto.OrderListRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	pageInfo := common.GetPageQuery(c)

	serviceInstance := service.GetFinanceService()
	items, total, err := serviceInstance.GetOrders(userId, isAdmin, req, pageInfo)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": dto.OrderListResponse{
			Total: total,
			Items: items,
		},
	})
}

// ExportOrders 导出订单CSV
// @Summary 导出订单CSV
// @Description 导出订单CSV文件
// @Tags finance
// @Accept json
// @Produce json
// @Param start_date query string false "开始日期"
// @Param end_date query string false "结束日期"
// @Param status query string false "状态"
// @Param payment_method query string false "支付方式"
// @Param keyword query string false "关键词"
// @Success 200 {object} object
// @Router /finance/orders/export [get]
// @Security ApiKeyAuth
func ExportOrders(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "未登录"})
		return
	}
	isAdmin := model.IsAdmin(userId)

	var req dto.OrderListRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	serviceInstance := service.GetFinanceService()
	items, err := serviceInstance.ExportOrders(userId, isAdmin, req)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", "attachment; filename=orders_"+time.Now().Format("20060102150405")+".csv")
	c.JSON(http.StatusOK, gin.H{"success": true, "data": items})
}

// GetRevenueReports 获取营收报表
// @Summary 获取营收报表
// @Description 获取营收报表列表
// @Tags finance
// @Accept json
// @Produce json
// @Param report_type query string false "报表类型"
// @Param start_date query string false "开始日期"
// @Param end_date query string false "结束日期"
// @Param page query int false "页码"
// @Param page_size query int false "每页数量"
// @Success 200 {object} object
// @Router /finance/reports [get]
// @Security ApiKeyAuth
func GetRevenueReports(c *gin.Context) {
	var req dto.RevenueReportRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	pageInfo := common.GetPageQuery(c)

	serviceInstance := service.GetFinanceService()
	reports, total, err := serviceInstance.GetRevenueReports(req, pageInfo)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    reports,
		"total":   total,
	})
}

// GetRevenueTrend 获取营收趋势
// @Summary 获取营收趋势
// @Description 获取营收趋势数据
// @Tags finance
// @Accept json
// @Produce json
// @Param days query int false "天数"
// @Success 200 {object} object
// @Router /finance/trend [get]
// @Security ApiKeyAuth
func GetRevenueTrend(c *gin.Context) {
	days, _ := strconv.Atoi(c.DefaultQuery("days", "30"))

	serviceInstance := service.GetFinanceService()
	trend, err := serviceInstance.GetRevenueTrend(days)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": trend})
}

// ApplyInvoice 申请发票
// @Summary 申请发票
// @Description 申请发票
// @Tags finance
// @Accept json
// @Produce json
// @Param body body dto.InvoiceApplyRequest true "发票申请信息"
// @Success 200 {object} object
// @Router /finance/invoice [post]
// @Security ApiKeyAuth
func ApplyInvoice(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "未登录"})
		return
	}
	username := c.GetString("username")

	var req dto.InvoiceApplyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	serviceInstance := service.GetFinanceService()
	invoice, err := serviceInstance.ApplyInvoice(userId, username, req)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": invoice})
}

// GetInvoices 获取发票列表
// @Summary 获取发票列表
// @Description 获取发票列表（管理员/用户）
// @Tags finance
// @Accept json
// @Produce json
// @Param status query string false "状态"
// @Param start_date query string false "开始日期"
// @Param end_date query string false "结束日期"
// @Param keyword query string false "关键词"
// @Param page query int false "页码"
// @Param page_size query int false "每页数量"
// @Success 200 {object} object
// @Router /finance/invoices [get]
// @Security ApiKeyAuth
func GetInvoices(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "未登录"})
		return
	}
	isAdmin := model.IsAdmin(userId)

	var req dto.InvoiceListRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	pageInfo := common.GetPageQuery(c)

	serviceInstance := service.GetFinanceService()

	if isAdmin {
		items, total, err := serviceInstance.GetAllInvoices(req, pageInfo)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "data": items, "total": total})
	} else {
		items, total, err := serviceInstance.GetUserInvoices(userId, req, pageInfo)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "data": items, "total": total})
	}
}

// ApproveInvoice 审批发票（管理员）
// @Summary 审批发票
// @Description 审批发票（管理员）
// @Tags finance
// @Accept json
// @Produce json
// @Param id path int true "发票ID"
// @Param body body dto.InvoiceUpdateRequest true "发票更新信息"
// @Success 200 {object} object
// @Router /finance/invoice/:id [put]
// @Security ApiKeyAuth
func ApproveInvoice(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "未登录"})
		return
	}

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的ID"})
		return
	}

	var req dto.InvoiceUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	serviceInstance := service.GetFinanceService()
	err = serviceInstance.ApproveInvoice(id, req.Status, userId, req.Remark)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// GetReconciliations 获取对账记录列表（管理员）
// @Summary 获取对账记录列表
// @Description 获取对账记录列表（管理员）
// @Tags finance
// @Accept json
// @Produce json
// @Param type query string false "对账类型"
// @Param period query string false "周期"
// @Param status query string false "状态"
// @Param page query int false "页码"
// @Param page_size query int false "每页数量"
// @Success 200 {object} object
// @Router /finance/reconciliations [get]
// @Security ApiKeyAuth
func GetReconciliations(c *gin.Context) {
	var req dto.ReconciliationListRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	// TODO: 实现 GetReconciliations 方法
	c.JSON(http.StatusOK, gin.H{"success": true, "data": []interface{}{}, "total": 0})
}

// AutoReconcile 自动对账（管理员）
// @Summary 自动对账
// @Description 自动对账（管理员）
// @Tags finance
// @Accept json
// @Produce json
// @Param body body dto.AutoReconciliationRequest true "对账请求"
// @Success 200 {object} object
// @Router /finance/reconcile [post]
// @Security ApiKeyAuth
func AutoReconcile(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "未登录"})
		return
	}
	if !model.IsAdmin(userId) {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "权限不足"})
		return
	}

	var req dto.AutoReconciliationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	serviceInstance := service.GetFinanceService()
	rec, err := serviceInstance.AutoReconcileDownstream(req.Period)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": rec})
}

// GenerateDailyReport 生成日营收报表（管理员）
// @Summary 生成日营收报表
// @Description 生成日营收报表（管理员）
// @Tags finance
// @Accept json
// @Produce json
// @Param date query string false "日期"
// @Success 200 {object} object
// @Router /finance/report/daily [post]
// @Security ApiKeyAuth
func GenerateDailyReport(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "未登录"})
		return
	}
	if !model.IsAdmin(userId) {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "权限不足"})
		return
	}

	dateStr := c.DefaultQuery("date", time.Now().Format("2006-01-02"))
	date, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的日期格式"})
		return
	}

	serviceInstance := service.GetFinanceService()
	report, err := serviceInstance.GenerateDailyRevenueReport(date)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": report})
}
