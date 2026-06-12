package service

import (
	"time"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
)

type BillingSummaryService struct{}

var billingSummaryService *BillingSummaryService

func GetBillingSummaryService() *BillingSummaryService {
	if billingSummaryService == nil {
		billingSummaryService = &BillingSummaryService{}
	}
	return billingSummaryService
}

// parseDateToTimestamp 将 YYYY-MM-DD 格式的日期转换为时间戳
func parseDateToTimestamp(dateStr string) int64 {
	t, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return 0
	}
	return t.Unix()
}

// GetModelSummary 获取模型维度汇总
func (s *BillingSummaryService) GetModelSummary(userId int, req dto.BillingSummaryRequest) (*dto.BillingSummaryResponse, error) {
	// 默认最近一周
	if req.StartDate == "" {
		req.StartDate = time.Now().AddDate(0, 0, -7).Format("2006-01-02")
	}
	if req.EndDate == "" {
		req.EndDate = time.Now().Format("2006-01-02")
	}

	startTime := parseDateToTimestamp(req.StartDate)
	endTime := parseDateToTimestamp(req.EndDate) + 86400 // 结束日期加一天

	var items []dto.ModelSummaryItem

	// 构建查询
	query := model.DB.Model(&model.Log{}).
		Select("username, model_name, COUNT(*) as request_count, SUM(prompt_tokens + completion_tokens) as total_tokens, SUM(quota) / 100000.0 as quota_consumed").
		Where("user_id = ? AND type = 2 AND created_at >= ? AND created_at < ?", userId, startTime, endTime)

	query = query.Group("username, model_name").Order("total_tokens DESC")

	if err := query.Scan(&items).Error; err != nil {
		return nil, err
	}

	// 计算总数
	var total int64
	var totalRequestCount int64
	for _, item := range items {
		total += item.TotalTokens
		totalRequestCount += item.RequestCount
	}

	return &dto.BillingSummaryResponse{
		Total:             total,
		TotalRequestCount: totalRequestCount,
		Items:             items,
	}, nil
}

// GetTokenSummary 获取令牌维度汇总
func (s *BillingSummaryService) GetTokenSummary(userId int, req dto.BillingSummaryRequest) (*dto.BillingSummaryResponse, error) {
	// 默认最近一周
	if req.StartDate == "" {
		req.StartDate = time.Now().AddDate(0, 0, -7).Format("2006-01-02")
	}
	if req.EndDate == "" {
		req.EndDate = time.Now().Format("2006-01-02")
	}

	startTime := parseDateToTimestamp(req.StartDate)
	endTime := parseDateToTimestamp(req.EndDate) + 86400 // 结束日期加一天

	var items []dto.TokenSummaryItem

	// 构建查询
	query := model.DB.Model(&model.Log{}).
		Select("username, token_name, COUNT(*) as request_count, SUM(prompt_tokens + completion_tokens) as total_tokens, SUM(quota) / 100000.0 as quota_consumed").
		Where("user_id = ? AND type = 2 AND created_at >= ? AND created_at < ?", userId, startTime, endTime)

	query = query.Group("username, token_name").Order("total_tokens DESC")

	if err := query.Scan(&items).Error; err != nil {
		return nil, err
	}

	// 计算总数
	var total int64
	var totalRequestCount int64
	for _, item := range items {
		total += item.TotalTokens
		totalRequestCount += item.RequestCount
	}

	return &dto.BillingSummaryResponse{
		Total:             total,
		TotalRequestCount: totalRequestCount,
		Items:             items,
	}, nil
}
