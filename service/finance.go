package service

import (
	"encoding/json"
	"fmt"
	"math"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
)

type FinanceService struct{}

var financeService *FinanceService

func GetFinanceService() *FinanceService {
	if financeService == nil {
		financeService = &FinanceService{}
	}
	return financeService
}

// ============================================
// 财务概览相关方法
// ============================================

// GetFinanceDashboard 获取财务概览数据（管理员）
func (s *FinanceService) GetFinanceDashboard(userId int, isAdmin bool, req dto.FinanceDashboardRequest) (*dto.FinanceDashboardResponse, error) {
	// 默认最近30天
	if req.StartDate == "" {
		req.StartDate = time.Now().AddDate(0, 0, -30).Format("2006-01-02")
	}
	if req.EndDate == "" {
		req.EndDate = time.Now().Format("2006-01-02")
	}

	startTime, _ := time.Parse("2006-01-02", req.StartDate)
	endTime, _ := time.Parse("2006-01-02", req.EndDate)
	endTime = endTime.Add(24 * time.Hour) // 包含结束日期当天

	startTimestamp := startTime.Unix()
	endTimestamp := endTime.Unix()

	now := time.Now()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).Unix()
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()).Unix()

	response := &dto.FinanceDashboardResponse{}

	if isAdmin {
		// 管理员：统计全部数据
		response = s.getAdminDashboard(startTimestamp, endTimestamp, todayStart, monthStart)
	} else {
		// 普通用户：只统计自己的数据
		response = s.getUserDashboard(userId, startTimestamp, endTimestamp, todayStart, monthStart)
	}

	return response, nil
}

// getAdminDashboard 获取管理员财务概览
func (s *FinanceService) getAdminDashboard(startTimestamp, endTimestamp, todayStart, monthStart int64) *dto.FinanceDashboardResponse {
	response := &dto.FinanceDashboardResponse{}

	// 1. 统计充值总额（从 top_ups 表）
	var totalTopup float64
	model.DB.Raw(`SELECT COALESCE(SUM(money), 0) FROM top_ups WHERE status = 'success' AND create_time >= ? AND create_time <= ?`,
		startTimestamp, endTimestamp).Scan(&totalTopup)
	response.TotalTopup = totalTopup

	// 今日充值
	var todayTopup float64
	model.DB.Raw(`SELECT COALESCE(SUM(money), 0) FROM top_ups WHERE status = 'success' AND create_time >= ? AND create_time <= ?`,
		todayStart, endTimestamp).Scan(&todayTopup)

	// 本月充值
	var monthTopup float64
	model.DB.Raw(`SELECT COALESCE(SUM(money), 0) FROM top_ups WHERE status = 'success' AND create_time >= ? AND create_time <= ?`,
		monthStart, endTimestamp).Scan(&monthTopup)

	// 2. 统计订阅收入（从 subscription_orders 表）
	var totalSubscription float64
	model.DB.Raw(`SELECT COALESCE(SUM(amount), 0) FROM subscription_orders WHERE status = 'paid' AND created_at >= ? AND created_at <= ?`,
		startTimestamp, endTimestamp).Scan(&totalSubscription)
	response.TotalSubscription = totalSubscription

	// 3. 统计消费总额（从 logs 表，type=2 表示消费）
	var totalConsumptionQuota int64
	model.DB.Raw(`SELECT COALESCE(SUM(quota), 0) FROM logs WHERE type = 2 AND created_at >= ? AND created_at <= ?`,
		startTimestamp, endTimestamp).Scan(&totalConsumptionQuota)

	// 将 quota 转换为金额（QuotaPerUnit quota = 1元）
	quotaPerUnit := common.QuotaPerUnit
	if quotaPerUnit <= 0 {
		quotaPerUnit = 50000000 // 默认值
	}
	totalConsumption := float64(totalConsumptionQuota) / quotaPerUnit
	response.TotalConsumption = math.Round(totalConsumption*100) / 100

	// 4. 总营收 = 总充值 + 总订阅
	response.TotalRevenue = math.Round((totalTopup+totalSubscription)*100) / 100

	// 5. 净营收 = 总营收 - 总消费
	response.NetRevenue = math.Round((totalTopup+totalSubscription-totalConsumption)*100) / 100

	// 今日营收
	todayRevenue := todayTopup
	response.TodayRevenue = math.Round(todayRevenue*100) / 100

	// 本月营收
	monthRevenue := monthTopup
	response.MonthRevenue = math.Round(monthRevenue*100) / 100

	// 6. 订单数（充值订单）
	var orderCount int64
	model.DB.Raw(`SELECT COUNT(*) FROM top_ups WHERE status IN ('success', 'pending') AND create_time >= ? AND create_time <= ?`,
		startTimestamp, endTimestamp).Scan(&orderCount)
	response.OrderCount = int(orderCount)

	// 7. 用户数（有充值或消费的用户）
	var userCount int64
	model.DB.Raw(`SELECT COUNT(DISTINCT user_id) FROM (SELECT user_id FROM top_ups WHERE status = 'success' AND create_time >= ? AND create_time <= ? UNION SELECT user_id FROM logs WHERE type = 2 AND created_at >= ? AND created_at <= ?)`,
		startTimestamp, endTimestamp, startTimestamp, endTimestamp).Scan(&userCount)
	response.UserCount = int(userCount)

	// 8. 请求数
	var requestCount int64
	model.DB.Raw(`SELECT COUNT(*) FROM logs WHERE type = 2 AND created_at >= ? AND created_at <= ?`,
		startTimestamp, endTimestamp).Scan(&requestCount)
	response.RequestCount = int(requestCount)

	// 9. 待审核发票
	var invoicePending int64
	model.DB.Raw(`SELECT COUNT(*) FROM invoices WHERE status = 'pending'`).Scan(&invoicePending)
	response.InvoicePending = int(invoicePending)

	var invoiceTotal float64
	model.DB.Raw(`SELECT COALESCE(SUM(amount), 0) FROM invoices WHERE status = 'pending'`).Scan(&invoiceTotal)
	response.InvoiceTotal = invoiceTotal

	return response
}

// getUserDashboard 获取用户财务概览
func (s *FinanceService) getUserDashboard(userId int, startTimestamp, endTimestamp, todayStart, monthStart int64) *dto.FinanceDashboardResponse {
	response := &dto.FinanceDashboardResponse{}

	// 1. 用户充值总额
	var totalTopup float64
	model.DB.Raw(`SELECT COALESCE(SUM(money), 0) FROM top_ups WHERE user_id = ? AND status = 'success' AND create_time >= ? AND create_time <= ?`,
		userId, startTimestamp, endTimestamp).Scan(&totalTopup)
	response.TotalTopup = totalTopup

	// 2. 用户订阅支出
	var totalSubscription float64
	model.DB.Raw(`SELECT COALESCE(SUM(amount), 0) FROM subscription_orders WHERE user_id = ? AND status = 'paid' AND created_at >= ? AND created_at <= ?`,
		userId, startTimestamp, endTimestamp).Scan(&totalSubscription)
	response.TotalSubscription = totalSubscription

	// 3. 用户消费
	var totalConsumptionQuota int64
	model.DB.Raw(`SELECT COALESCE(SUM(quota), 0) FROM logs WHERE user_id = ? AND type = 2 AND created_at >= ? AND created_at <= ?`,
		userId, startTimestamp, endTimestamp).Scan(&totalConsumptionQuota)

	quotaPerUnit := common.QuotaPerUnit
	if quotaPerUnit <= 0 {
		quotaPerUnit = 50000000
	}
	totalConsumption := float64(totalConsumptionQuota) / quotaPerUnit
	response.TotalConsumption = math.Round(totalConsumption*100) / 100

	// 4. 总支出
	response.TotalRevenue = math.Round((totalTopup+totalSubscription)*100) / 100
	response.NetRevenue = response.TotalRevenue

	// 今日
	var todayTopup float64
	model.DB.Raw(`SELECT COALESCE(SUM(money), 0) FROM top_ups WHERE user_id = ? AND status = 'success' AND create_time >= ? AND create_time <= ?`,
		userId, todayStart, endTimestamp).Scan(&todayTopup)
	response.TodayRevenue = math.Round(todayTopup*100) / 100

	// 本月
	var monthTopup float64
	model.DB.Raw(`SELECT COALESCE(SUM(money), 0) FROM top_ups WHERE user_id = ? AND status = 'success' AND create_time >= ? AND create_time <= ?`,
		userId, monthStart, endTimestamp).Scan(&monthTopup)
	response.MonthRevenue = math.Round(monthTopup*100) / 100

	// 5. 订单数
	var orderCount int64
	model.DB.Raw(`SELECT COUNT(*) FROM top_ups WHERE user_id = ? AND status IN ('success', 'pending') AND create_time >= ? AND create_time <= ?`,
		userId, startTimestamp, endTimestamp).Scan(&orderCount)
	response.OrderCount = int(orderCount)

	// 6. 用户自己的请求数
	var requestCount int64
	model.DB.Raw(`SELECT COUNT(*) FROM logs WHERE user_id = ? AND type = 2 AND created_at >= ? AND created_at <= ?`,
		userId, startTimestamp, endTimestamp).Scan(&requestCount)
	response.RequestCount = int(requestCount)

	// 7. 用户待审核发票
	var invoicePending int64
	model.DB.Raw(`SELECT COUNT(*) FROM invoices WHERE user_id = ? AND status = 'pending'`).Scan(&invoicePending)
	response.InvoicePending = int(invoicePending)

	var invoiceTotal float64
	model.DB.Raw(`SELECT COALESCE(SUM(amount), 0) FROM invoices WHERE user_id = ? AND status = 'pending'`).Scan(&invoiceTotal)
	response.InvoiceTotal = invoiceTotal

	return response
}

// ============================================
// 订单相关方法
// ============================================

// GetOrders 获取订单列表
func (s *FinanceService) GetOrders(userId int, isAdmin bool, req dto.OrderListRequest, pageInfo *common.PageInfo) ([]*dto.OrderItem, int64, error) {
	var items []*dto.OrderItem
	var total int64
	var err error

	if isAdmin {
		items, total, err = s.getAllOrders(req, pageInfo)
		if err != nil {
			return nil, 0, err
		}
	} else {
		items, total, err = s.getUserOrders(userId, req, pageInfo)
		if err != nil {
			return nil, 0, err
		}
	}

	return items, total, nil
}

// getUserOrders 获取用户订单
func (s *FinanceService) getUserOrders(userId int, req dto.OrderListRequest, pageInfo *common.PageInfo) ([]*dto.OrderItem, int64, error) {
	var total int64
	var topUps []*model.TopUp

	query := model.DB.Where("user_id = ?", userId).Order("id desc")

	// 调试日志
	common.SysLog(fmt.Sprintf("[Finance] getUserOrders: userId=%d, startDate=%s, endDate=%s, status=%s, keyword=%s", userId, req.StartDate, req.EndDate, req.Status, req.Keyword))

	if req.Status != "" {
		query = query.Where("status = ?", req.Status)
	}
	if req.StartDate != "" {
		startTime, _ := time.Parse("2006-01-02", req.StartDate)
		query = query.Where("create_time >= ?", startTime.Unix())
	}
	if req.EndDate != "" {
		endTime, _ := time.Parse("2006-01-02", req.EndDate)
		query = query.Where("create_time <= ?", endTime.Unix()+86400)
	}
	if req.Keyword != "" {
		query = query.Where("trade_no LIKE ?", "%"+req.Keyword+"%")
	}

	// 统计总数（使用包含所有筛选条件的 query，在添加 Limit/Offset 之前调用）
	query.Count(&total)

	// 获取分页数据
	query.Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&topUps)

	items := make([]*dto.OrderItem, 0)
	for _, tu := range topUps {
		items = append(items, &dto.OrderItem{
			Id:            tu.Id,
			OrderId:       fmt.Sprintf("TOP-%d", tu.Id),
			UserId:        tu.UserId,
			Amount:        tu.Money,
			Quota:         int(tu.Amount),
			PaymentMethod: tu.PaymentMethod,
			Status:        tu.Status,
			CreateTime:    tu.CreateTime,
			CompleteTime:  tu.CompleteTime,
			TradeNo:       tu.TradeNo,
			OrderType:     "topup",
		})
	}

	return items, total, nil
}

// getAllOrders 获取全部订单（管理员）
func (s *FinanceService) getAllOrders(req dto.OrderListRequest, pageInfo *common.PageInfo) ([]*dto.OrderItem, int64, error) {
	var total int64
	var topUps []*model.TopUp

	// 调试日志：检查表是否存在
	var tableCount int
	model.DB.Raw("SELECT COUNT(*) FROM top_ups").Scan(&tableCount)
	common.SysLog(fmt.Sprintf("[Finance] getAllOrders: top_ups table count = %d", tableCount))

	query := model.DB.Model(&model.TopUp{}).Order("id desc")

	if req.Status != "" {
		query = query.Where("status = ?", req.Status)
	}
	if req.PaymentMethod != "" {
		query = query.Where("payment_method = ?", req.PaymentMethod)
	}
	if req.StartDate != "" {
		startTime, _ := time.Parse("2006-01-02", req.StartDate)
		query = query.Where("create_time >= ?", startTime.Unix())
	}
	if req.EndDate != "" {
		endTime, _ := time.Parse("2006-01-02", req.EndDate)
		query = query.Where("create_time <= ?", endTime.Unix()+86400)
	}
	if req.Keyword != "" {
		query = query.Where("trade_no LIKE ?", "%"+req.Keyword+"%")
	}

	query.Count(&total)
	query.Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&topUps)

	// 获取用户名映射
	userIds := make([]int, 0, len(topUps))
	for _, tu := range topUps {
		userIds = append(userIds, tu.UserId)
	}
	usernameMap := make(map[int]string)
	if len(userIds) > 0 {
		var users []*model.User
		model.DB.Where("id in ?", userIds).Find(&users)
		for _, u := range users {
			usernameMap[u.Id] = u.Username
		}
	}

	items := make([]*dto.OrderItem, 0)
	for _, tu := range topUps {
		username := usernameMap[tu.UserId]
		if username == "" {
			username = "unknown"
		}
		items = append(items, &dto.OrderItem{
			Id:            tu.Id,
			OrderId:       fmt.Sprintf("TOP-%d", tu.Id),
			UserId:        tu.UserId,
			Username:      username,
			Amount:        tu.Money,
			Quota:         int(tu.Amount),
			PaymentMethod: tu.PaymentMethod,
			Status:        tu.Status,
			CreateTime:    tu.CreateTime,
			CompleteTime:  tu.CompleteTime,
			TradeNo:       tu.TradeNo,
			OrderType:     "topup",
		})
	}

	return items, total, nil
}

// ExportOrders 导出订单CSV
func (s *FinanceService) ExportOrders(userId int, isAdmin bool, req dto.OrderListRequest) ([]*dto.OrderItem, error) {
	items, _, err := s.GetOrders(userId, isAdmin, req, &common.PageInfo{
		PageSize: 100000,
	})
	return items, err
}

// ============================================
// 营收报表相关方法
// ============================================

// GenerateDailyRevenueReport 生成每日营收报表
func (s *FinanceService) GenerateDailyRevenueReport(date time.Time) (*model.RevenueReport, error) {
	startTime := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location()).Unix()
	endTime := startTime + 86400

	report := &model.RevenueReport{
		ReportType: "daily",
		Period:     date.Format("2006-01-02"),
		CreateTime: common.GetTimestamp(),
		UpdateTime: common.GetTimestamp(),
	}

	// 总充值
	var totalTopup float64
	model.DB.Raw(`SELECT COALESCE(SUM(money), 0) FROM top_ups WHERE status = 'success' AND create_time >= ? AND create_time < ?`,
		startTime, endTime).Scan(&totalTopup)
	report.TotalTopup = totalTopup

	// 总订阅
	var totalSubscription float64
	model.DB.Raw(`SELECT COALESCE(SUM(amount), 0) FROM subscription_orders WHERE status = 'paid' AND created_at >= ? AND created_at < ?`,
		startTime, endTime).Scan(&totalSubscription)
	report.TotalSubscription = totalSubscription

	// 总消费
	var totalConsumptionQuota int64
	model.DB.Raw(`SELECT COALESCE(SUM(quota), 0) FROM logs WHERE type = 2 AND created_at >= ? AND created_at < ?`,
		startTime, endTime).Scan(&totalConsumptionQuota)

	quotaPerUnit := common.QuotaPerUnit
	if quotaPerUnit <= 0 {
		quotaPerUnit = 50000000
	}
	report.TotalConsumption = math.Round(float64(totalConsumptionQuota)/quotaPerUnit*100) / 100

	report.TotalRevenue = math.Round((totalTopup+totalSubscription)*100) / 100
	report.NetRevenue = report.TotalRevenue

	// 订单数
	var orderCount int64
	model.DB.Raw(`SELECT COUNT(*) FROM top_ups WHERE status IN ('success', 'pending') AND create_time >= ? AND create_time < ?`,
		startTime, endTime).Scan(&orderCount)
	report.OrderCount = int(orderCount)

	// 用户数
	var userCount int64
	model.DB.Raw(`SELECT COUNT(DISTINCT user_id) FROM top_ups WHERE status = 'success' AND create_time >= ? AND create_time < ?`,
		startTime, endTime).Scan(&userCount)
	report.UserCount = int(userCount)

	// 请求数
	var requestCount int64
	model.DB.Raw(`SELECT COUNT(*) FROM logs WHERE type = 2 AND created_at >= ? AND created_at < ?`,
		startTime, endTime).Scan(&requestCount)
	report.RequestCount = int(requestCount)

	if err := report.Insert(); err != nil {
		common.SysError("failed to insert revenue report: " + err.Error())
		return nil, err
	}

	return report, nil
}

// GetRevenueTrend 获取营收趋势
func (s *FinanceService) GetRevenueTrend(days int) ([]*dto.RevenueTrendItem, error) {
	if days <= 0 {
		days = 30
	}

	now := time.Now()
	trend := make([]*dto.RevenueTrendItem, 0, days)

	for i := days - 1; i >= 0; i-- {
		date := now.AddDate(0, 0, -i)
		startTime := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location()).Unix()
		endTime := startTime + 86400

		item := &dto.RevenueTrendItem{
			Date: date.Format("2006-01-02"),
		}

		var totalTopup float64
		model.DB.Raw(`SELECT COALESCE(SUM(money), 0) FROM top_ups WHERE status = 'success' AND create_time >= ? AND create_time < ?`,
			startTime, endTime).Scan(&totalTopup)
		item.Topup = math.Round(totalTopup*100) / 100

		item.Revenue = math.Round(totalTopup*100) / 100

		trend = append(trend, item)
	}

	return trend, nil
}

// GetRevenueReports 获取营收报表列表
func (s *FinanceService) GetRevenueReports(req dto.RevenueReportRequest, pageInfo *common.PageInfo) ([]*model.RevenueReport, int64, error) {
	query := model.DB.Model(&model.RevenueReport{}).Order("id desc")

	if req.ReportType != "" {
		query = query.Where("report_type = ?", req.ReportType)
	}
	if req.StartDate != "" {
		t, _ := time.Parse("2006-01-02", req.StartDate)
		query = query.Where("period >= ?", t.Format("2006-01-02"))
	}
	if req.EndDate != "" {
		t, _ := time.Parse("2006-01-02", req.EndDate)
		query = query.Where("period <= ?", t.Format("2006-01-02"))
	}

	var total int64
	query.Count(&total)

	var reports []*model.RevenueReport
	query.Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&reports)

	return reports, total, nil
}

// ============================================
// 发票管理相关方法
// ============================================

// ApplyInvoice 用户申请发票
func (s *FinanceService) ApplyInvoice(userId int, username string, req dto.InvoiceApplyRequest) (*model.Invoice, error) {
	invoiceNo := fmt.Sprintf("INV-%d-%06d", userId, common.GetTimestamp())

	orderIds := make(map[string]interface{})
	if len(req.OrderIds) > 0 {
		for _, orderId := range req.OrderIds {
			orderIds[orderId] = true
		}
	}

	invoice := &model.Invoice{
		InvoiceNo:    invoiceNo,
		UserId:       userId,
		Username:     username,
		Type:         req.Type,
		Title:        req.Title,
		TaxNumber:    req.TaxNumber,
		ContactName:  req.ContactName,
		ContactPhone: req.ContactPhone,
		Address:      req.Address,
		BankName:     req.BankName,
		BankAccount:  req.BankAccount,
		Amount:       req.Amount,
		OrderIds:     func() string { b, _ := json.Marshal(req.OrderIds); return string(b) }(),
		Remark:       req.Remark,
		Status:       model.InvoiceStatusPending,
		CreateTime:   common.GetTimestamp(),
		UpdateTime:   common.GetTimestamp(),
	}

	if err := invoice.Insert(); err != nil {
		return nil, err
	}

	return invoice, nil
}

// GetUserInvoices 获取用户发票列表
func (s *FinanceService) GetUserInvoices(userId int, req dto.InvoiceListRequest, pageInfo *common.PageInfo) ([]*model.Invoice, int64, error) {
	var startTime, endTime int64
	if req.StartDate != "" {
		t, _ := time.Parse("2006-01-02", req.StartDate)
		startTime = t.Unix()
	}
	if req.EndDate != "" {
		t, _ := time.Parse("2006-01-02", req.EndDate)
		endTime = t.Unix() + 86400
	}

	query := model.DB.Model(&model.Invoice{}).Where("user_id = ?", userId)
	if req.Status != "" {
		query = query.Where("status = ?", req.Status)
	}
	if startTime > 0 {
		query = query.Where("create_time >= ?", startTime)
	}
	if endTime > 0 {
		query = query.Where("create_time <= ?", endTime)
	}

	var total int64
	query.Count(&total)

	var invoices []*model.Invoice
	query.Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Order("id desc").Find(&invoices)

	return invoices, total, nil
}

// GetAllInvoices 获取全部发票（管理员）
func (s *FinanceService) GetAllInvoices(req dto.InvoiceListRequest, pageInfo *common.PageInfo) ([]*model.InvoiceWithUsername, int64, error) {
	query := model.DB.Model(&model.Invoice{}).Select("invoices.*, users.username").
		Joins("LEFT JOIN users ON invoices.user_id = users.id").Order("invoices.id desc")

	if req.Status != "" {
		query = query.Where("invoices.status = ?", req.Status)
	}
	if req.StartDate != "" {
		t, _ := time.Parse("2006-01-02", req.StartDate)
		query = query.Where("invoices.create_time >= ?", t.Unix())
	}
	if req.EndDate != "" {
		t, _ := time.Parse("2006-01-02", req.EndDate)
		query = query.Where("invoices.create_time <= ?", t.Unix()+86400)
	}
	if req.Keyword != "" {
		query = query.Where("invoices.invoice_no LIKE ? OR users.username LIKE ?", "%"+req.Keyword+"%", "%"+req.Keyword+"%")
	}

	var total int64
	query.Count(&total)

	var invoices []*model.InvoiceWithUsername
	query.Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&invoices)

	return invoices, total, nil
}

// ApproveInvoice 审批发票
func (s *FinanceService) ApproveInvoice(id int, status string, approvedBy int, remark string) error {
	invoice, err := model.GetInvoiceById(id)
	if err != nil {
		return err
	}
	if invoice.Status != model.InvoiceStatusPending {
		return fmt.Errorf("当前发票状态不允许审批")
	}

	now := common.GetTimestamp()
	updates := map[string]interface{}{
		"status":      status,
		"approved_by": approvedBy,
		"approved_at": now,
		"remark":      remark,
		"update_time": now,
	}

	if status == model.InvoiceStatusApproved {
		updates["issued_at"] = now
	}

	return model.DB.Model(&model.Invoice{}).Where("id = ?", id).Updates(updates).Error
}

// ============================================
// 对账相关方法
// ============================================

// GetReconciliations 获取对账记录列表
func (s *FinanceService) GetReconciliations(req dto.ReconciliationListRequest, pageInfo *common.PageInfo) ([]*model.Reconciliation, int64, error) {
	query := model.DB.Model(&model.Reconciliation{}).Order("id desc")

	if req.Type != "" {
		query = query.Where("type = ?", req.Type)
	}
	if req.Status != "" {
		query = query.Where("status = ?", req.Status)
	}
	if req.Period != "" {
		query = query.Where("period = ?", req.Period)
	}

	var total int64
	query.Count(&total)

	var reconciliations []*model.Reconciliation
	query.Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&reconciliations)

	return reconciliations, total, nil
}

// AutoReconcileDownstream 自动对账下游渠道
func (s *FinanceService) AutoReconcileDownstream(period string) (*model.Reconciliation, error) {
	if period == "" {
		period = time.Now().AddDate(0, 0, -1).Format("2006-01-02")
	}

	reconciliation := &model.Reconciliation{
		Type:       "downstream",
		Period:     period,
		Status:     "pending",
		CreateTime: common.GetTimestamp(),
		UpdateTime: common.GetTimestamp(),
	}

	// 统计下游渠道实际结算金额
	var totalAmount float64
	model.DB.Raw(`SELECT COALESCE(SUM(amount), 0) FROM logs WHERE type = 2 AND DATE(FROM_UNIXTIME(created_at)) = ?`,
		period).Scan(&totalAmount)
	reconciliation.TotalAmount = totalAmount

	// 统计实际使用量
	var totalQuota int64
	model.DB.Raw(`SELECT COALESCE(SUM(quota), 0) FROM logs WHERE type = 2 AND DATE(FROM_UNIXTIME(created_at)) = ?`,
		period).Scan(&totalQuota)
	reconciliation.TotalQuota = int(totalQuota)

	// 统计请求数
	var transactionCount int
	model.DB.Raw(`SELECT COUNT(*) FROM logs WHERE type = 2 AND DATE(FROM_UNIXTIME(created_at)) = ?`,
		period).Scan(&transactionCount)
	reconciliation.TransactionCount = transactionCount

	if err := reconciliation.Insert(); err != nil {
		common.SysError("failed to insert reconciliation: " + err.Error())
		return nil, err
	}

	// 标记为已完成
	reconciliation.Status = "completed"
	reconciliation.UpdateTime = common.GetTimestamp()
	model.DB.Model(&model.Reconciliation{}).Where("id = ?", reconciliation.Id).Updates(map[string]interface{}{
		"status":      "completed",
		"update_time": common.GetTimestamp(),
	})

	return reconciliation, nil
}

// ============================================
// 订单统计（用于 Orders 页面概览）
// ============================================

// GetOrderStatistics 获取订单统计数据
func (s *FinanceService) GetOrderStatistics(isAdmin bool, userId int) (*dto.OrderStatistics, error) {
	stats := &dto.OrderStatistics{}

	now := time.Now()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).Unix()
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()).Unix()

	var userCondition string

	if !isAdmin {
		userCondition = "AND user_id = ?"
	}

	// 1. 截止目前的有效充值订单统计（成功状态）
	var successStats struct {
		TotalAmount float64
		Count       int64
	}
	successQuery := fmt.Sprintf(`
		SELECT COALESCE(SUM(money), 0) as total_amount, COUNT(*) as count
		FROM top_ups
		WHERE status = 'success' %s`, userCondition)
	if isAdmin {
		model.DB.Raw(successQuery).Scan(&successStats)
	} else {
		model.DB.Raw(successQuery, userId).Scan(&successStats)
	}
	stats.TotalAmount = successStats.TotalAmount
	stats.SuccessCount = successStats.Count

	// 2. 待处理订单数
	var pendingCount int64
	pendingQuery := fmt.Sprintf(`
		SELECT COUNT(*) FROM top_ups WHERE status = 'pending' %s`, userCondition)
	if isAdmin {
		model.DB.Raw(pendingQuery).Scan(&pendingCount)
	} else {
		model.DB.Raw(pendingQuery, userId).Scan(&pendingCount)
	}
	stats.PendingCount = pendingCount

	// 3. 失败订单数
	var failedCount int64
	failedQuery := fmt.Sprintf(`
		SELECT COUNT(*) FROM top_ups WHERE status = 'failed' %s`, userCondition)
	if isAdmin {
		model.DB.Raw(failedQuery).Scan(&failedCount)
	} else {
		model.DB.Raw(failedQuery, userId).Scan(&failedCount)
	}
	stats.FailedCount = failedCount

	// 4. 退款统计（从 logs 表中 type=6 表示退款）
	var refundStats struct {
		TotalRefund float64
		Count       int64
	}
	refundQuery := fmt.Sprintf(`
		SELECT COALESCE(SUM(ABS(quota) / %d), 0) as total_refund, COUNT(*) as count
		FROM logs
		WHERE type = 6 %s`, common.QuotaPerUnit, userCondition)
	if isAdmin {
		model.DB.Raw(refundQuery).Scan(&refundStats)
	} else {
		model.DB.Raw(refundQuery, userId).Scan(&refundStats)
	}
	stats.TotalRefund = refundStats.TotalRefund
	stats.RefundCount = refundStats.Count

	// 5. 今日充值统计
	var todayStats struct {
		Amount float64
		Count  int64
	}
	todayQuery := fmt.Sprintf(`
		SELECT COALESCE(SUM(money), 0) as amount, COUNT(*) as count
		FROM top_ups
		WHERE status = 'success' AND create_time >= ? %s`, userCondition)
	if isAdmin {
		model.DB.Raw(todayQuery, todayStart).Scan(&todayStats)
	} else {
		model.DB.Raw(todayQuery, todayStart, userId).Scan(&todayStats)
	}
	stats.TodayAmount = todayStats.Amount
	stats.TodayCount = todayStats.Count

	// 6. 本月充值统计
	var monthStats struct {
		Amount float64
		Count  int64
	}
	monthQuery := fmt.Sprintf(`
		SELECT COALESCE(SUM(money), 0) as amount, COUNT(*) as count
		FROM top_ups
		WHERE status = 'success' AND create_time >= ? %s`, userCondition)
	if isAdmin {
		model.DB.Raw(monthQuery, monthStart).Scan(&monthStats)
	} else {
		model.DB.Raw(monthQuery, monthStart, userId).Scan(&monthStats)
	}
	stats.MonthAmount = monthStats.Amount
	stats.MonthCount = monthStats.Count

	return stats, nil
}
