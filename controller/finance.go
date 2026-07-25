package controller

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
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
	// 检查是否是财务运营人员
	if !model.IsFinanceAdmin(userId) {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无权限访问财务模块"})
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
	// 检查是否是财务运营人员
	if !model.IsFinanceAdmin(userId) {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无权限访问财务模块"})
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
	// 检查是否是财务运营人员
	if !model.IsFinanceAdmin(userId) {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无权限访问财务模块"})
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

// 获取营收分析用户列表
func GetRevenueReports(c *gin.Context) {
	userId := c.GetInt("id")
	// 检查是否是财务运营人员
	if !model.IsFinanceAdmin(userId) {
		common.ApiErrorMsg(c, "无权限访问财务模块")
		return
	}
	var req dto.UserRevenueListRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}

	pageInfo := common.GetPageQuery(c)

	serviceInstance := service.GetFinanceService()
	reports, total, stats, err := serviceInstance.GetUserRevenueReports(req, pageInfo)
	if err != nil {
		common.ApiErrorMsg(c, "获取用户数据失败")
		logger.LogError(c, fmt.Sprintf("获取营收分析用户列表数据失败，错误详情： %v", err))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    reports,
		"total":   total,
		"stats":   stats,
	})
}

// 导出营收分析用户列表
func ExportRevenueReports(c *gin.Context) {
	userId := c.GetInt("id")
	if !model.IsFinanceAdmin(userId) {
		common.ApiErrorMsg(c, "无权限访问财务模块")
		return
	}
	var req dto.UserRevenueListRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}

	serviceInstance := service.GetFinanceService()
	csvContent, err := serviceInstance.ExportUserRevenueReports(req)
	if err != nil {
		common.ApiErrorMsg(c, "导出用户数据失败")
		return
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=revenue_users_"+time.Now().Format("20060102150405")+".csv")
	c.Data(http.StatusOK, "text/csv; charset=utf-8", []byte(csvContent))
}

// GetRevenueTrend 获取营收趋势
// @Summary 获取营收趋势
// @Description 获取营收趋势数据（支持 user_id 查询指定用户）
// @Tags finance
// @Accept json
// @Produce json
// @Param days query int false "天数"
// @Param user_id query int false "用户ID"
// @Success 200 {object} object
// @Router /finance/trend [get]
// @Security ApiKeyAuth
func GetRevenueTrend(c *gin.Context) {
	userId := c.GetInt("id")
	// 检查是否是财务运营人员
	if !model.IsFinanceAdmin(userId) {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无权限访问财务模块"})
		return
	}
	days, _ := strconv.Atoi(c.DefaultQuery("days", "30"))
	targetUserId, _ := strconv.Atoi(c.Query("user_id"))

	serviceInstance := service.GetFinanceService()
	trend, err := serviceInstance.GetUserRevenueTrend(targetUserId, days)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": trend})
}

// 获取用户大屏详情数据
func GetUserRevenueDetail(c *gin.Context) {
	userId := c.GetInt("id")
	if !model.IsFinanceAdmin(userId) {
		common.ApiErrorMsg(c, "无权限访问财务模块")
		return
	}

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "无效的ID")
		return
	}

	var req dto.UserRevenueDetailRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}

	serviceInstance := service.GetFinanceService()
	detail, err := serviceInstance.GetUserRevenueDetail(id, req)
	if err != nil {
		common.ApiErrorMsg(c, "获取用户大屏详情数据失败")
		return
	}
	common.ApiSuccess(c, detail)
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
	// 检查是否是财务运营人员
	if !model.IsFinanceAdmin(userId) {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无权限访问财务模块"})
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

// 获取发票列表
func GetInvoices(c *gin.Context) {
	userId := c.GetInt("id")

	// 检查是否是财务运营人员
	if !model.IsFinanceAdmin(userId) {
		common.ApiErrorMsg(c, "无权限访问财务模块")
		return
	}
	var req dto.InvoiceListRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	pageInfo := common.GetPageQuery(c)

	serviceInstance := service.GetFinanceService()

	items, total, err := serviceInstance.GetAllInvoices(req, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

// 获取发票详情（管理员）
func GetInvoiceDetail(c *gin.Context) {
	userId := c.GetInt("id")
	if !model.IsFinanceAdmin(userId) {
		common.ApiErrorMsg(c, "无权限访问财务模块")
		return
	}
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "无效的ID")
		return
	}
	invoice, err := model.GetInvoiceRecordById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if invoice == nil {
		common.ApiErrorMsg(c, "发票不存在")
		return
	}
	var orderIds []int
	if invoice.OrderIds != "" {
		for _, idStr := range strings.Split(invoice.OrderIds, ",") {
			idStr = strings.TrimSpace(idStr)
			if idStr != "" {
				var orderId int
				if _, err := fmt.Sscanf(idStr, "%d", &orderId); err == nil {
					orderIds = append(orderIds, orderId)
				}
			}
		}
	}
	var orders []*model.TopUp
	if len(orderIds) > 0 {
		orders, err = model.GetTopUpListByIds(orderIds)
		if err != nil {
			common.ApiError(c, err)
			return
		}
	}
	var invoiceTitleInfo map[string]interface{}
	if invoice.InvoiceTitleInfo != "" {
		json.Unmarshal([]byte(invoice.InvoiceTitleInfo), &invoiceTitleInfo)
	}
	username, _ := model.GetUsernameById(invoice.UserId, false)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"id":                 invoice.Id,
			"user_id":            invoice.UserId,
			"username":           username,
			"amount":             invoice.Amount,
			"status":             invoice.Status,
			"invoice_type":       invoice.InvoiceType,
			"invoice_url":        invoice.InvoiceUrl,
			"remark":             invoice.Remark,
			"error_msg":          invoice.ErrorMsg,
			"created_at":         invoice.CreatedAt.Format("2006-01-02 15:04:05"),
			"invoice_title_info": invoiceTitleInfo,
			"orders":             orders,
		},
	})
}

// 更新发票（管理员）
func UpdateInvoice(c *gin.Context) {
	userId := c.GetInt("id")
	// 检查是否是财务运营人员
	if !model.IsFinanceAdmin(userId) {
		common.ApiErrorMsg(c, "无权限访问财务模块")
		return
	}

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "无效的ID")
		return
	}

	var req dto.InvoiceUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}

	serviceInstance := service.GetFinanceService()
	err = serviceInstance.ApproveInvoice(id, req.Status, req.Remark, req.InvoiceUrl)
	if err != nil {
		logger.LogError(c, fmt.Sprintf("更新发票失败，错误详情：%v", err.Error()))
		common.ApiErrorMsg(c, "发票状态更新失败")
		return
	}

	common.ApiSuccess(c, "发票状态更新成功")
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
	userId := c.GetInt("id")
	// 检查是否是财务运营人员
	if !model.IsFinanceAdmin(userId) {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无权限访问财务模块"})
		return
	}
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
	// 检查是否是财务运营人员
	if !model.IsFinanceAdmin(userId) {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无权限访问财务模块"})
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
	// 检查是否是财务运营人员
	if !model.IsFinanceAdmin(userId) {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无权限访问财务模块"})
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

// GetOrderStatistics 获取订单统计数据（用于 Orders 页面概览）
// @Summary 获取订单统计数据
// @Description 获取订单统计数据（有效充值金额、退款金额等）
// @Tags finance
// @Accept json
// @Produce json
// @Success 200 {object} object
// @Router /finance/orders/statistics [get]
// @Security ApiKeyAuth
func GetOrderStatistics(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "未登录"})
		return
	}
	// 检查是否是财务运营人员
	if !model.IsFinanceAdmin(userId) {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无权限访问财务模块"})
		return
	}
	isAdmin := model.IsAdmin(userId)

	serviceInstance := service.GetFinanceService()
	stats, err := serviceInstance.GetOrderStatistics(isAdmin, userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": stats})
}

// GetOrderChartStatistics 获取订单图表数据
// @Summary 获取订单图表数据
// @Description 获取订单图表数据（充值趋势和用户类型分布）
// @Tags finance
// @Accept json
// @Produce json
// @Param start_time query int false "开始时间戳"
// @Param end_time query int false "结束时间戳"
// @Param status query string false "状态"
// @Success 200 {object} dto.OrderChartStatistics
// @Router /finance/orders/chart-data [get]
// @Security ApiKeyAuth
func GetOrderChartStatistics(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "未登录"})
		return
	}
	if !model.IsFinanceAdmin(userId) {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无权限访问财务模块"})
		return
	}
	isAdmin := model.IsAdmin(userId)

	startTime, _ := strconv.ParseInt(c.Query("start_time"), 10, 64)
	endTime, _ := strconv.ParseInt(c.Query("end_time"), 10, 64)
	status := c.Query("status")

	serviceInstance := service.GetFinanceService()
	chartData, err := serviceInstance.GetOrderChartStatistics(isAdmin, userId, startTime, endTime, status)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": chartData})
}

// ============================================
// 财务运营概览（Dashboard）v3 API Handler
// ============================================

// GetDashboardStats 获取财务概览统计指标
func GetDashboardStats(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		common.ApiErrorMsg(c, "未登录")
		return
	}
	if !model.IsFinanceAdmin(userId) {
		common.ApiErrorMsg(c, "无权限访问财务模块")
		return
	}

	startTime, _ := strconv.ParseInt(c.Query("start_time"), 10, 64)
	endTime, _ := strconv.ParseInt(c.Query("end_time"), 10, 64)

	if startTime == 0 || endTime == 0 {
		common.ApiErrorMsg(c, "缺少时间参数")
		return
	}

	serviceInstance := service.GetFinanceService()
	stats, err := serviceInstance.GetDashboardStats(startTime, endTime)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": stats})
}

// GetUsersTrend 获取用户注册趋势
func GetUsersTrend(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		common.ApiErrorMsg(c, "未登录")
		return
	}
	if !model.IsFinanceAdmin(userId) {
		common.ApiErrorMsg(c, "无权限访问财务模块")
		return
	}

	startTime, _ := strconv.ParseInt(c.Query("start_time"), 10, 64)
	endTime, _ := strconv.ParseInt(c.Query("end_time"), 10, 64)

	if startTime == 0 || endTime == 0 {
		common.ApiErrorMsg(c, "缺少时间参数")
		return
	}

	serviceInstance := service.GetFinanceService()
	trend, err := serviceInstance.GetUsersTrend(startTime, endTime)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": trend})
}

// GetUsersAuthDistribution 获取用户认证分布
func GetUsersAuthDistribution(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		common.ApiErrorMsg(c, "未登录")
		return
	}
	if !model.IsFinanceAdmin(userId) {
		common.ApiErrorMsg(c, "无权限访问财务模块")
		return
	}

	serviceInstance := service.GetFinanceService()
	dist, err := serviceInstance.GetUsersAuthDistribution()
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": dist})
}

// GetTopupTrend 获取充值趋势
func GetTopupTrend(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		common.ApiErrorMsg(c, "未登录")
		return
	}
	if !model.IsFinanceAdmin(userId) {
		common.ApiErrorMsg(c, "无权限访问财务模块")
		return
	}

	startTime, _ := strconv.ParseInt(c.Query("start_time"), 10, 64)
	endTime, _ := strconv.ParseInt(c.Query("end_time"), 10, 64)

	if startTime == 0 || endTime == 0 {
		common.ApiErrorMsg(c, "缺少时间参数")
		return
	}

	serviceInstance := service.GetFinanceService()
	trend, err := serviceInstance.GetTopupTrend(startTime, endTime)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": trend})
}

// GetTopupUserTypeDistribution 获取用户充值分布
func GetTopupUserTypeDistribution(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		common.ApiErrorMsg(c, "未登录")
		return
	}
	if !model.IsFinanceAdmin(userId) {
		common.ApiErrorMsg(c, "无权限访问财务模块")
		return
	}

	startTime, _ := strconv.ParseInt(c.Query("start_time"), 10, 64)
	endTime, _ := strconv.ParseInt(c.Query("end_time"), 10, 64)

	if startTime == 0 || endTime == 0 {
		common.ApiErrorMsg(c, "缺少时间参数")
		return
	}

	serviceInstance := service.GetFinanceService()
	dist, err := serviceInstance.GetTopupUserTypeDistribution(startTime, endTime)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": dist})
}

// GetConsumptionTrend 获取消费趋势
func GetConsumptionTrend(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		common.ApiErrorMsg(c, "未登录")
		return
	}
	if !model.IsFinanceAdmin(userId) {
		common.ApiErrorMsg(c, "无权限访问财务模块")
		return
	}

	startTime, _ := strconv.ParseInt(c.Query("start_time"), 10, 64)
	endTime, _ := strconv.ParseInt(c.Query("end_time"), 10, 64)

	if startTime == 0 || endTime == 0 {
		common.ApiErrorMsg(c, "缺少时间参数")
		return
	}

	serviceInstance := service.GetFinanceService()
	trend, err := serviceInstance.GetConsumptionTrend(startTime, endTime)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": trend})
}

// GetPaymentModeTokensDistribution 获取付费方式Tokens分布
func GetPaymentModeTokensDistribution(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		common.ApiErrorMsg(c, "未登录")
		return
	}
	if !model.IsFinanceAdmin(userId) {
		common.ApiErrorMsg(c, "无权限访问财务模块")
		return
	}

	startTime, _ := strconv.ParseInt(c.Query("start_time"), 10, 64)
	endTime, _ := strconv.ParseInt(c.Query("end_time"), 10, 64)

	if startTime == 0 || endTime == 0 {
		common.ApiErrorMsg(c, "缺少时间参数")
		return
	}

	serviceInstance := service.GetFinanceService()
	dist, err := serviceInstance.GetPaymentModeTokensDistribution(startTime, endTime)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": dist})
}

// GetRevenueByUser 获取按用户维度的营收分析
func GetRevenueByUser(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		common.ApiErrorMsg(c, "未登录")
		return
	}
	if !model.IsFinanceAdmin(userId) {
		common.ApiErrorMsg(c, "无权限访问财务模块")
		return
	}

	startTime, _ := strconv.ParseInt(c.Query("start_time"), 10, 64)
	endTime, _ := strconv.ParseInt(c.Query("end_time"), 10, 64)

	if startTime == 0 || endTime == 0 {
		common.ApiErrorMsg(c, "缺少时间参数")
		return
	}

	pageInfo := common.GetPageQuery(c)

	serviceInstance := service.GetFinanceService()
	items, total, err := serviceInstance.GetRevenueByUser(startTime, endTime, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    items,
		"total":   total,
	})
}

// GetPayAsYouGoByUser 获取按量付费（消费记录）营收分析
// @Summary 获取按量付费营收分析
// @Tags finance
// @Param start_time query int true "开始时间戳"
// @Param end_time query int true "结束时间戳"
// @Param p query int false "页码"
// @Param page_size query int false "每页数量"
// @Success 200 {object} dto.PayAsYouGoResponse
// @Router /finance/pay-as-you-go-by-user [get]
// @Security ApiKeyAuth
func GetPayAsYouGoByUser(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		common.ApiErrorMsg(c, "未登录")
		return
	}
	if !model.IsFinanceAdmin(userId) {
		common.ApiErrorMsg(c, "无权限访问财务模块")
		return
	}

	startTime, _ := strconv.ParseInt(c.Query("start_time"), 10, 64)
	endTime, _ := strconv.ParseInt(c.Query("end_time"), 10, 64)

	if startTime == 0 || endTime == 0 {
		common.ApiErrorMsg(c, "缺少时间参数")
		return
	}

	username := c.Query("keyword")

	pageInfo := common.GetPageQuery(c)

	serviceInstance := service.GetFinanceService()
	items, total, err := serviceInstance.GetPayAsYouGoByUser(startTime, endTime, pageInfo, username)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    items,
		"total":   total,
	})
}

// GetSubscriptionOrders 获取订阅套餐营收分析
// @Summary 获取订阅套餐营收分析
// @Tags finance
// @Param start_time query int true "开始时间戳"
// @Param end_time query int true "结束时间戳"
// @Param p query int false "页码"
// @Param page_size query int false "每页数量"
// @Success 200 {object} dto.SubscriptionOrderResponse
// @Router /finance/subscription-orders [get]
// @Security ApiKeyAuth
func GetSubscriptionOrders(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		common.ApiErrorMsg(c, "未登录")
		return
	}
	if !model.IsFinanceAdmin(userId) {
		common.ApiErrorMsg(c, "无权限访问财务模块")
		return
	}

	startTime, _ := strconv.ParseInt(c.Query("start_time"), 10, 64)
	endTime, _ := strconv.ParseInt(c.Query("end_time"), 10, 64)
	username := c.Query("keyword")

	if startTime == 0 || endTime == 0 {
		common.ApiErrorMsg(c, "缺少时间参数")
		return
	}

	pageInfo := common.GetPageQuery(c)

	serviceInstance := service.GetFinanceService()
	items, total, err := serviceInstance.GetSubscriptionOrders(startTime, endTime, pageInfo, username)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    items,
		"total":   total,
	})
}

// ExportRevenueByUserCsv 导出营收分析用户数据为 CSV
func ExportRevenueByUserCsv(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		common.ApiErrorMsg(c, "未登录")
		return
	}
	if !model.IsFinanceAdmin(userId) {
		common.ApiErrorMsg(c, "无权限访问财务模块")
		return
	}

	startTime, _ := strconv.ParseInt(c.Query("start_time"), 10, 64)
	endTime, _ := strconv.ParseInt(c.Query("end_time"), 10, 64)

	if startTime == 0 || endTime == 0 {
		common.ApiErrorMsg(c, "缺少时间参数")
		return
	}

	serviceInstance := service.GetFinanceService()
	items, _, err := serviceInstance.GetRevenueByUser(startTime, endTime, nil)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// 生成 CSV 内容
	var buf bytes.Buffer
	buf.WriteString("\xEF\xBB\xBF") // 添加 BOM 头，Excel 打开时正确识别 UTF-8
	buf.WriteString("用户ID,用户名,按量付费,订阅,总计\n")

	for _, item := range items {
		username := strings.ReplaceAll(item.Username, ",", "，")
		csvLine := fmt.Sprintf("%d,%s,%s,%s,%s\n", item.UserID, username, formatMoneyForCsv(item.PayAsYouGo), formatMoneyForCsv(item.Subscription), formatMoneyForCsv(item.Total))
		buf.WriteString(csvLine)
	}

	filename := fmt.Sprintf("revenue_analysis_%s_%s.csv",
		time.Unix(startTime, 0).Format("20060102"),
		time.Unix(endTime, 0).Format("20060102"))

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	c.String(http.StatusOK, buf.String())
}

// formatMoneyForCsv 格式化金额用于 CSV 输出
func formatMoneyForCsv(amount float64) string {
	return fmt.Sprintf("%.2f", amount)
}

// formatAmountTotalForCsv 格式化实得价值用于 CSV 输出
// 根据套餐类型区分：quota 类型显示金额（CNY/¥），tokens 类型显示 Tokens 数量
func formatAmountTotalForCsv(amountTotal int64, tokensAmount int64, planType string) string {
	if planType == "tokens" {
		return fmt.Sprintf("%d Tokens", tokensAmount)
	}
	quotaPerUnit := common.QuotaPerUnit
	if quotaPerUnit <= 0 {
		quotaPerUnit = 50000000
	}
	usd := float64(amountTotal) / float64(quotaPerUnit)
	usdToCnyRate := operation_setting.USDExchangeRate
	if usdToCnyRate <= 0 {
		usdToCnyRate = 7.3
	}
	cny := usd * usdToCnyRate
	return fmt.Sprintf("¥%.2f", cny)
}

// GetPaymentModeRevenueDistribution 获取付费方式收入分布
func GetPaymentModeRevenueDistribution(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		common.ApiErrorMsg(c, "未登录")
		return
	}
	if !model.IsFinanceAdmin(userId) {
		common.ApiErrorMsg(c, "无权限访问财务模块")
		return
	}

	startTime, _ := strconv.ParseInt(c.Query("start_time"), 10, 64)
	endTime, _ := strconv.ParseInt(c.Query("end_time"), 10, 64)

	if startTime == 0 || endTime == 0 {
		common.ApiErrorMsg(c, "缺少时间参数")
		return
	}

	serviceInstance := service.GetFinanceService()
	dist, err := serviceInstance.GetPaymentModeRevenueDistribution(startTime, endTime)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": dist})
}

// GetSupplierTrend 获取渠道消费趋势
func GetSupplierTrend(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		common.ApiErrorMsg(c, "未登录")
		return
	}
	if !model.IsFinanceAdmin(userId) {
		common.ApiErrorMsg(c, "无权限访问财务模块")
		return
	}

	startTime, _ := strconv.ParseInt(c.Query("start_time"), 10, 64)
	endTime, _ := strconv.ParseInt(c.Query("end_time"), 10, 64)

	if startTime == 0 || endTime == 0 {
		common.ApiErrorMsg(c, "缺少时间参数")
		return
	}

	serviceInstance := service.GetFinanceService()
	trend, err := serviceInstance.GetSupplierTrend(startTime, endTime)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": trend})
}

// GetSupplierDistribution 获取渠道消费占比
func GetSupplierDistribution(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		common.ApiErrorMsg(c, "未登录")
		return
	}
	if !model.IsFinanceAdmin(userId) {
		common.ApiErrorMsg(c, "无权限访问财务模块")
		return
	}

	startTime, _ := strconv.ParseInt(c.Query("start_time"), 10, 64)
	endTime, _ := strconv.ParseInt(c.Query("end_time"), 10, 64)

	if startTime == 0 || endTime == 0 {
		common.ApiErrorMsg(c, "缺少时间参数")
		return
	}

	serviceInstance := service.GetFinanceService()
	dist, err := serviceInstance.GetSupplierDistribution(startTime, endTime)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": dist})
}

// GetRevenueManagementStats 获取营收管理 头部统计指标
// @Summary 获取营收管理 头部统计指标
// @Tags finance
// @Param start_time query int true "开始时间戳"
// @Param end_time query int true "结束时间戳"
// @Success 200 {object} dto.RevenueManagementStats
// @Router /finance/revenue-management/stats [get]
// @Security ApiKeyAuth
func GetRevenueManagementStats(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		common.ApiErrorMsg(c, "未登录")
		return
	}
	if !model.IsFinanceAdmin(userId) {
		common.ApiErrorMsg(c, "无权限访问财务模块")
		return
	}

	startTime, _ := strconv.ParseInt(c.Query("start_time"), 10, 64)
	endTime, _ := strconv.ParseInt(c.Query("end_time"), 10, 64)

	if startTime == 0 || endTime == 0 {
		common.ApiErrorMsg(c, "缺少时间参数")
		return
	}

	serviceInstance := service.GetFinanceService()
	stats, err := serviceInstance.GetRevenueManagementStats(startTime, endTime)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": stats})
}

// ExportRevenueManagementCsv 导出营收管理（按量付费 + 订阅套餐）CSV
// @Summary 导出营收管理 CSV
// @Tags finance
// @Param start_time query int true "开始时间戳"
// @Param end_time query int true "结束时间戳"
// @Router /finance/revenue-management/export-csv [get]
// @Security ApiKeyAuth
func ExportRevenueManagementCsv(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		common.ApiErrorMsg(c, "未登录")
		return
	}
	if !model.IsFinanceAdmin(userId) {
		common.ApiErrorMsg(c, "无权限访问财务模块")
		return
	}

	startTime, _ := strconv.ParseInt(c.Query("start_time"), 10, 64)
	endTime, _ := strconv.ParseInt(c.Query("end_time"), 10, 64)

	if startTime == 0 || endTime == 0 {
		common.ApiErrorMsg(c, "缺少时间参数")
		return
	}

	serviceInstance := service.GetFinanceService()
	data, err := serviceInstance.GetRevenueManagementExport(startTime, endTime)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	var buf bytes.Buffer
	buf.WriteString("\xEF\xBB\xBF") // BOM 头

	// 第一部分：按量付费
	buf.WriteString("按量付费\n")
	buf.WriteString("用户名,金额\n")
	for _, item := range data.PayAsYouGoItems {
		username := strings.ReplaceAll(item.Username, ",", "，")
		buf.WriteString(fmt.Sprintf("%s,%s\n", username, formatMoneyForCsv(item.Amount)))
	}
	buf.WriteString("\n")

	// 第二部分：订阅套餐
	buf.WriteString("订阅套餐\n")
	buf.WriteString("用户名,套餐类型,套餐名,订阅时间,到期时间,实收金额,实得价值\n")
	for _, item := range data.SubscriptionItems {
		username := strings.ReplaceAll(item.Username, ",", "，")
		planName := strings.ReplaceAll(item.PlanName, ",", "，")
		subscribeTime := time.Unix(item.SubscribeTime, 0).Format("2006-01-02 15:04:05")
		expireTime := "-"
		if item.ExpireTime > 0 {
			expireTime = time.Unix(item.ExpireTime, 0).Format("2006-01-02 15:04:05")
		}
		// 实得价值：根据套餐类型区分显示
		amountValue := formatAmountTotalForCsv(item.AmountTotal, item.TokensAmount, item.PlanType)
		buf.WriteString(fmt.Sprintf("%s,%s,%s,%s,%s,%s,%s\n",
			username, item.PlanType, planName, subscribeTime, expireTime,
			formatMoneyForCsv(item.PaidAmount), amountValue))
	}

	filename := fmt.Sprintf("revenue_management_%s_%s.csv",
		time.Unix(startTime, 0).Format("20060102"),
		time.Unix(endTime, 0).Format("20060102"))

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	c.String(http.StatusOK, buf.String())
}

// GetDashboardRevenueTrend 获取 Dashboard 营收趋势（按量付费 + 订阅套餐）
func GetDashboardRevenueTrend(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		common.ApiErrorMsg(c, "未登录")
		return
	}
	if !model.IsFinanceAdmin(userId) {
		common.ApiErrorMsg(c, "无权限访问财务模块")
		return
	}

	startTime, _ := strconv.ParseInt(c.Query("start_time"), 10, 64)
	endTime, _ := strconv.ParseInt(c.Query("end_time"), 10, 64)

	if startTime == 0 || endTime == 0 {
		common.ApiErrorMsg(c, "缺少时间参数")
		return
	}

	serviceInstance := service.GetFinanceService()
	trend, err := serviceInstance.GetDashboardRevenueTrend(startTime, endTime)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": trend})
}
