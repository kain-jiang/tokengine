package service

import (
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
)

// GetClientUserAgentDistribution 获取客户端 User-Agent 分布统计（按请求次数聚合）
func (s *FinanceService) GetClientUserAgentDistribution(startTime, endTime int64) ([]dto.DashboardUserAgentDistributionItem, error) {
	type userAgentRow struct {
		UserAgent string `json:"user_agent"`
		Count     int64  `json:"count"`
	}

	var rows []userAgentRow

	// 只统计消费日志（type=2），按 user_agent 分组统计
	query := `
		SELECT user_agent as user_agent, COUNT(*) as count
		FROM logs
		WHERE type = 2 AND created_at >= ? AND created_at <= ? AND user_agent != ''
		GROUP BY user_agent
		ORDER BY count DESC
		LIMIT 50`

	model.LOG_DB.Raw(query, startTime, endTime).Scan(&rows)

	// 转换为返回格式
	result := make([]dto.DashboardUserAgentDistributionItem, 0, len(rows))
	for _, row := range rows {
		// 截断过长的 user_agent 以便显示
		ua := row.UserAgent
		if len(ua) > 200 {
			ua = ua[:200] + "..."
		}
		result = append(result, dto.DashboardUserAgentDistributionItem{
			UserAgent: ua,
			Count:     int(row.Count),
		})
	}

	return result, nil
}

// GetUserAgentStats 获取 User-Agent 相关的统计指标
func (s *FinanceService) GetUserAgentStats(startTime, endTime int64) (totalRequests int64, uniqueAgents int64, err error) {
	// 总请求数
	model.LOG_DB.Model(&model.Log{}).
		Where("type = ? AND created_at >= ? AND created_at <= ? AND user_agent != ''", 2, startTime, endTime).
		Count(&totalRequests)

	// 唯一 User-Agent 数量
	type countRow struct {
		Count int64 `gorm:"column:count"`
	}
	var rows []countRow
	model.LOG_DB.Raw(`
		SELECT COUNT(DISTINCT user_agent) as count
		FROM logs
		WHERE type = 2 AND created_at >= ? AND created_at <= ? AND user_agent != ''
	`, startTime, endTime).Scan(&rows)
	if len(rows) > 0 {
		uniqueAgents = rows[0].Count
	}

	return totalRequests, uniqueAgents, nil
}
