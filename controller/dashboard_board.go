package controller

import (
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// DashboardBoardStats 大屏统计数据响应结构
type DashboardBoardStats struct {
	// 核心经营指标
	TodayRevenue      float64 `json:"today_revenue"`       // 今日营收（元）
	TodayQuotaUsed    int64   `json:"today_quota_used"`    // 今日消耗配额（转换为Token）
	TodayRequestCount int64   `json:"today_request_count"` // 今日请求次数
	TodayActiveUsers  int64   `json:"today_active_users"`  // 今日活跃用户
	MonthRevenue      float64 `json:"month_revenue"`       // 本月累计营收

	// 用户数据
	TotalUsers     int64 `json:"total_users"`      // 注册用户总数
	TodayNewUsers  int64 `json:"today_new_users"`  // 今日新增注册
	MonthNewUsers  int64 `json:"month_new_users"`  // 本月新增注册
	TotalActiveDAU int64 `json:"total_active_dau"` // 日活用户数
	TotalActiveMAU int64 `json:"total_active_mau"` // 月活用户数

	// 成本与利润
	TodayProfit       float64 `json:"today_profit"`        // 今日毛利估算
	TodayCost         float64 `json:"today_cost"`          // 今日成本估算
	MarginRate        float64 `json:"margin_rate"`         // 毛利率
	CostPerThousand   float64 `json:"cost_per_thousand"`   // 千Token成本（估算）
	ProfitPerThousand float64 `json:"profit_per_thousand"` // 千Token利润

	// 渠道与模型
	ActiveChannels int64                    `json:"active_channels"` // 活跃渠道数
	TotalModels    int64                    `json:"total_models"`    // 模型总数
	TopModels      []model.ModelUsageRank   `json:"top_models"`      // 热门模型TOP10
	TopChannels    []model.ChannelUsageRank `json:"top_channels"`    // 热门渠道TOP10

	// 订单统计
	TodayTopupCount  int64   `json:"today_topup_count"`  // 今日充值订单数
	TodayTopupAmount float64 `json:"today_topup_amount"` // 今日充值金额
	MonthTopupCount  int64   `json:"month_topup_count"`  // 本月充值订单数
	MonthTopupAmount float64 `json:"month_topup_amount"` // 本月充值金额

	// 时段趋势数据
	HourlyTrend []model.HourlyData `json:"hourly_trend"` // 24小时趋势
	DailyTrend  []model.DailyData  `json:"daily_trend"`  // 近30天趋势
	WeeklyTrend []model.WeeklyData `json:"weekly_trend"` // 近7天趋势

	// 用户分布
	UserGroupDistribution []model.GroupDistribution `json:"user_group_distribution"` // 用户分组分布

	// 实时状态
	OnlineUsers         int64   `json:"online_users"`         // 当前在线用户（估算）
	ConcurrentRequests  int64   `json:"concurrent_requests"`  // 并发请求数（估算）
	ServiceAvailability float64 `json:"service_availability"` // 服务可用率

	// 告警信息
	Alerts []model.AlertInfo `json:"alerts"` // 异常告警
}

// GetDashboardBoardStats 获取大屏统计数据
func GetDashboardBoardStats(c *gin.Context) {
	// 获取当前时间
	now := time.Now()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

	stats := DashboardBoardStats{}

	// 获取用户统计数据
	stats.TotalUsers = model.GetTotalUserCount()
	stats.TodayNewUsers = model.GetNewUserCount(todayStart.Unix())
	stats.MonthNewUsers = model.GetNewUserCount(monthStart.Unix())

	// 获取日志统计数据
	logStats := model.GetLogStatistics(todayStart.Unix(), now.Unix())
	stats.TodayRequestCount = logStats.RequestCount
	stats.TodayQuotaUsed = logStats.QuotaUsed
	stats.TodayActiveUsers = logStats.ActiveUserCount

	// 获取本月日志统计
	monthLogStats := model.GetLogStatistics(monthStart.Unix(), now.Unix())
	stats.TotalActiveMAU = monthLogStats.ActiveUserCount

	// 获取充值统计
	topupStats := model.GetTopupStatistics(todayStart.Unix(), now.Unix())
	stats.TodayTopupCount = topupStats.Count
	stats.TodayTopupAmount = topupStats.TotalAmount
	stats.TodayRevenue = topupStats.TotalAmount

	// 获取本月充值统计
	monthTopupStats := model.GetTopupStatistics(monthStart.Unix(), now.Unix())
	stats.MonthTopupCount = monthTopupStats.Count
	stats.MonthTopupAmount = monthTopupStats.TotalAmount
	stats.MonthRevenue = monthTopupStats.TotalAmount

	// 获取渠道统计
	stats.ActiveChannels = model.GetActiveChannelCount()
	stats.TopChannels = model.GetTopChannels(10)

	// 获取模型统计
	stats.TotalModels = model.GetTotalModelCount()
	stats.TopModels = model.GetTopModels(10)

	// 获取时段趋势数据
	stats.HourlyTrend = model.GetHourlyTrend(todayStart.Unix(), now.Unix())
	stats.DailyTrend = model.GetDailyTrend(30)
	stats.WeeklyTrend = model.GetWeeklyTrend(7)

	// 获取用户分组分布
	stats.UserGroupDistribution = model.GetUserGroupDistribution()

	// 计算成本和利润（基于配额消耗估算）
	// 配额单位转换为实际成本：假设每千Token成本约0.001元（可配置）
	costRatio := common.GetCostRatio() // 获取成本系数
	stats.TodayCost = float64(stats.TodayQuotaUsed) * costRatio / 1000
	stats.TodayProfit = stats.TodayRevenue - stats.TodayCost

	if stats.TodayRevenue > 0 {
		stats.MarginRate = (stats.TodayProfit / stats.TodayRevenue) * 100
	} else {
		stats.MarginRate = 0
	}

	if stats.TodayQuotaUsed > 0 {
		stats.CostPerThousand = stats.TodayCost * 1000 / float64(stats.TodayQuotaUsed)
		stats.ProfitPerThousand = stats.TodayProfit * 1000 / float64(stats.TodayQuotaUsed)
	}

	// 服务可用率（基于渠道状态）
	stats.ServiceAvailability = model.GetServiceAvailability()

	// 告警信息（检查异常渠道）
	stats.Alerts = model.GetChannelAlerts()

	// 在线用户和并发请求（估算）
	stats.OnlineUsers = stats.TodayActiveUsers / 4            // 简单估算
	stats.ConcurrentRequests = stats.TodayRequestCount / 3600 // 每小时请求估算

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    stats,
	})
}

// GetDashboardBoardRealtime 获取大屏实时数据（用于定时刷新）
func GetDashboardBoardRealtime(c *gin.Context) {
	now := time.Now()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	// 只返回最关键的实时数据
	realtimeData := struct {
		RequestCount        int64             `json:"request_count"`
		QuotaUsed           int64             `json:"quota_used"`
		ActiveUsers         int64             `json:"active_users"`
		TodayRevenue        float64           `json:"today_revenue"`
		ServiceAvailability float64           `json:"service_availability"`
		OnlineUsers         int64             `json:"online_users"`
		ConcurrentRequests  int64             `json:"concurrent_requests"`
		Alerts              []model.AlertInfo `json:"alerts"`
	}{}

	logStats := model.GetLogStatistics(todayStart.Unix(), now.Unix())
	realtimeData.RequestCount = logStats.RequestCount
	realtimeData.QuotaUsed = logStats.QuotaUsed
	realtimeData.ActiveUsers = logStats.ActiveUserCount

	topupStats := model.GetTopupStatistics(todayStart.Unix(), now.Unix())
	realtimeData.TodayRevenue = topupStats.TotalAmount

	realtimeData.ServiceAvailability = model.GetServiceAvailability()
	realtimeData.Alerts = model.GetChannelAlerts()
	realtimeData.OnlineUsers = realtimeData.ActiveUsers / 4
	realtimeData.ConcurrentRequests = realtimeData.RequestCount / 3600

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    realtimeData,
	})
}

// DashboardChartData 图表数据响应结构
type DashboardChartData struct {
	// 消耗分布数据
	QuotaDistribution []model.QuotaDistributionData `json:"quota_distribution"`

	// 调用趋势数据
	CallTrend []model.CallTrendData `json:"call_trend"`

	// 调用次数分布
	CallDistribution []model.CallDistributionData `json:"call_distribution"`

	// 调用次数排行
	CallRank []model.CallRankData `json:"call_rank"`

	// 用户消耗排行（管理员）
	UserQuotaRank []model.UserQuotaRankData `json:"user_quota_rank"`

	// 用户消耗趋势（管理员）
	UserQuotaTrend []model.UserQuotaTrendData `json:"user_quota_trend"`
}

// GetDashboardBoardChartData 获取大屏图表数据
func GetDashboardBoardChartData(c *gin.Context) {
	// 获取查询参数
	startTimeStr := c.Query("start_timestamp")
	endTimeStr := c.Query("end_timestamp")

	var startTime, endTime int64
	now := time.Now()

	if startTimeStr != "" {
		startTime = parseInt64(startTimeStr)
	} else {
		// 默认近7天
		startTime = now.AddDate(0, 0, -7).Unix()
	}

	if endTimeStr != "" {
		endTime = parseInt64(endTimeStr)
	} else {
		endTime = now.Unix()
	}

	data := DashboardChartData{}

	// 获取消耗分布数据（按模型和时间）
	data.QuotaDistribution = model.GetQuotaDistribution(startTime, endTime)

	// 获取调用趋势数据（按时间和模型）
	data.CallTrend = model.GetCallTrend(startTime, endTime)

	// 获取调用次数分布（饼图数据）
	data.CallDistribution = model.GetCallDistribution(startTime, endTime)

	// 获取调用次数排行
	data.CallRank = model.GetCallRank(startTime, endTime)

	// 获取用户消耗排行（管理员视角）
	data.UserQuotaRank = model.GetUserQuotaRank(startTime, endTime, 10)

	// 获取用户消耗趋势（管理员视角）
	data.UserQuotaTrend = model.GetUserQuotaTrend(startTime, endTime)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    data,
	})
}

func parseInt64(s string) int64 {
	var result int64
	for _, c := range s {
		if c >= '0' && c <= '9' {
			result = result*10 + int64(c-'0')
		}
	}
	return result
}
