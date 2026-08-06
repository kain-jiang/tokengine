package model

import (
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// LogStatistics 日志统计结果
type LogStatistics struct {
	RequestCount    int64 // 请求总数
	QuotaUsed       int64 // 配额消耗总数
	ActiveUserCount int64 // 活跃用户数
}

// TopupStatistics 充值统计结果
type TopupStatistics struct {
	Count       int64   // 充值订单数
	TotalAmount float64 // 充值总金额
}

// ChannelUsageRank 渠道使用排行
type ChannelUsageRank struct {
	ChannelId   int    `json:"channel_id"`
	ChannelName string `json:"channel_name"`
	Count       int64  `json:"count"`
	Quota       int64  `json:"quota"`
	Status      int    `json:"status"`
}

// ModelUsageRank 模型使用排行
type ModelUsageRank struct {
	ModelName string `json:"model_name"`
	Count     int64  `json:"count"`
	Quota     int64  `json:"quota"`
}

// HourlyData 小时数据
type HourlyData struct {
	Hour         int   `json:"hour"`
	RequestCount int64 `json:"request_count"`
	QuotaUsed    int64 `json:"quota_used"`
	UserCount    int64 `json:"user_count"`
}

// DailyData 每日数据
type DailyData struct {
	Date         string  `json:"date"`
	RequestCount int64   `json:"request_count"`
	QuotaUsed    int64   `json:"quota_used"`
	NewUsers     int64   `json:"new_users"`
	TopupAmount  float64 `json:"topup_amount"`
}

// WeeklyData 每周数据
type WeeklyData struct {
	WeekDay      string `json:"week_day"`
	RequestCount int64  `json:"request_count"`
	QuotaUsed    int64  `json:"quota_used"`
}

// GroupDistribution 用户分组分布
type GroupDistribution struct {
	GroupName string `json:"group_name"`
	UserCount int64  `json:"user_count"`
	QuotaUsed int64  `json:"quota_used"`
}

// AlertInfo 告警信息
type AlertInfo struct {
	Type      string `json:"type"` // critical, warn, info
	Message   string `json:"message"`
	Time      string `json:"time"`
	ChannelId int    `json:"channel_id,omitempty"`
}

// QuotaDistributionData 消耗分布数据（按模型和时间）
type QuotaDistributionData struct {
	Time     string `json:"time"`
	Model    string `json:"model"`
	Quota    int64  `json:"quota"`
	RawQuota int64  `json:"raw_quota"`
	TimeSum  int64  `json:"time_sum,omitempty"` // 用于tooltip显示总和
}

// CallTrendData 调用趋势数据（按时间和模型）
type CallTrendData struct {
	Time  string `json:"time"`
	Model string `json:"model"`
	Count int64  `json:"count"`
}

// CallDistributionData 调用次数分布（饼图数据）
type CallDistributionData struct {
	Model string `json:"model"`
	Count int64  `json:"count"`
}

// CallRankData 调用次数排行
type CallRankData struct {
	Model string `json:"model"`
	Count int64  `json:"count"`
}

// UserQuotaRankData 用户消耗排行
type UserQuotaRankData struct {
	User     string `json:"user"`
	Quota    int64  `json:"quota"`
	RawQuota int64  `json:"raw_quota"`
}

// UserQuotaTrendData 用户消耗趋势
type UserQuotaTrendData struct {
	Time     string `json:"time"`
	User     string `json:"user"`
	Quota    int64  `json:"quota"`
	RawQuota int64  `json:"raw_quota"`
}

// GetTotalUserCount 获取用户总数
func GetTotalUserCount() int64 {
	var count int64
	DB.Model(&User{}).Count(&count)
	return count
}

// GetNewUserCount 获取指定时间后的新增用户数
func GetNewUserCount(startTime int64) int64 {
	var count int64
	DB.Model(&User{}).Where("created_at >= ?", startTime).Count(&count)
	return count
}

// GetLogStatistics 获取指定时间范围内的日志统计
func GetLogStatistics(startTime int64, endTime int64) LogStatistics {
	var stats LogStatistics

	// 获取请求总数
	LOG_DB.Model(&Log{}).
		Where("created_at >= ? AND created_at <= ? AND type = ?", startTime, endTime, LogTypeConsume).
		Count(&stats.RequestCount)

	// 获取配额消耗总数
	var quotaSum int64
	LOG_DB.Model(&Log{}).
		Where("created_at >= ? AND created_at <= ? AND type = ?", startTime, endTime, LogTypeConsume).
		Select("COALESCE(SUM(quota), 0)").
		Scan(&quotaSum)
	stats.QuotaUsed = quotaSum

	// 获取活跃用户数（去重）
	var activeUserCount int64
	LOG_DB.Model(&Log{}).
		Where("created_at >= ? AND created_at <= ? AND type = ?", startTime, endTime, LogTypeConsume).
		Distinct("user_id").
		Count(&activeUserCount)
	stats.ActiveUserCount = activeUserCount

	return stats
}

// GetTopupStatistics 获取指定时间范围内的充值统计
func GetTopupStatistics(startTime int64, endTime int64) TopupStatistics {
	var stats TopupStatistics

	// 获取充值订单数（仅成功的）
	DB.Model(&TopUp{}).
		Where("create_time >= ? AND create_time <= ? AND status = ?", startTime, endTime, common.TopUpStatusSuccess).
		Count(&stats.Count)

	// 获取充值总金额
	var totalAmount float64
	DB.Model(&TopUp{}).
		Where("create_time >= ? AND create_time <= ? AND status = ?", startTime, endTime, common.TopUpStatusSuccess).
		Select("COALESCE(SUM(money), 0)").
		Scan(&totalAmount)
	stats.TotalAmount = totalAmount

	return stats
}

// GetActiveChannelCount 获取活跃渠道数（状态正常的）
func GetActiveChannelCount() int64 {
	var count int64
	DB.Model(&Channel{}).Where("status = ?", common.ChannelStatusEnabled).Count(&count)
	return count
}

// GetTotalModelCount 获取模型总数
func GetTotalModelCount() int64 {
	var count int64
	DB.Model(&Model{}).Count(&count)
	return count
}

// GetTopChannels 获取热门渠道（按请求量排序）
func GetTopChannels(limit int) []ChannelUsageRank {
	var results []ChannelUsageRank

	// 从日志中统计渠道使用量
	var channelStats []struct {
		ChannelId int
		Count     int64
		Quota     int64
	}

	now := time.Now()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	LOG_DB.Model(&Log{}).
		Where("created_at >= ? AND type = ?", todayStart.Unix(), LogTypeConsume).
		Select("channel_id as channel_id, COUNT(*) as count, COALESCE(SUM(quota), 0) as quota").
		Group("channel_id").
		Order("count DESC").
		Limit(limit).
		Find(&channelStats)

	// 获取渠道名称和状态
	for _, stat := range channelStats {
		var channel Channel
		if err := DB.Where("id = ?", stat.ChannelId).First(&channel).Error; err == nil {
			results = append(results, ChannelUsageRank{
				ChannelId:   stat.ChannelId,
				ChannelName: channel.Name,
				Count:       stat.Count,
				Quota:       stat.Quota,
				Status:      channel.Status,
			})
		}
	}

	return results
}

// GetTopModels 获取热门模型（按请求量排序）
func GetTopModels(limit int) []ModelUsageRank {
	var results []ModelUsageRank

	now := time.Now()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	LOG_DB.Model(&Log{}).
		Where("created_at >= ? AND type = ?", todayStart.Unix(), LogTypeConsume).
		Select("model_name, COUNT(*) as count, COALESCE(SUM(quota), 0) as quota").
		Group("model_name").
		Order("count DESC").
		Limit(limit).
		Find(&results)

	return results
}

// GetHourlyTrend 获取24小时趋势数据
func GetHourlyTrend(startTime int64, endTime int64) []HourlyData {
	var results []HourlyData

	// 按小时分组统计 - 使用兼容的方式
	now := time.Now()
	for i := 0; i < 24; i++ {
		hour := i
		hourStart := time.Date(now.Year(), now.Month(), now.Day(), hour, 0, 0, 0, now.Location())
		hourEnd := hourStart.Add(time.Hour)

		var stats struct {
			RequestCount int64
			QuotaUsed    int64
			UserCount    int64
		}

		LOG_DB.Model(&Log{}).
			Where("created_at >= ? AND created_at < ? AND type = ?", hourStart.Unix(), hourEnd.Unix(), LogTypeConsume).
			Select("COUNT(*) as request_count, COALESCE(SUM(quota), 0) as quota_used, COUNT(DISTINCT user_id) as user_count").
			Scan(&stats)

		results = append(results, HourlyData{
			Hour:         hour,
			RequestCount: stats.RequestCount,
			QuotaUsed:    stats.QuotaUsed,
			UserCount:    stats.UserCount,
		})
	}

	return results
}

// GetDailyTrend 获取近N天趋势数据
func GetDailyTrend(days int) []DailyData {
	var results []DailyData

	now := time.Now()
	startDate := now.AddDate(0, 0, -days)

	for i := 0; i < days; i++ {
		dayStart := startDate.AddDate(0, 0, i)
		dayEnd := dayStart.Add(24 * time.Hour)

		var stats struct {
			RequestCount int64
			QuotaUsed    int64
			NewUsers     int64
			TopupAmount  float64
		}

		// 获取日志统计
		LOG_DB.Model(&Log{}).
			Where("created_at >= ? AND created_at < ? AND type = ?", dayStart.Unix(), dayEnd.Unix(), LogTypeConsume).
			Select("COUNT(*) as request_count, COALESCE(SUM(quota), 0) as quota_used").
			Scan(&stats)

		// 获取新增用户数
		DB.Model(&User{}).
			Where("created_at >= ? AND created_at < ?", dayStart.Unix(), dayEnd.Unix()).
			Count(&stats.NewUsers)

		// 获取充值金额
		var topupAmount float64
		DB.Model(&TopUp{}).
			Where("create_time >= ? AND create_time < ? AND status = ?", dayStart.Unix(), dayEnd.Unix(), common.TopUpStatusSuccess).
			Select("COALESCE(SUM(money), 0)").
			Scan(&topupAmount)
		stats.TopupAmount = topupAmount

		results = append(results, DailyData{
			Date:         dayStart.Format("2006-01-02"),
			RequestCount: stats.RequestCount,
			QuotaUsed:    stats.QuotaUsed,
			NewUsers:     stats.NewUsers,
			TopupAmount:  stats.TopupAmount,
		})
	}

	return results
}

// GetWeeklyTrend 获取近N周趋势数据
func GetWeeklyTrend(weeks int) []WeeklyData {
	var results []WeeklyData

	now := time.Now()

	for i := 0; i < weeks; i++ {
		weekStart := now.AddDate(0, 0, -i*7)
		weekEnd := weekStart.Add(7 * 24 * time.Hour)

		var stats struct {
			RequestCount int64
			QuotaUsed    int64
		}

		LOG_DB.Model(&Log{}).
			Where("created_at >= ? AND created_at < ? AND type = ?", weekStart.Unix(), weekEnd.Unix(), LogTypeConsume).
			Select("COUNT(*) as request_count, COALESCE(SUM(quota), 0) as quota_used").
			Scan(&stats)

		weekDay := ""
		switch weekStart.Weekday() {
		case time.Monday:
			weekDay = "周一"
		case time.Tuesday:
			weekDay = "周二"
		case time.Wednesday:
			weekDay = "周三"
		case time.Thursday:
			weekDay = "周四"
		case time.Friday:
			weekDay = "周五"
		case time.Saturday:
			weekDay = "周六"
		case time.Sunday:
			weekDay = "周日"
		}

		results = append(results, WeeklyData{
			WeekDay:      weekDay,
			RequestCount: stats.RequestCount,
			QuotaUsed:    stats.QuotaUsed,
		})
	}

	return results
}

// GetUserGroupDistribution 获取用户分组分布
func GetUserGroupDistribution() []GroupDistribution {
	var results []GroupDistribution

	DB.Model(&User{}).
		Select(commonGroupCol + " as group_name, COUNT(*) as user_count, COALESCE(SUM(used_quota), 0) as quota_used").
		Group(commonGroupCol).
		Order("user_count DESC").
		Find(&results)

	return results
}

// GetServiceAvailability 获取服务可用率
func GetServiceAvailability() float64 {
	var totalChannels int64
	var enabledChannels int64

	DB.Model(&Channel{}).Count(&totalChannels)
	DB.Model(&Channel{}).Where("status = ?", common.ChannelStatusEnabled).Count(&enabledChannels)

	if totalChannels == 0 {
		return 100.0
	}

	return float64(enabledChannels) / float64(totalChannels) * 100
}

// GetChannelAlerts 获取渠道告警信息
func GetChannelAlerts() []AlertInfo {
	var alerts []AlertInfo

	// 检查禁用或异常的渠道
	var disabledChannels []Channel
	DB.Model(&Channel{}).Where("status != ?", common.ChannelStatusEnabled).Find(&disabledChannels)

	now := time.Now()
	for _, channel := range disabledChannels {
		alertType := "warn"
		message := fmt.Sprintf("渠道 %s 已禁用", channel.Name)

		if channel.Status == common.ChannelStatusAutoDisabled {
			alertType = "critical"
			message = fmt.Sprintf("渠道 %s 自动禁用（可能测试失败）", channel.Name)
		}

		alerts = append(alerts, AlertInfo{
			Type:      alertType,
			Message:   message,
			Time:      now.Format("15:04:05"),
			ChannelId: channel.Id,
		})
	}

	// 检查最近有错误日志的渠道
	hourStart := now.Add(-1 * time.Hour)

	var errorChannels []struct {
		ChannelId int
		Count     int64
	}

	LOG_DB.Model(&Log{}).
		Where("created_at >= ? AND type = ?", hourStart.Unix(), LogTypeError).
		Select("channel_id, COUNT(*) as count").
		Group("channel_id").
		Having("COUNT(*) > ?", 5).
		Order("COUNT(*) DESC").
		Limit(5).
		Find(&errorChannels)

	for _, ec := range errorChannels {
		var channel Channel
		if err := DB.Where("id = ?", ec.ChannelId).First(&channel).Error; err == nil {
			alerts = append(alerts, AlertInfo{
				Type:      "warn",
				Message:   fmt.Sprintf("渠道 %s 近1小时错误 %d 次", channel.Name, ec.Count),
				Time:      now.Format("15:04:05"),
				ChannelId: ec.ChannelId,
			})
		}
	}

	return alerts
}

// GetQuotaDistribution 获取消耗分布数据（按模型和时间）
func GetQuotaDistribution(startTime, endTime int64) []QuotaDistributionData {
	// 按小时分桶（created_at/3600 为纯整数运算，兼容 SQLite/MySQL/PostgreSQL），
	// 在数据库内完成聚合，避免将整个时间窗口的日志全量拉取到内存。
	var rows []struct {
		HourBucket int64
		ModelName  string
		Quota      int64
	}

	LOG_DB.Model(&Log{}).
		Select("created_at / 3600 AS hour_bucket, model_name, SUM(quota) AS quota").
		Where("created_at >= ? AND created_at <= ? AND type = ?", startTime, endTime, LogTypeConsume).
		Where("quota > 0").
		Group("created_at / 3600, model_name").
		Scan(&rows)

	// 计算每个小时桶的总消耗，用于 TimeSum
	hourSumMap := make(map[int64]int64)
	for _, r := range rows {
		hourSumMap[r.HourBucket] += r.Quota
	}

	results := make([]QuotaDistributionData, 0, len(rows))
	for _, r := range rows {
		model := r.ModelName
		if model == "" {
			model = "unknown"
		}
		results = append(results, QuotaDistributionData{
			Time:     time.Unix(r.HourBucket*3600, 0).Format("2006-01-02 15:00"),
			Model:    model,
			Quota:    r.Quota / 500000, // 转换为显示单位
			RawQuota: r.Quota,
			TimeSum:  hourSumMap[r.HourBucket],
		})
	}

	return results
}

// GetCallTrend 获取调用趋势数据（按时间和模型）
func GetCallTrend(startTime, endTime int64) []CallTrendData {
	// 按天分桶（created_at/86400 纯整数运算，跨数据库兼容），数据库内聚合
	var rows []struct {
		DayBucket int64
		ModelName string
		Count     int64
	}

	LOG_DB.Model(&Log{}).
		Select("created_at / 86400 AS day_bucket, model_name, COUNT(*) AS count").
		Where("created_at >= ? AND created_at <= ? AND type = ?", startTime, endTime, LogTypeConsume).
		Group("created_at / 86400, model_name").
		Scan(&rows)

	results := make([]CallTrendData, 0, len(rows))
	for _, r := range rows {
		model := r.ModelName
		if model == "" {
			model = "unknown"
		}
		results = append(results, CallTrendData{
			Time:  time.Unix(r.DayBucket*86400, 0).Format("2006-01-02"),
			Model: model,
			Count: r.Count,
		})
	}

	return results
}

// GetCallDistribution 获取调用次数分布（饼图数据）
func GetCallDistribution(startTime, endTime int64) []CallDistributionData {
	var results []CallDistributionData

	// 查询并按模型分组统计
	var modelCounts []struct {
		ModelName string
		Count     int64
	}

	LOG_DB.Model(&Log{}).
		Where("created_at >= ? AND created_at <= ? AND type = ?", startTime, endTime, LogTypeConsume).
		Select("model_name, COUNT(*) as count").
		Group("model_name").
		Order("count DESC").
		Limit(20).
		Find(&modelCounts)

	for _, mc := range modelCounts {
		model := mc.ModelName
		if model == "" {
			model = "unknown"
		}
		results = append(results, CallDistributionData{
			Model: model,
			Count: mc.Count,
		})
	}

	return results
}

// GetCallRank 获取调用次数排行
func GetCallRank(startTime, endTime int64) []CallRankData {
	var results []CallRankData

	// 查询并按模型分组统计
	var modelCounts []struct {
		ModelName string
		Count     int64
	}

	LOG_DB.Model(&Log{}).
		Where("created_at >= ? AND created_at <= ? AND type = ?", startTime, endTime, LogTypeConsume).
		Select("model_name, COUNT(*) as count").
		Group("model_name").
		Order("count DESC").
		Limit(10).
		Find(&modelCounts)

	for _, mc := range modelCounts {
		model := mc.ModelName
		if model == "" {
			model = "unknown"
		}
		results = append(results, CallRankData{
			Model: model,
			Count: mc.Count,
		})
	}

	return results
}

// GetUserQuotaRank 获取用户消耗排行（管理员视角）
func GetUserQuotaRank(startTime, endTime int64, limit int) []UserQuotaRankData {
	var results []UserQuotaRankData

	// 查询并按用户分组统计
	var userQuotas []struct {
		Username string
		Quota    int64
	}

	LOG_DB.Model(&Log{}).
		Where("created_at >= ? AND created_at <= ? AND type = ?", startTime, endTime, LogTypeConsume).
		Select("username, SUM(quota) as quota").
		Group("username").
		Order("quota DESC").
		Limit(limit).
		Find(&userQuotas)

	for _, uq := range userQuotas {
		user := uq.Username
		if user == "" {
			user = "unknown"
		}
		results = append(results, UserQuotaRankData{
			User:     user,
			Quota:    uq.Quota / 500000, // 转换为显示单位
			RawQuota: uq.Quota,
		})
	}

	return results
}

// GetUserQuotaTrend 获取用户消耗趋势（管理员视角）
func GetUserQuotaTrend(startTime, endTime int64) []UserQuotaTrendData {
	// 先在数据库内聚合用户总消耗，取前5，避免重复调用 GetUserQuotaRank
	var topUserRows []struct {
		Username string
		Quota    int64
	}
	LOG_DB.Model(&Log{}).
		Select("username, SUM(quota) AS quota").
		Where("created_at >= ? AND created_at <= ? AND type = ?", startTime, endTime, LogTypeConsume).
		Where("quota > 0").
		Group("username").
		Order("quota DESC").
		Limit(5).
		Scan(&topUserRows)

	topUsers := make(map[string]bool)
	for _, u := range topUserRows {
		user := u.Username
		if user == "" {
			user = "unknown"
		}
		topUsers[user] = true
	}

	// 按天+用户聚合消耗，仅保留 Top 用户
	var rows []struct {
		DayBucket int64
		Username  string
		Quota     int64
	}
	LOG_DB.Model(&Log{}).
		Select("created_at / 86400 AS day_bucket, username, SUM(quota) AS quota").
		Where("created_at >= ? AND created_at <= ? AND type = ?", startTime, endTime, LogTypeConsume).
		Where("quota > 0").
		Group("created_at / 86400, username").
		Scan(&rows)

	results := make([]UserQuotaTrendData, 0, len(rows))
	for _, r := range rows {
		user := r.Username
		if user == "" {
			user = "unknown"
		}
		if !topUsers[user] {
			continue
		}
		results = append(results, UserQuotaTrendData{
			Time:     time.Unix(r.DayBucket*86400, 0).Format("2006-01-02"),
			User:     user,
			Quota:    r.Quota / 500000, // 转换为显示单位
			RawQuota: r.Quota,
		})
	}

	return results
}
