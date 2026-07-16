package service

import (
	"fmt"
	"math"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
)

// ============================================
// 财务运营概览（Dashboard）v3 相关方法
// ============================================

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
