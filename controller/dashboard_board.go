package controller

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/samber/hot"
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

	// 命中缓存时直接返回序列化结果，避免每 30s 轮询重复触发 6 次全量聚合查询。
	// 缓存 key 按分钟取整，使滚动窗口产生的秒级差落入同一缓存桶。
	key := dashboardChartCacheKey(startTime, endTime)
	cache := dashboardChartDataCache()

	body, _, err := cache.GetWithLoaders(key, func(keys []string) (map[string][]byte, error) {
		if len(keys) == 0 {
			return nil, nil
		}
		// 同一缓存桶的并发请求由 hot cache 单飞合并，只执行一次加载；
		// 桶内统一使用取整后的时刻窗口，保证 key 与结果一致。
		st, et := parseDashboardChartCacheKey(keys[0])
		data := buildDashboardChartData(st, et)
		b, err := common.Marshal(map[string]interface{}{
			"success": true,
			"data":    data,
		})
		if err != nil {
			return nil, err
		}
		return map[string][]byte{keys[0]: b}, nil
	})

	if len(body) == 0 || err != nil {
		// 兜底：加载器异常返回空时按原逻辑构建
		data := buildDashboardChartData(startTime, endTime)
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    data,
		})
		return
	}

	c.Data(http.StatusOK, "application/json; charset=utf-8", body)
}

// dashboardChartCacheBucketSec 图表数据缓存桶大小（秒）。
// 前端大屏每 30s 轮询一次，按分钟取整即可让轮询共享同一缓存，同时数据延迟可接受。
const dashboardChartCacheBucketSec = 60

// dashboardChartCacheTTL 图表数据缓存有效期。
const dashboardChartCacheTTL = 60 * time.Second

var dashboardChartCacheOnce sync.Once
var dashboardChartCache *hot.HotCache[string, []byte]

// dashboardChartDataCache 返回大屏图表数据缓存（LRU + TTL + 单飞加载）。
func dashboardChartDataCache() *hot.HotCache[string, []byte] {
	dashboardChartCacheOnce.Do(func() {
		dashboardChartCache = hot.NewHotCache[string, []byte](hot.LRU, 256).
			WithTTL(dashboardChartCacheTTL).
			WithJanitor().
			Build()
	})
	return dashboardChartCache
}

// dashboardChartCacheKey 生成缓存 key（起始/结束时间按分钟取整）。
func dashboardChartCacheKey(startTime, endTime int64) string {
	startBucket := startTime - (startTime % dashboardChartCacheBucketSec)
	endBucket := endTime - (endTime % dashboardChartCacheBucketSec)
	return fmt.Sprintf("%d:%d", startBucket, endBucket)
}

// parseDashboardChartCacheKey 从缓存 key 还原取整后的时间窗口。
func parseDashboardChartCacheKey(key string) (int64, int64) {
	parts := strings.Split(key, ":")
	start, _ := strconv.ParseInt(parts[0], 10, 64)
	var end int64
	if len(parts) > 1 {
		end, _ = strconv.ParseInt(parts[1], 10, 64)
	}
	return start, end
}

// buildDashboardChartData 并行执行 6 个独立的聚合查询，
// 把串行累加耗时（各查询之和）降为并行最大耗时（最慢单个查询）。
func buildDashboardChartData(startTime, endTime int64) DashboardChartData {
	var data DashboardChartData
	var wg sync.WaitGroup
	wg.Add(6)

	go func() {
		defer wg.Done()
		data.QuotaDistribution = model.GetQuotaDistribution(startTime, endTime)
	}()
	go func() {
		defer wg.Done()
		data.CallTrend = model.GetCallTrend(startTime, endTime)
	}()
	go func() {
		defer wg.Done()
		data.CallDistribution = model.GetCallDistribution(startTime, endTime)
	}()
	go func() {
		defer wg.Done()
		data.CallRank = model.GetCallRank(startTime, endTime)
	}()
	go func() {
		defer wg.Done()
		data.UserQuotaRank = model.GetUserQuotaRank(startTime, endTime, 10)
	}()
	go func() {
		defer wg.Done()
		data.UserQuotaTrend = model.GetUserQuotaTrend(startTime, endTime)
	}()

	wg.Wait()
	return data
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
