package service

import (
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// parseFlexibleDateTime 解析日期时间字符串，兼容 "2006-01-02 15:04:05" 和 "2006-01-02" 两种格式
func parseFlexibleDateTime(value string) (time.Time, bool) {
	if value == "" {
		return time.Time{}, false
	}
	if t, err := time.ParseInLocation("2006-01-02 15:04:05", value, time.Local); err == nil {
		return t, true
	}
	if t, err := time.ParseInLocation("2006-01-02", value, time.Local); err == nil {
		return t, true
	}
	return time.Time{}, false
}

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
// 营收分析相关方法
// ============================================

// GetUserRevenueReports 获取用户营收分析用户列表
func (s *FinanceService) GetUserRevenueReports(req dto.UserRevenueListRequest, pageInfo *common.PageInfo) ([]*dto.UserRevenueSummary, int64, *dto.UserRevenueStats, error) {
	var total int64
	var results []*dto.UserRevenueSummary

	keyword := "%" + req.Keyword + "%"

	// 解析日期范围，兼容 "YYYY-MM-DD" 和 "YYYY-MM-DD HH:mm:ss" 两种格式
	var startTimestamp, endTimestamp int64
	if startTime, ok := parseFlexibleDateTime(req.StartDate); ok {
		startTimestamp = startTime.Unix()
	}
	if endTime, ok := parseFlexibleDateTime(req.EndDate); ok {
		if endTime.Hour() == 0 && endTime.Minute() == 0 && endTime.Second() == 0 {
			endTime = endTime.Add(24 * time.Hour) // 仅传日期时，包含结束日期当天
		}
		endTimestamp = endTime.Unix()
	}

	// 查询总数
	countDB := model.DB.Table("users u").
		Joins("LEFT JOIN (SELECT user_id, SUM(money) as total_money FROM top_ups WHERE status = ? GROUP BY user_id) t ON t.user_id = u.id", "success").
		Where("u.deleted_at IS NULL")
	if req.Keyword != "" {
		countDB = countDB.Where("LOWER(u.username) LIKE LOWER(?) OR LOWER(u.display_name) LIKE LOWER(?) OR LOWER(u.email) LIKE LOWER(?)", keyword, keyword, keyword)
	}
	if err := countDB.Count(&total).Error; err != nil {
		return nil, 0, nil, err
	}

	// 查询数据
	var rows []struct {
		Id          int
		Username    string
		DisplayName string
		Quota       int
		TopupMoney  float64
	}

	// 构建 top_ups 子查询，支持时间范围过滤
	topupSubQuery := model.DB.Model(&model.TopUp{}).
		Select("user_id, SUM(money) as total_money").
		Where("status = ?", "success")
	if startTimestamp > 0 {
		topupSubQuery = topupSubQuery.Where("create_time >= ?", startTimestamp)
	}
	if endTimestamp > 0 {
		topupSubQuery = topupSubQuery.Where("create_time < ?", endTimestamp)
	}
	topupSubQuery = topupSubQuery.Group("user_id")

	queryDB := model.DB.Table("users u").
		Select("u.id, u.username, u.display_name, u.quota, COALESCE(t.total_money, 0) as topup_money").
		Joins("LEFT JOIN (?) t ON t.user_id = u.id", topupSubQuery).
		Where("u.deleted_at IS NULL")
	if req.Keyword != "" {
		queryDB = queryDB.Where("LOWER(u.username) LIKE LOWER(?) OR LOWER(u.display_name) LIKE LOWER(?) OR LOWER(u.email) LIKE LOWER(?)", keyword, keyword, keyword)
	}
	err := queryDB.Order("u.id DESC").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Scan(&rows).Error
	if err != nil {
		return nil, 0, nil, err
	}

	quotaPerUnit := common.QuotaPerUnit
	if quotaPerUnit <= 0 {
		quotaPerUnit = 500000
	}

	// 为每个用户查询实际消耗（从 logs 表，消费 - 退款）
	for _, r := range rows {
		var actualUsedQuota float64
		usedQuery := model.LOG_DB.Model(&model.Log{}).
			Where("user_id = ? AND type IN (?, ?)", r.Id, model.LogTypeConsume, model.LogTypeRefund)
		if startTimestamp > 0 {
			usedQuery = usedQuery.Where("created_at >= ?", startTimestamp)
		}
		if endTimestamp > 0 {
			usedQuery = usedQuery.Where("created_at < ?", endTimestamp)
		}
		usedQuery.Select("COALESCE(SUM(CASE WHEN type = ? THEN quota ELSE -quota END), 0)", model.LogTypeConsume).Scan(&actualUsedQuota)

		tokenTotal := int64(r.Quota + int(actualUsedQuota))
		tokenUsed := int64(actualUsedQuota)
		tokenRemain := int64(r.Quota)
		// 转成人民币
		totalUsedMoney := actualUsedQuota / quotaPerUnit * operation_setting.USDExchangeRate
		totalRemainMoney := float64(r.Quota) / quotaPerUnit * operation_setting.USDExchangeRate
		results = append(results, &dto.UserRevenueSummary{
			Id:               r.Id,
			Username:         r.Username,
			DisplayName:      r.DisplayName,
			TotalTopupMoney:  math.Round(r.TopupMoney*100) / 100,
			TotalUsedMoney:   math.Round(totalUsedMoney*100) / 100,
			TotalRemainMoney: math.Round(totalRemainMoney*100) / 100,
			TokenRemain:      tokenRemain,
			TokenUsed:        tokenUsed,
			TokenTotal:       tokenTotal,
		})
	}

	// 计算统计总额（根据搜索条件和时间范围决定范围）
	var stats dto.UserRevenueStats
	var totalTopup, totalQuota, totalUsedQuota float64

	// 充值总额统计（支持时间范围过滤）
	topupQuery := model.DB.Model(&model.TopUp{}).Where("status = ?", "success")
	if startTimestamp > 0 {
		topupQuery = topupQuery.Where("create_time >= ?", startTimestamp)
	}
	if endTimestamp > 0 {
		topupQuery = topupQuery.Where("create_time < ?", endTimestamp)
	}
	if req.Keyword != "" {
		topupQuery = topupQuery.Where("user_id IN (SELECT id FROM users WHERE deleted_at IS NULL AND (LOWER(username) LIKE LOWER(?) OR LOWER(display_name) LIKE LOWER(?) OR LOWER(email) LIKE LOWER(?)))", keyword, keyword, keyword)
	}
	topupQuery.Select("COALESCE(SUM(money), 0)").Scan(&totalTopup)

	// 使用总额统计（支持时间范围过滤，实际消耗 = 消费 - 退款）
	usedQuery := model.LOG_DB.Model(&model.Log{}).Where("type IN (?, ?)", model.LogTypeConsume, model.LogTypeRefund)
	if startTimestamp > 0 {
		usedQuery = usedQuery.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp > 0 {
		usedQuery = usedQuery.Where("created_at < ?", endTimestamp)
	}
	if req.Keyword != "" {
		usedQuery = usedQuery.Where("user_id IN (SELECT id FROM users WHERE deleted_at IS NULL AND (LOWER(username) LIKE LOWER(?) OR LOWER(display_name) LIKE LOWER(?) OR LOWER(email) LIKE LOWER(?)))", keyword, keyword, keyword)
	}
	usedQuery.Select("COALESCE(SUM(CASE WHEN type = ? THEN quota ELSE -quota END), 0)", model.LogTypeConsume).Scan(&totalUsedQuota)

	// 剩余总额统计（当前状态，不受时间范围影响）
	remainQuery := model.DB.Model(&model.User{}).Where("deleted_at IS NULL")
	if req.Keyword != "" {
		remainQuery = remainQuery.Where("LOWER(username) LIKE LOWER(?) OR LOWER(display_name) LIKE LOWER(?) OR LOWER(email) LIKE LOWER(?)", keyword, keyword, keyword)
	}
	remainQuery.Select("COALESCE(SUM(quota), 0)").Scan(&totalQuota)

	stats.TotalTopupMoney = math.Round(totalTopup*100) / 100
	stats.TotalUsedMoney = math.Round((totalUsedQuota/quotaPerUnit*operation_setting.USDExchangeRate)*100) / 100
	stats.TotalRemainMoney = math.Round((totalQuota/quotaPerUnit*operation_setting.USDExchangeRate)*100) / 100

	return results, total, &stats, nil
}

// ExportUserRevenueReports 导出用户营收列表（CSV）
func (s *FinanceService) ExportUserRevenueReports(req dto.UserRevenueListRequest) (string, error) {
	pageInfo := &common.PageInfo{Page: 1, PageSize: 100000}
	items, _, _, err := s.GetUserRevenueReports(req, pageInfo)
	if err != nil {
		return "", err
	}

	var sb strings.Builder
	sb.WriteString("\xEF\xBB\xBF") // UTF-8 BOM
	sb.WriteString("序号,用户名,充值总额,使用总额,剩余总额,token剩余额度,token使用额度\n")
	for idx, item := range items {
		sb.WriteString(fmt.Sprintf("%d,%s,%.2f,%.2f,%.2f,%d,%d\n",
			idx+1, item.Username, item.TotalTopupMoney, item.TotalUsedMoney, item.TotalRemainMoney, item.TokenRemain, item.TokenUsed))
	}
	return sb.String(), nil
}

// GetUserRevenueDetail 获取用户营收详情
func (s *FinanceService) GetUserRevenueDetail(userId int, req dto.UserRevenueDetailRequest) (*dto.UserRevenueDetailResponse, error) {
	var user model.User
	if err := model.DB.Where("id = ? AND deleted_at IS NULL", userId).First(&user).Error; err != nil {
		return nil, err
	}

	now := time.Now()
	startDate := now.AddDate(0, 0, -30).Format("2006-01-02")
	endDate := now.Format("2006-01-02")
	if req.StartDate != "" {
		startDate = req.StartDate
	}
	if req.EndDate != "" {
		endDate = req.EndDate
	}
	startTime, _ := time.Parse("2006-01-02", startDate)
	endTime, _ := time.Parse("2006-01-02", endDate)
	startTimestamp := startTime.Unix()
	endTimestamp := endTime.Add(24 * time.Hour).Unix()

	quotaPerUnit := common.QuotaPerUnit
	if quotaPerUnit <= 0 {
		quotaPerUnit = 500000
	}

	// 指定时间范围内的充值
	var topupMoney float64
	model.DB.Raw("SELECT COALESCE(SUM(money), 0) FROM top_ups WHERE user_id = ? AND status = ? AND create_time >= ? AND create_time < ?",
		userId, "success", startTimestamp, endTimestamp).Scan(&topupMoney)

	// 指定时间范围内的消耗（实际消耗 = 消费 - 退款）
	var usedQuota int64
	model.LOG_DB.Raw(`
		SELECT COALESCE(SUM(CASE WHEN type = ? THEN quota ELSE -quota END), 0)
		FROM logs
		WHERE user_id = ? AND type IN (?, ?) AND created_at >= ? AND created_at < ?`,
		model.LogTypeConsume, userId, model.LogTypeConsume, model.LogTypeRefund, startTimestamp, endTimestamp).Scan(&usedQuota)

	// 模型消耗（实际消耗 = 消费 - 退款，调用次数只统计消费日志）
	var modelConsumption []*dto.ModelConsumptionItem
	model.LOG_DB.Raw(`
		SELECT model_name as model_name, COALESCE(SUM(CASE WHEN type = ? THEN quota ELSE -quota END), 0) as quota, COUNT(CASE WHEN type = ? THEN 1 END) as count
		FROM logs
		WHERE user_id = ? AND type IN (?, ?) AND created_at >= ? AND created_at < ?
		GROUP BY model_name
		ORDER BY quota DESC
		LIMIT 50`,
		model.LogTypeConsume, model.LogTypeConsume, userId, model.LogTypeConsume, model.LogTypeRefund, startTimestamp, endTimestamp).Scan(&modelConsumption)

	// 充值数据（用于趋势）
	var topups []struct {
		CreateTime int64
		Money      float64
	}
	model.DB.Raw("SELECT create_time, money FROM top_ups WHERE user_id = ? AND status = ? AND create_time >= ? AND create_time < ?",
		userId, "success", startTimestamp, endTimestamp).Scan(&topups)

	// 消耗数据（用于趋势，实际消耗 = 消费 - 退款）
	var logs []struct {
		CreatedAt int64
		Quota     int
		Type      int
	}
	model.LOG_DB.Raw("SELECT created_at, quota, type FROM logs WHERE user_id = ? AND type IN (?, ?) AND created_at >= ? AND created_at < ?",
		userId, model.LogTypeConsume, model.LogTypeRefund, startTimestamp, endTimestamp).Scan(&logs)

	// 调用次数数据（用于趋势）
	var logCounts []struct {
		Date  string
		Count int64
	}

	// 兼容 PostgreSQL 和 SQLite/MySQL
	if common.UsingPostgreSQL {
		model.LOG_DB.Raw("SELECT DATE(TO_TIMESTAMP(created_at)) as date, COUNT(*) as count FROM logs WHERE user_id = ? AND type = ? AND created_at >= ? AND created_at < ? GROUP BY DATE(TO_TIMESTAMP(created_at))",
			userId, model.LogTypeConsume, startTimestamp, endTimestamp).Scan(&logCounts)
	} else {
		// SQLite/MySQL
		model.LOG_DB.Raw("SELECT DATE(created_at, 'unixepoch') as date, COUNT(*) as count FROM logs WHERE user_id = ? AND type = ? AND created_at >= ? AND created_at < ? GROUP BY DATE(created_at, 'unixepoch')",
			userId, model.LogTypeConsume, startTimestamp, endTimestamp).Scan(&logCounts)
	}

	// 生成日期趋势
	dateMap := make(map[string]*dto.UserRevenueTrendItem)
	for i := 0; ; i++ {
		d := startTime.AddDate(0, 0, i)
		if d.After(endTime) {
			break
		}
		dateStr := d.Format("2006-01-02")
		dateMap[dateStr] = &dto.UserRevenueTrendItem{Date: dateStr}
	}

	for _, tp := range topups {
		dateStr := time.Unix(tp.CreateTime, 0).Format("2006-01-02")
		if item, ok := dateMap[dateStr]; ok {
			item.TopupMoney += tp.Money
			// 数据存储的金额是人民币，要先转换成美元再乘以每美元的配额，TopupQuota = tp.Money / operation_setting.USDExchangeRate * quotaPerUnit
			item.TopupQuota += int64(tp.Money / operation_setting.USDExchangeRate * quotaPerUnit)
		}
	}

	for _, lg := range logs {
		dateStr := time.Unix(lg.CreatedAt, 0).Format("2006-01-02")
		if item, ok := dateMap[dateStr]; ok {
			if lg.Type == model.LogTypeConsume {
				item.UsedQuota += int64(lg.Quota)
				item.UsedMoney += float64(lg.Quota) / quotaPerUnit * operation_setting.USDExchangeRate
			} else if lg.Type == model.LogTypeRefund {
				item.UsedQuota -= int64(lg.Quota)
				item.UsedMoney -= float64(lg.Quota) / quotaPerUnit * operation_setting.USDExchangeRate
			}
		}
	}

	for _, lc := range logCounts {
		// 解析 SQL 返回的日期字符串并格式化为 YYYY-MM-DD
		parsedTime, err := time.Parse("2006-01-02T15:04:05Z", lc.Date)
		if err != nil {
			continue
		}
		dateStr := parsedTime.Format("2006-01-02")
		if item, ok := dateMap[dateStr]; ok {
			item.Count += lc.Count
		}
	}

	trend := make([]*dto.UserRevenueTrendItem, 0, len(dateMap))
	for i := 0; ; i++ {
		d := startTime.AddDate(0, 0, i)
		if d.After(endTime) {
			break
		}
		dateStr := d.Format("2006-01-02")
		if item, ok := dateMap[dateStr]; ok {
			item.TopupMoney = math.Round(item.TopupMoney*100) / 100
			item.UsedMoney = math.Round(item.UsedMoney*100) / 100
			trend = append(trend, item)
		}
	}

	// 这里总totaltoken计算是按时间范围来计算的，totaltoken = user.Quota + 本月实际消耗的totaltoken,
	// 不是totaltoken = user.Quota + user.UsedQuota（这是一个不断累加的数据，不能通过时间范围来计算）
	totalToken := int64(user.Quota + int(usedQuota))
	usedMoney := float64(usedQuota) / quotaPerUnit * operation_setting.USDExchangeRate

	remainMoney := float64(user.Quota) / quotaPerUnit * operation_setting.USDExchangeRate
	if remainMoney < 0 {
		remainMoney = 0
	}
	remainToken := int64(user.Quota)
	if remainToken < 0 {
		remainToken = 0
	}

	return &dto.UserRevenueDetailResponse{
		UserId:           user.Id,
		Username:         user.Username,
		DisplayName:      user.DisplayName,
		TotalTopupMoney:  math.Round(topupMoney*100) / 100,
		TotalUsedMoney:   math.Round(usedMoney*100) / 100,
		TotalRemainMoney: math.Round(remainMoney*100) / 100,
		TokenTotal:       totalToken,
		TokenUsed:        usedQuota,
		TokenRemain:      remainToken,
		Trend:            trend,
		ModelConsumption: modelConsumption,
	}, nil
}

// GetUserRevenueTrend 获取用户营收趋势
func (s *FinanceService) GetUserRevenueTrend(userId, days int) ([]*dto.RevenueTrendItem, error) {
	if days <= 0 {
		days = 30
	}

	now := time.Now()
	quotaPerUnit := common.QuotaPerUnit
	if quotaPerUnit <= 0 {
		quotaPerUnit = 500000
	}

	trend := make([]*dto.RevenueTrendItem, 0, days)
	for i := days - 1; i >= 0; i-- {
		date := now.AddDate(0, 0, -i)
		startTime := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location()).Unix()
		endTime := startTime + 86400

		item := &dto.RevenueTrendItem{
			Date: date.Format("2006-01-02"),
		}

		var topupQuery string
		var usedQuery string
		var topupParams []any
		var usedParams []any
		if userId > 0 {
			topupQuery = "SELECT COALESCE(SUM(money), 0) FROM top_ups WHERE user_id = ? AND status = ? AND create_time >= ? AND create_time < ?"
			topupParams = []any{userId, "success", startTime, endTime}
			usedQuery = "SELECT COALESCE(SUM(quota), 0) FROM logs WHERE user_id = ? AND type = ? AND created_at >= ? AND created_at < ?"
			usedParams = []any{userId, model.LogTypeConsume, startTime, endTime}
		} else {
			topupQuery = "SELECT COALESCE(SUM(money), 0) FROM top_ups WHERE status = ? AND create_time >= ? AND create_time < ?"
			topupParams = []any{"success", startTime, endTime}
			usedQuery = "SELECT COALESCE(SUM(quota), 0) FROM logs WHERE type = ? AND created_at >= ? AND created_at < ?"
			usedParams = []any{model.LogTypeConsume, startTime, endTime}
		}

		var topupMoney float64
		var usedQuota int64
		model.DB.Raw(topupQuery, topupParams...).Scan(&topupMoney)
		model.LOG_DB.Raw(usedQuery, usedParams...).Scan(&usedQuota)

		item.Topup = math.Round(topupMoney*100) / 100
		item.Revenue = item.Topup
		item.Consumption = math.Round(float64(usedQuota)/quotaPerUnit*100) / 100
		trend = append(trend, item)
	}

	return trend, nil
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
func (s *FinanceService) GetAllInvoices(req dto.InvoiceListRequest, pageInfo *common.PageInfo) ([]*model.InvoiceRecordWithDetails, int64, error) {
	var startTime, endTime int64
	if req.StartDate != "" {
		if t, err := time.Parse("2006-01-02", req.StartDate); err == nil {
			startTime = t.Unix()
		}
	}
	if req.EndDate != "" {
		if t, err := time.Parse("2006-01-02", req.EndDate); err == nil {
			endTime = t.Add(24 * time.Hour).Unix()
		}
	}
	return model.GetAllInvoiceRecords(req.Status, startTime, endTime, req.Keyword, pageInfo)
}

// ApproveInvoice 审批发票
func (s *FinanceService) ApproveInvoice(id int, status string, remark string, invoiceUrl string) error {
	return model.DB.Model(&model.InvoiceRecord{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":      status,
		"error_msg":   remark,
		"invoice_url": invoiceUrl,
		"updated_at":  time.Now(),
	}).Error
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
	quotaPerUnit := float64(common.QuotaPerUnit)
	refundQuery := fmt.Sprintf(`
		SELECT COALESCE(SUM(ABS(quota) / %f), 0) as total_refund, COUNT(*) as count
		FROM logs
		WHERE type = 6`, quotaPerUnit)
	if userCondition != "" {
		refundQuery += " " + userCondition
	}
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

// ============================================
// 订单图表相关方法
// ============================================

// GetOrderChartStatistics 获取订单图表统计数据（用于 Orders 页面图表）
// 图表只显示"成功"状态的充值记录，且只受时间控件控制
func (s *FinanceService) GetOrderChartStatistics(isAdmin bool, userId int, startTime, endTime int64, status string) (*dto.OrderChartStatistics, error) {
	stats := &dto.OrderChartStatistics{}

	// 图表只统计"成功"状态的充值记录
	status = "success"

	// 判断时间范围是否超过1年，决定按天还是按月聚合
	const oneYearInSeconds = int64(365 * 24 * 60 * 60)
	var groupByClause string
	if endTime-startTime > oneYearInSeconds {
		// 超过1年，按月聚合
		if common.UsingPostgreSQL {
			groupByClause = "DATE_TRUNC('month', TO_TIMESTAMP(create_time))::date"
		} else if common.UsingSQLite {
			groupByClause = "DATE(create_time, 'unixepoch', 'start of month')"
		} else {
			groupByClause = "DATE(FROM_UNIXTIME(create_time), '-01')"
		}
	} else {
		// 1年以内，按天聚合
		if common.UsingPostgreSQL {
			groupByClause = "DATE_TRUNC('day', TO_TIMESTAMP(create_time))::date"
		} else if common.UsingSQLite {
			groupByClause = "DATE(create_time, 'unixepoch')"
		} else {
			groupByClause = "DATE(FROM_UNIXTIME(create_time))"
		}
	}

	// 1. 充值趋势：按天/月统计金额和订单数（只统计成功订单）
	var trendWhere string
	var trendArgs []interface{}
	if !isAdmin {
		trendWhere = "WHERE user_id = ? AND status = 'success'"
		trendArgs = append(trendArgs, userId)
	} else {
		trendWhere = "WHERE status = 'success'"
	}
	if startTime > 0 {
		if trendWhere != "" {
			trendWhere += " AND"
		}
		trendWhere += " create_time >= ?"
		trendArgs = append(trendArgs, startTime)
	}
	if endTime > 0 {
		if trendWhere != "" {
			trendWhere += " AND"
		}
		trendWhere += " create_time <= ?"
		trendArgs = append(trendArgs, endTime)
	}

	trendQuery := fmt.Sprintf(`
		SELECT %s as date,
		       COALESCE(SUM(money), 0) as amount,
		       COUNT(*) as count
		FROM top_ups
		%s
		GROUP BY date ORDER BY date`, groupByClause, trendWhere)

	type trendRow struct {
		Date   string  `db:"date"`
		Amount float64 `db:"amount"`
		Count  int     `db:"count"`
	}

	var trendRows []trendRow
	model.DB.Raw(trendQuery, trendArgs...).Scan(&trendRows)

	for _, row := range trendRows {
		stats.Trend = append(stats.Trend, dto.TrendPoint{
			Date:   row.Date,
			Amount: row.Amount,
			Count:  row.Count,
		})
	}

	// 2. 用户类型分布：按 user_type 统计（只统计成功订单）
	type userTypeRow struct {
		UserType string  `db:"user_type"`
		Amount   float64 `db:"amount"`
		Count    int     `db:"count"`
	}

	var userTypeRows []userTypeRow
	userTypeQuery := `
		SELECT u.user_type, COALESCE(SUM(t.money), 0) as amount, COUNT(*) as count
		FROM top_ups t
		INNER JOIN users u ON t.user_id = u.id
		WHERE t.status = 'success'`
	var userTypeArgs []interface{}

	if !isAdmin {
		userTypeQuery += " AND t.user_id = ?"
		userTypeArgs = append(userTypeArgs, userId)
	}
	if startTime > 0 {
		userTypeQuery += " AND t.create_time >= ?"
		userTypeArgs = append(userTypeArgs, startTime)
	}
	if endTime > 0 {
		userTypeQuery += " AND t.create_time <= ?"
		userTypeArgs = append(userTypeArgs, endTime)
	}

	userTypeQuery += " GROUP BY u.user_type"

	model.DB.Raw(userTypeQuery, userTypeArgs...).Scan(&userTypeRows)

	for _, row := range userTypeRows {
		label := "未认证用户"
		if row.UserType == "1" {
			label = "个人用户"
		} else if row.UserType == "2" {
			label = "企业用户"
		}
		stats.UserTypeDistribution = append(stats.UserTypeDistribution, dto.UserTypeDistribution{
			Label: label,
			Value: row.Amount,
			Count: row.Count,
		})
	}

	return stats, nil
}
