package service

import (
	"fmt"
	"math"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// ============================================
// 财务运营概览（Dashboard）v3 相关方法
// ============================================

// getPayAsYouGoFilter 生成"按量付费"的 WHERE 条件
// 只选择 billing_source = 'wallet' 的记录，其他所有情况（包括 other 为空/NULL）都不计入
func getPayAsYouGoFilter() string {
	if common.UsingPostgreSQL {
		return " AND ((l.other)::jsonb->>'billing_source') = 'wallet'"
	} else if common.UsingSQLite {
		return " AND json_extract(l.other, '$.billing_source') = 'wallet'"
	} else {
		return " AND (l.other->>'$.billing_source') = 'wallet'"
	}
}

// getWeekStart 获取本周开始时间戳（周一 00:00:00）
func (s *FinanceService) getWeekStart() int64 {
	now := time.Now()
	// Go weekday: Sunday=0, Monday=6
	// We need to calculate days since Monday
	dayOfWeek := int(now.Weekday())
	if dayOfWeek == 0 { // Sunday
		dayOfWeek = 7
	}
	weekStart := time.Date(now.Year(), now.Month(), now.Day()-dayOfWeek+1, 0, 0, 0, 0, now.Location()).Unix()
	return weekStart
}

// getGroupByClause 根据时间范围返回合适的 GROUP BY 子句
func getGroupByClause(startTime, endTime int64) string {
	const oneYearInSeconds = int64(365 * 24 * 60 * 60)
	if endTime-startTime > oneYearInSeconds {
		// 超过1年，按月聚合
		if common.UsingPostgreSQL {
			return "DATE_TRUNC('month', TO_TIMESTAMP(create_time))::date"
		} else if common.UsingSQLite {
			return "DATE(create_time, 'unixepoch', 'start of month')"
		} else {
			return "DATE(FROM_UNIXTIME(create_time), '-01')"
		}
	}
	// 1年以内，按天聚合
	if common.UsingPostgreSQL {
		return "DATE_TRUNC('day', TO_TIMESTAMP(create_time))::date"
	} else if common.UsingSQLite {
		return "DATE(create_time, 'unixepoch')"
	} else {
		return "DATE(FROM_UNIXTIME(create_time))"
	}
}

// getGroupByClauseForCreatedAt 根据时间范围返回合适的 GROUP BY 子句（使用 created_at 列）
func getGroupByClauseForCreatedAt(startTime, endTime int64) string {
	const oneYearInSeconds = int64(365 * 24 * 60 * 60)
	if endTime-startTime > oneYearInSeconds {
		if common.UsingPostgreSQL {
			return "DATE_TRUNC('month', TO_TIMESTAMP(created_at))::date"
		} else if common.UsingSQLite {
			return "DATE(created_at, 'unixepoch', 'start of month')"
		} else {
			return "DATE(FROM_UNIXTIME(created_at), '-01')"
		}
	}
	if common.UsingPostgreSQL {
		return "DATE_TRUNC('day', TO_TIMESTAMP(created_at))::date"
	} else if common.UsingSQLite {
		return "DATE(created_at, 'unixepoch')"
	} else {
		return "DATE(FROM_UNIXTIME(created_at))"
	}
}

// GetDashboardStats 获取财务概览统计指标（9个指标）
func (s *FinanceService) GetDashboardStats(startTime, endTime int64) (*dto.DashboardStats, error) {
	stats := &dto.DashboardStats{}
	weekStart := s.getWeekStart()

	// 1. 用户数量（总注册用户数）
	var totalUsers int64
	model.DB.Model(&model.User{}).Count(&totalUsers)
	stats.TotalUsers = int(totalUsers)

	// 2. 有效充值金额（status=success 的 top_ups 总金额）
	var totalEffectiveTopup float64
	model.DB.Raw(`SELECT COALESCE(SUM(money), 0) FROM top_ups WHERE status = 'success'`).Scan(&totalEffectiveTopup)
	stats.TotalEffectiveTopup = totalEffectiveTopup

	// 3. 成功订单数
	var successOrderCount int64
	model.DB.Raw(`SELECT COUNT(*) FROM top_ups WHERE status = 'success'`).Scan(&successOrderCount)
	stats.SuccessOrderCount = successOrderCount

	// 4. Token调用次数（logs 表中 type=2 的消费记录总数）
	var totalTokenCalls int64
	model.DB.Raw(`SELECT COUNT(*) FROM logs WHERE type = 2`).Scan(&totalTokenCalls)
	stats.TotalTokenCalls = totalTokenCalls

	// 5. 本周充值金额
	var weekTopupAmount float64
	model.DB.Raw(`SELECT COALESCE(SUM(money), 0) FROM top_ups WHERE status = 'success' AND create_time >= ?`, weekStart).Scan(&weekTopupAmount)
	stats.WeekTopupAmount = math.Round(weekTopupAmount*100) / 100

	// 6. 本周Tokens调用次数
	var weekTokenCalls int64
	model.DB.Raw(`SELECT COUNT(*) FROM logs WHERE type = 2 AND created_at >= ?`, weekStart).Scan(&weekTokenCalls)
	stats.WeekTokenCalls = weekTokenCalls

	// 7. 本周营业收入 = 本周充值金额（简化处理）
	stats.WeekRevenue = stats.WeekTopupAmount

	// 8-9. 本周调用次数最多的模型
	type topModelResult struct {
		ModelName string
		Count     int64
	}
	var topModel topModelResult
	model.DB.Raw(`SELECT model_name, COUNT(*) as count FROM logs WHERE type = 2 AND created_at >= ? GROUP BY model_name ORDER BY count DESC LIMIT 1`, weekStart).Scan(&topModel)
	stats.TopModelName = topModel.ModelName
	stats.TopModelCallCount = topModel.Count

	return stats, nil
}

// GetUsersTrend 获取用户注册趋势
func (s *FinanceService) GetUsersTrend(startTime, endTime int64) ([]dto.UserTrendItem, error) {
	items := make([]dto.UserTrendItem, 0)
	groupByClause := getGroupByClauseForCreatedAt(startTime, endTime)

	type userTrendRow struct {
		Date  string `db:"date"`
		Count int    `db:"count"`
	}

	var rows []userTrendRow
	query := fmt.Sprintf(`
		SELECT %s as date, COUNT(*) as count
		FROM users
		WHERE created_at >= ? AND created_at <= ?
		GROUP BY date ORDER BY date`, groupByClause)
	model.DB.Raw(query, startTime, endTime).Scan(&rows)

	for _, row := range rows {
		items = append(items, dto.UserTrendItem{
			Date:  row.Date,
			Count: row.Count,
		})
	}

	return items, nil
}

// GetUsersAuthDistribution 获取用户认证分布
func (s *FinanceService) GetUsersAuthDistribution() (*dto.UserAuthDistribution, error) {
	dist := &dto.UserAuthDistribution{}

	type userTypeRow struct {
		UserType string `db:"user_type"`
		Count    int    `db:"count"`
	}

	var rows []userTypeRow
	model.DB.Raw(`SELECT user_type as user_type, COUNT(*) as count FROM users GROUP BY user_type`).Scan(&rows)

	for _, row := range rows {
		count := row.Count
		switch row.UserType {
		case "0":
			dist.Unverified = count
		case "1":
			dist.Individual = count
		case "2":
			dist.Enterprise = count
		}
	}

	dist.Total = dist.Unverified + dist.Individual + dist.Enterprise
	return dist, nil
}

// GetTopupTrend 获取充值趋势
func (s *FinanceService) GetTopupTrend(startTime, endTime int64) ([]dto.TopupTrendItem, error) {
	items := make([]dto.TopupTrendItem, 0)
	groupByClause := getGroupByClause(startTime, endTime)

	type topupTrendRow struct {
		Date   string  `db:"date"`
		Amount float64 `db:"amount"`
		Count  int     `db:"count"`
	}

	var rows []topupTrendRow
	query := fmt.Sprintf(`
		SELECT %s as date,
		       COALESCE(SUM(money), 0) as amount,
		       COUNT(*) as count
		FROM top_ups
		WHERE status = 'success' AND create_time >= ? AND create_time <= ?
		GROUP BY date ORDER BY date`, groupByClause)
	model.DB.Raw(query, startTime, endTime).Scan(&rows)

	for _, row := range rows {
		items = append(items, dto.TopupTrendItem{
			Date:   row.Date,
			Amount: row.Amount,
			Count:  row.Count,
		})
	}

	return items, nil
}

// GetTopupUserTypeDistribution 获取用户充值分布
func (s *FinanceService) GetTopupUserTypeDistribution(startTime, endTime int64) (*dto.UserTypeTopupDist, error) {
	dist := &dto.UserTypeTopupDist{}

	type userTypeTopupRow struct {
		UserType string  `db:"user_type"`
		Amount   float64 `db:"amount"`
	}

	query := `
		SELECT u.user_type as user_type, COALESCE(SUM(t.money), 0) as amount
		FROM top_ups t
		INNER JOIN users u ON t.user_id = u.id
		WHERE t.status = 'success'`
	var args []interface{}
	if startTime > 0 {
		query += " AND t.create_time >= ?"
		args = append(args, startTime)
	}
	if endTime > 0 {
		query += " AND t.create_time <= ?"
		args = append(args, endTime)
	}
	query += " GROUP BY u.user_type"

	var rows []userTypeTopupRow
	model.DB.Raw(query, args...).Scan(&rows)

	for _, row := range rows {
		switch row.UserType {
		case "0":
			dist.Unverified = row.Amount
		case "1":
			dist.Individual = row.Amount
		case "2":
			dist.Enterprise = row.Amount
		}
	}

	return dist, nil
}

// getLogGroupByClause 为 logs 表生成 GROUP BY 子句
func getLogGroupByClause(startTime, endTime int64) string {
	const oneYearInSeconds = int64(365 * 24 * 60 * 60)
	if endTime-startTime > oneYearInSeconds {
		if common.UsingPostgreSQL {
			return "DATE_TRUNC('month', TO_TIMESTAMP(created_at))::date"
		} else if common.UsingSQLite {
			return "DATE(created_at, 'unixepoch', 'start of month')"
		} else {
			return "DATE(FROM_UNIXTIME(created_at), '-01')"
		}
	}
	if common.UsingPostgreSQL {
		return "DATE_TRUNC('day', TO_TIMESTAMP(created_at))::date"
	} else if common.UsingSQLite {
		return "DATE(created_at, 'unixepoch')"
	} else {
		return "DATE(FROM_UNIXTIME(created_at))"
	}
}

// GetConsumptionTrend 获取消费趋势
func (s *FinanceService) GetConsumptionTrend(startTime, endTime int64) ([]dto.ConsumptionTrendItem, error) {
	items := make([]dto.ConsumptionTrendItem, 0)
	groupByClause := getLogGroupByClause(startTime, endTime)
	quotaPerUnit := common.QuotaPerUnit
	if quotaPerUnit <= 0 {
		quotaPerUnit = 50000000
	}

	type consumptionTrendRow struct {
		Date         string `db:"date"`
		TotalQuota   int64  `db:"total_quota"`
		Tokens       int64  `db:"tokens"`
		RequestCount int    `db:"request_count"`
	}

	var rows []consumptionTrendRow
	query := fmt.Sprintf(`
		SELECT %s as date,
		       COALESCE(SUM(quota), 0) as total_quota,
		       COALESCE(SUM(prompt_tokens + completion_tokens), 0) as tokens,
		       COUNT(*) as request_count
		FROM logs
		WHERE type = 2 AND created_at >= ? AND created_at <= ?
		GROUP BY date ORDER BY date`, groupByClause)
	model.DB.Raw(query, startTime, endTime).Scan(&rows)

	for _, row := range rows {
		cost := float64(row.TotalQuota) / float64(quotaPerUnit)
		items = append(items, dto.ConsumptionTrendItem{
			Date:         row.Date,
			Cost:         math.Round(cost*100) / 100,
			Tokens:       row.Tokens,
			RequestCount: row.RequestCount,
		})
	}

	return items, nil
}

// GetPaymentModeTokensDistribution 获取付费方式Tokens分布
func (s *FinanceService) GetPaymentModeTokensDistribution(startTime, endTime int64) (*dto.PaymentModeTokensDist, error) {
	dist := &dto.PaymentModeTokensDist{}

	// 按量付费Tokens：从 logs 表统计 type=2 的消费
	var payAsYouGoTokens int64
	query := `SELECT COALESCE(SUM(prompt_tokens + completion_tokens), 0) FROM logs WHERE type = 2`
	var args []interface{}
	if startTime > 0 {
		query += " AND created_at >= ?"
		args = append(args, startTime)
	}
	if endTime > 0 {
		query += " AND created_at <= ?"
		args = append(args, endTime)
	}
	model.DB.Raw(query, args...).Scan(&payAsYouGoTokens)
	dist.PayAsYouGo = payAsYouGoTokens

	// 订阅Tokens：从 subscription_usages 表统计（如果存在）
	// 由于没有明确的 subscription_usages 表，这里返回 0
	// 实际实现时需要根据具体的订阅使用表来统计
	dist.Subscription = 0

	return dist, nil
}

// GetRevenueByUser 获取按用户维度的营收分析
func (s *FinanceService) GetRevenueByUser(startTime, endTime int64, pageInfo *common.PageInfo) ([]dto.RevenueByUserItem, int64, error) {
	items := make([]dto.RevenueByUserItem, 0)

	// 统计总记录数
	var total int64
	model.DB.Raw(`
		SELECT COUNT(DISTINCT u.id)
		FROM users u
		INNER JOIN logs l ON u.id = l.user_id
		WHERE l.type = 2 AND l.created_at >= ? AND l.created_at <= ?`, startTime, endTime).Scan(&total)

	// 查询用户营收数据
	type revenueByUserRow struct {
		UserID       int     `db:"user_id"`
		Username     string  `db:"username"`
		PayAsYouGo   float64 `db:"pay_as_you_go"`
		Subscription float64 `db:"subscription"`
	}

	quotaPerUnit := common.QuotaPerUnit
	if quotaPerUnit <= 0 {
		quotaPerUnit = 50000000
	}

	query := `
		SELECT u.id as user_id, u.username,
		       COALESCE(SUM(l.quota), 0) / ? as pay_as_you_go
		FROM users u
		INNER JOIN logs l ON u.id = l.user_id
		WHERE l.type = 2 AND l.created_at >= ? AND l.created_at <= ?
		GROUP BY u.id, u.username
		ORDER BY pay_as_you_go DESC`

	if pageInfo.PageSize > 0 {
		query += fmt.Sprintf(" LIMIT %d OFFSET %d", pageInfo.PageSize, pageInfo.GetStartIdx())
	}

	var rows []revenueByUserRow
	model.DB.Raw(query, quotaPerUnit, startTime, endTime).Scan(&rows)

	for _, row := range rows {
		totalAmount := row.PayAsYouGo + row.Subscription
		items = append(items, dto.RevenueByUserItem{
			UserID:       row.UserID,
			Username:     row.Username,
			PayAsYouGo:   math.Round(row.PayAsYouGo*100) / 100,
			Subscription: math.Round(row.Subscription*100) / 100,
			Total:        math.Round(totalAmount*100) / 100,
		})
	}

	return items, total, nil
}

// GetPayAsYouGoByUser 获取按量付费（消费记录）营收分析
// 统计时间段内每个用户 logs.type=2（消费）的 quota 折算金额（CNY）
func (s *FinanceService) GetPayAsYouGoByUser(startTime, endTime int64, pageInfo *common.PageInfo, username string) ([]dto.PayAsYouGoItem, int64, error) {
	items := make([]dto.PayAsYouGoItem, 0)

	quotaPerUnit := common.QuotaPerUnit
	if quotaPerUnit <= 0 {
		quotaPerUnit = 50000000
	}

	// 获取美元转人民币汇率（与 Log 页面显示一致）
	usdToCnyRate := operation_setting.USDExchangeRate
	if usdToCnyRate <= 0 {
		usdToCnyRate = 7.3
	}

	usernameFilter := ""
	if username != "" {
		usernameFilter = " AND u.username LIKE ?"
	}

	// 统计总记录数（有消费记录的用户数）
	var total int64
	countQuery := `
		SELECT COUNT(DISTINCT u.id)
		FROM users u
		INNER JOIN logs l ON u.id = l.user_id
		WHERE l.type = 2 AND l.created_at >= ? AND l.created_at <= ?`
	countQuery += getPayAsYouGoFilter()
	if username != "" {
		countQuery += " AND u.username LIKE ?"
	}
	args := []interface{}{startTime, endTime}
	if username != "" {
		args = append(args, "%"+username+"%")
	}
	model.LOG_DB.Raw(countQuery, args...).Scan(&total)

	type payAsYouGoRow struct {
		UserID   int     `db:"user_id"`
		Username string  `db:"username"`
		Amount   float64 `db:"amount"`
	}

	query := `
		SELECT u.id as user_id, u.username,
		       COALESCE(SUM(l.quota), 0) / ? as amount
		FROM users u
		INNER JOIN logs l ON u.id = l.user_id
		WHERE l.type = 2 AND l.created_at >= ? AND l.created_at <= ?`
	query += usernameFilter
	query += getPayAsYouGoFilter()
	query += `
		GROUP BY u.id, u.username
		ORDER BY amount DESC`

	if pageInfo.PageSize > 0 {
		query += fmt.Sprintf(" LIMIT %d OFFSET %d", pageInfo.PageSize, pageInfo.GetStartIdx())
	}

	// 构建完整参数
	allArgs := []interface{}{quotaPerUnit, startTime, endTime}
	if username != "" {
		allArgs = append(allArgs, "%"+username+"%")
	}

	var rows []payAsYouGoRow
	model.LOG_DB.Raw(query, allArgs...).Scan(&rows)

	for _, row := range rows {
		// USD → CNY 转换（与 Log 页面 renderQuota 逻辑一致）
		cnyAmount := row.Amount * usdToCnyRate
		items = append(items, dto.PayAsYouGoItem{
			UserID:   row.UserID,
			Username: row.Username,
			Amount:   math.Round(cnyAmount*100) / 100,
		})
	}

	return items, total, nil
}

// GetSubscriptionOrders 获取订阅套餐营收分析
// 关联 subscription_orders 和 user_subscriptions 两个表
// - subscription_orders 提供实际支付金额（money）和订单状态
// - user_subscriptions 提供订阅详情（start_time、end_time、amount_total、amount_used）
// 一个用户购买多个套餐（或同一套餐多次）会产生多条记录
// 使用 subscription_orders.create_time 作为筛选条件，与用户看到的"订阅时间"一致
func (s *FinanceService) GetSubscriptionOrders(startTime, endTime int64, pageInfo *common.PageInfo, username string) ([]dto.SubscriptionOrderItem, int64, error) {
	items := make([]dto.SubscriptionOrderItem, 0)

	// 获取美元汇率
	usdToCnyRate := operation_setting.USDExchangeRate
	if usdToCnyRate <= 0 {
		usdToCnyRate = 7.3
	}

	usernameFilter := ""
	usernameArgs := []interface{}{}
	if username != "" {
		usernameFilter = " AND u.username LIKE ?"
		usernameArgs = append(usernameArgs, "%"+username+"%")
	}

	// 总记录数：基于 user_subscriptions 表查询
	// 使用 user_subscriptions.created_at 作为筛选条件（与 subscription_orders.create_time 基本一致）
	var total int64
	countQuery := `
		SELECT COUNT(us.id)
		FROM user_subscriptions us
		INNER JOIN users u ON u.id = us.user_id
		WHERE us.created_at >= ? AND us.created_at <= ?`
	countArgs := append([]interface{}{startTime, endTime}, usernameArgs...)
	if usernameFilter != "" {
		countQuery += usernameFilter
	}
	model.DB.Raw(countQuery, countArgs...).Scan(&total)

	common.SysLog(fmt.Sprintf("GetSubscriptionOrders: startTime=%d, endTime=%d, username=%s, total=%d", startTime, endTime, username, total))

	type subscriptionOrderRow struct {
		UserID            int     `db:"user_id"`
		Username          string  `db:"username"`
		PlanType          string  `db:"plan_type"`
		PlanName          string  `db:"plan_name"`
		SubscribeTime     int64   `db:"subscribe_time"`
		OrderCompleteTime int64   `db:"order_complete_time"`
		SubStartTime      int64   `db:"sub_start_time"`
		SubExpireTime     int64   `db:"sub_expire_time"`
		SubStatus         string  `db:"sub_status"`
		AmountTotal       int64   `db:"amount_total"`
		AmountUsed        int64   `db:"amount_used"`
		TokensAmount      int64   `db:"tokens_amount"`
		TokensUsed        int64   `db:"tokens_used"`
		PaidAmountUSD     float64 `db:"paid_amount_usd"`
		Source            string  `db:"source"`
	}

	// 构建查询：以 user_subscriptions 为主表，通过 trade_no 精确关联 subscription_orders
	// user_subscriptions 是用户实际拥有的订阅实例，subscription_orders 是支付订单
	// 关联逻辑：
	// 1. 优先通过 trade_no 精确关联（两者都有 trade_no 时）
	// 2. 对于 admin 创建的订阅（trade_no 为空），通过 user_id + plan_id + 时间接近关联
	query := `
		SELECT us.user_id,
		       u.username,
		       COALESCE(p.plan_type, 'quota') as plan_type,
		       COALESCE(p.title, '') as plan_name,
		       us.created_at as subscribe_time,
		       COALESCE(so.complete_time, 0) as order_complete_time,
		       us.start_time as sub_start_time,
		       us.end_time as sub_expire_time,
		       COALESCE(us.status, 'active') as sub_status,
		       us.amount_total as amount_total,
		       us.amount_used as amount_used,
		       COALESCE(us.tokens_limit, 0) as tokens_amount,
		       COALESCE(us.tokens_used, 0) as tokens_used,
		       COALESCE(so.money, 0) as paid_amount_usd,
		       COALESCE(us.source, '') as source
		FROM user_subscriptions us
		INNER JOIN users u ON u.id = us.user_id
		LEFT JOIN subscription_plans p ON p.id = us.plan_id
		LEFT JOIN subscription_orders so ON (so.trade_no = us.trade_no AND us.trade_no != '')
		                                OR (so.user_id = us.user_id AND so.plan_id = us.plan_id AND so.trade_no = '' AND us.trade_no = '' AND ABS(so.create_time - us.created_at) < 300)
		WHERE us.created_at >= ? AND us.created_at <= ?`
	query += usernameFilter
	query += `
		ORDER BY us.created_at DESC`

	if pageInfo.PageSize > 0 {
		query += fmt.Sprintf(" LIMIT %d OFFSET %d", pageInfo.PageSize, pageInfo.GetStartIdx())
	}

	// 构建完整参数
	allArgs := []interface{}{startTime, endTime}
	allArgs = append(allArgs, usernameArgs...)

	var rows []subscriptionOrderRow
	result := model.DB.Raw(query, allArgs...).Scan(&rows)
	common.SysLog(fmt.Sprintf("GetSubscriptionOrders query rows=%d, error=%v", len(rows), result))

	for _, row := range rows {
		planType := row.PlanType
		if planType == "" {
			planType = "quota"
		}
		// 从 subscription_orders 获取实际支付金额（美元），转换为人民币
		paidAmount := row.PaidAmountUSD * usdToCnyRate
		items = append(items, dto.SubscriptionOrderItem{
			UserID:        row.UserID,
			Username:      row.Username,
			PlanType:      planType,
			PlanName:      row.PlanName,
			SubscribeTime: row.SubscribeTime,
			StartTime:     row.SubStartTime,
			ExpireTime:    row.SubExpireTime,
			Status:        row.SubStatus,
			PaidAmount:    math.Round(paidAmount*100) / 100,
			Currency:      "CNY",
			AmountTotal:   row.AmountTotal,
			AmountUsed:    row.AmountUsed,
			TokensAmount:  row.TokensAmount,
			TokensUsed:    row.TokensUsed,
			Source:        row.Source,
		})
	}

	return items, total, nil
}

// GetPaymentModeRevenueDistribution 获取付费方式收入分布
func (s *FinanceService) GetPaymentModeRevenueDistribution(startTime, endTime int64) (*dto.PaymentModeRevenueDist, error) {
	dist := &dto.PaymentModeRevenueDist{}
	quotaPerUnit := common.QuotaPerUnit
	if quotaPerUnit <= 0 {
		quotaPerUnit = 50000000
	}

	// 按量付费收入：从 logs 表统计 type=2 的 quota 转换金额
	var payAsYouGoRevenue float64
	query := `SELECT COALESCE(SUM(quota), 0) FROM logs WHERE type = 2`
	var args []interface{}
	if startTime > 0 {
		query += " AND created_at >= ?"
		args = append(args, startTime)
	}
	if endTime > 0 {
		query += " AND created_at <= ?"
		args = append(args, endTime)
	}
	var totalQuota int64
	model.DB.Raw(query, args...).Scan(&totalQuota)
	payAsYouGoRevenue = float64(totalQuota) / float64(quotaPerUnit)
	dist.PayAsYouGo = math.Round(payAsYouGoRevenue*100) / 100

	// 订阅收入：从 subscription_orders 表统计
	var subscriptionRevenue float64
	subQuery := `SELECT COALESCE(SUM(amount), 0) FROM subscription_orders WHERE status = 'paid'`
	if startTime > 0 {
		subQuery += " AND created_at >= ?"
		subArgs := append([]interface{}{startTime}, args[1:]...)
		model.DB.Raw(subQuery, subArgs...).Scan(&subscriptionRevenue)
	} else {
		model.DB.Raw(subQuery).Scan(&subscriptionRevenue)
	}
	dist.Subscription = math.Round(subscriptionRevenue*100) / 100

	return dist, nil
}

// GetSupplierTrend 获取渠道消费趋势
func (s *FinanceService) GetSupplierTrend(startTime, endTime int64) ([]dto.SupplierTrendItem, error) {
	items := make([]dto.SupplierTrendItem, 0)
	groupByClause := getLogGroupByClause(startTime, endTime)
	quotaPerUnit := common.QuotaPerUnit
	if quotaPerUnit <= 0 {
		quotaPerUnit = 50000000
	}

	// 构建 channel_id -> channel_name 映射
	channelMap := make(map[int]string)
	var channels []model.Channel
	model.DB.Select("id, name").Where("id > 0").Find(&channels)
	for _, ch := range channels {
		channelMap[ch.Id] = ch.Name
	}

	// 获取 logs 表中的渠道信息（只按 channel_id 聚合）
	type supplierTrendRow struct {
		Date         string `db:"date"`
		ChannelId    int    `db:"channel_id"`
		Tokens       int64  `db:"tokens"`
		RequestCount int    `db:"request_count"`
		TotalQuota   int64  `db:"total_quota"`
	}

	query := fmt.Sprintf(`
		SELECT %s as date,
		       l.channel_id,
		       COALESCE(SUM(l.prompt_tokens + l.completion_tokens), 0) as tokens,
		       COUNT(*) as request_count,
		       COALESCE(SUM(l.quota), 0) as total_quota
		FROM logs l
		WHERE l.type = 2 AND l.channel_id > 0 AND l.created_at >= ? AND l.created_at <= ?
		GROUP BY date, l.channel_id
		ORDER BY date`, groupByClause)

	var rows []supplierTrendRow
	model.DB.Raw(query, startTime, endTime).Scan(&rows)

	for _, row := range rows {
		cost := float64(row.TotalQuota) / float64(quotaPerUnit)
		supplierName := channelMap[row.ChannelId]
		if supplierName == "" {
			supplierName = fmt.Sprintf("渠道 #%d", row.ChannelId)
		}
		items = append(items, dto.SupplierTrendItem{
			Date:         row.Date,
			Supplier:     supplierName,
			Tokens:       row.Tokens,
			RequestCount: row.RequestCount,
			Cost:         math.Round(cost*100) / 100,
		})
	}

	return items, nil
}

// GetSupplierDistribution 获取渠道消费占比
func (s *FinanceService) GetSupplierDistribution(startTime, endTime int64) (*dto.SupplierDist, error) {
	dist := &dto.SupplierDist{}

	// 构建 channel_id -> channel_name 映射
	channelMap := make(map[int]string)
	var channels []model.Channel
	model.DB.Select("id, name").Where("id > 0").Find(&channels)
	for _, ch := range channels {
		channelMap[ch.Id] = ch.Name
	}

	type supplierDistRow struct {
		ChannelId  int   `db:"channel_id"`
		TotalQuota int64 `db:"total_quota"`
	}

	query := `
		SELECT l.channel_id, COALESCE(SUM(l.quota), 0) as total_quota
		FROM logs l
		WHERE l.type = 2 AND l.channel_id > 0 AND l.created_at >= ? AND l.created_at <= ?
		GROUP BY l.channel_id`

	var rows []supplierDistRow
	model.DB.Raw(query, startTime, endTime).Scan(&rows)

	// 计算总消费金额
	var totalCost float64
	quotaPerUnit := common.QuotaPerUnit
	if quotaPerUnit <= 0 {
		quotaPerUnit = 50000000
	}
	for _, row := range rows {
		totalCost += float64(row.TotalQuota) / float64(quotaPerUnit)
	}

	dist.Items = make([]dto.SupplierDistItem, 0)
	for _, row := range rows {
		cost := float64(row.TotalQuota) / float64(quotaPerUnit)
		ratio := 0.0
		if totalCost > 0 {
			ratio = cost / totalCost
		}
		supplierName := channelMap[row.ChannelId]
		if supplierName == "" {
			supplierName = fmt.Sprintf("渠道 #%d", row.ChannelId)
		}
		dist.Items = append(dist.Items, dto.SupplierDistItem{
			Supplier: supplierName,
			Cost:     math.Round(cost*100) / 100,
			Ratio:    math.Round(ratio*10000) / 10000,
		})
	}

	// 按消费金额降序排序
	for i := 0; i < len(dist.Items); i++ {
		for j := i + 1; j < len(dist.Items); j++ {
			if dist.Items[j].Cost > dist.Items[i].Cost {
				dist.Items[i], dist.Items[j] = dist.Items[j], dist.Items[i]
			}
		}
	}

	return dist, nil
}

// GetRevenueManagementStats 获取营收管理 头部统计指标
// 聚合时间段内 logs（按量付费）与 subscription_orders（订阅）数据
func (s *FinanceService) GetRevenueManagementStats(startTime, endTime int64) (*dto.RevenueManagementStats, error) {
	stats := &dto.RevenueManagementStats{}

	quotaPerUnit := common.QuotaPerUnit
	if quotaPerUnit <= 0 {
		quotaPerUnit = 50000000
	}

	// 获取美元汇率（用于按量付费和订阅金额的 CNY 转换）
	usdToCnyRate := operation_setting.USDExchangeRate
	if usdToCnyRate <= 0 {
		usdToCnyRate = 7.3
	}

	// 1. 消费用户数：logs.type=2 去重用户（排除订阅抵扣）
	var consumeUserCount int64
	model.LOG_DB.Raw(`
		SELECT COUNT(DISTINCT l.user_id)
		FROM logs l
		WHERE l.type = 2 AND l.created_at >= ? AND l.created_at <= ?`+getPayAsYouGoFilter(),
		startTime, endTime).Scan(&consumeUserCount)
	stats.ConsumeUserCount = consumeUserCount

	// 2. 按量付费金额：logs.type=2 的 quota 折算（USD → CNY，排除订阅抵扣）
	var totalQuota int64
	model.LOG_DB.Raw(`
		SELECT COALESCE(SUM(l.quota), 0)
		FROM logs l
		WHERE l.type = 2 AND l.created_at >= ? AND l.created_at <= ?`+getPayAsYouGoFilter(),
		startTime, endTime).Scan(&totalQuota)
	paygAmountUSD := float64(totalQuota) / float64(quotaPerUnit)
	paygAmountCNY := paygAmountUSD * usdToCnyRate
	stats.PayAsYouGoAmount = math.Round(paygAmountCNY*100) / 100

	// 3 & 4. 订阅付费金额与次数：subscription_orders 成功订单（使用 create_time 与 money 列）
	// money 列是美元，已在上文获取 usdToCnyRate
	var subscriptionAmountUSD float64
	var subscriptionCount int64
	model.DB.Model(&model.SubscriptionOrder{}).
		Where("status = ? AND create_time >= ? AND create_time <= ?", common.TopUpStatusSuccess, startTime, endTime).
		Select("COALESCE(SUM(money), 0)").Scan(&subscriptionAmountUSD)
	model.DB.Model(&model.SubscriptionOrder{}).
		Where("status = ? AND create_time >= ? AND create_time <= ?", common.TopUpStatusSuccess, startTime, endTime).
		Count(&subscriptionCount)
	subscriptionAmountCNY := subscriptionAmountUSD * usdToCnyRate
	stats.SubscriptionAmount = math.Round(subscriptionAmountCNY*100) / 100
	stats.SubscriptionCount = subscriptionCount

	// 5. 热门订阅：购买次数最多的套餐名（按订阅订单数聚合）
	type topPlanRow struct {
		PlanName string `db:"plan_name"`
		Cnt      int64  `db:"cnt"`
	}
	var topRow topPlanRow
	model.DB.Raw(`
		SELECT COALESCE(p.title, ?) as plan_name, COUNT(*) as cnt
		FROM subscription_orders o
		LEFT JOIN subscription_plans p ON p.id = o.plan_id
		WHERE o.status = ? AND o.create_time >= ? AND o.create_time <= ?
		GROUP BY plan_name
		ORDER BY cnt DESC
		LIMIT 1`,
		"未知套餐", common.TopUpStatusSuccess, startTime, endTime).Scan(&topRow)
	stats.TopSubscription = topRow.PlanName

	return stats, nil
}

// GetRevenueManagementExport 获取营收管理 CSV 导出所需的双表数据
func (s *FinanceService) GetRevenueManagementExport(startTime, endTime int64) (*dto.RevenueManagementExportData, error) {
	data := &dto.RevenueManagementExportData{}

	// 按量付费明细（不分页，全量）
	paygItems, _, err := s.GetPayAsYouGoByUser(startTime, endTime, &common.PageInfo{PageSize: 0, Page: 0}, "")
	if err != nil {
		return nil, err
	}
	data.PayAsYouGoItems = paygItems

	// 订阅套餐明细（不分页，全量）
	subItems, _, err := s.GetSubscriptionOrders(startTime, endTime, &common.PageInfo{PageSize: 0, Page: 0}, "")
	if err != nil {
		return nil, err
	}
	data.SubscriptionItems = subItems

	return data, nil
}

// GetDashboardRevenueTrend 获取营收趋势数据（按量付费 + 订阅套餐）
func (s *FinanceService) GetDashboardRevenueTrend(startTime, endTime int64) (*dto.DashboardRevenueTrendResponse, error) {
	response := &dto.DashboardRevenueTrendResponse{}
	response.PayAsYouGo = make([]dto.DashboardRevenueTrendItem, 0)
	response.Subscription = make([]dto.DashboardRevenueTrendItem, 0)

	quotaPerUnit := common.QuotaPerUnit
	if quotaPerUnit <= 0 {
		quotaPerUnit = 50000000
	}

	// 获取美元汇率（转换为 CNY）
	usdToCnyRate := operation_setting.USDExchangeRate
	if usdToCnyRate <= 0 {
		usdToCnyRate = 7.3
	}

	// 1. 按量付费趋势：从 logs 表统计 type=2（消费记录，排除订阅抵扣）
	// 订阅套餐营收由单独的 subscription 趋势统计，两者互斥不重复
	type revenueTrendRow struct {
		Date   string  `db:"date"`
		Amount float64 `db:"amount"`
	}

	var paygRows []revenueTrendRow
	paygGroupBy := getLogGroupByClause(startTime, endTime)
	paygFilter := getPayAsYouGoFilter()
	query := fmt.Sprintf(`
		SELECT %s as date,
		       COALESCE(SUM(l.quota), 0) / ? * ? as amount
		FROM logs l
		WHERE l.type = 2 AND l.created_at >= ? AND l.created_at <= ?%s
		GROUP BY date ORDER BY date`, paygGroupBy, paygFilter)
	model.LOG_DB.Raw(query, quotaPerUnit, usdToCnyRate, startTime, endTime).Scan(&paygRows)
	for _, row := range paygRows {
		response.PayAsYouGo = append(response.PayAsYouGo, dto.DashboardRevenueTrendItem{
			Date:   row.Date,
			Amount: math.Round(row.Amount*100) / 100,
		})
	}

	// 2. 订阅套餐趋势：从 subscription_orders 表统计成功订单
	var subRows []revenueTrendRow
	subGroupBy := getGroupByClause(startTime, endTime)
	subQuery := fmt.Sprintf(`
		SELECT %s as date,
		       COALESCE(SUM(money), 0) * ? as amount
		FROM subscription_orders
		WHERE status = ? AND create_time >= ? AND create_time <= ?
		GROUP BY date ORDER BY date`, subGroupBy)
	model.DB.Raw(subQuery, usdToCnyRate, common.TopUpStatusSuccess, startTime, endTime).Scan(&subRows)
	for _, row := range subRows {
		response.Subscription = append(response.Subscription, dto.DashboardRevenueTrendItem{
			Date:   row.Date,
			Amount: math.Round(row.Amount*100) / 100,
		})
	}

	return response, nil
}
