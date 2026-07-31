package service

import (
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
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
		Select("username, model_name, COUNT(*) as request_count, SUM(prompt_tokens + completion_tokens) as total_tokens, "+fmt.Sprintf("SUM(quota) / %f as quota_consumed", common.QuotaPerUnit)).
		Where("user_id = ? AND type = ? AND created_at >= ? AND created_at < ?", userId, model.LogTypeConsume, startTime, endTime)

	query = query.Group("username, model_name").Order("total_tokens DESC")

	if err := query.Scan(&items).Error; err != nil {
		return nil, err
	}

	querySets := model.DB.Model(&model.Log{}).
		Select("model_name, "+fmt.Sprintf("SUM(quota) / %f as refund_quota", common.QuotaPerUnit)).
		Where("user_id = ? AND type = ? AND created_at >= ? AND created_at < ?", userId, model.LogTypeRefund, startTime, endTime)

	querySets = querySets.Group("username, model_name")

	var refundItems []struct {
		ModelName   string  `json:"model_name"`
		RefundQuota float64 `json:"refund_quota"`
	}

	// 这里不判断错误
	querySets.Scan(&refundItems)

	// 计算总数
	// TODO 是否应减去退回来的token
	var total int64
	var totalRequestCount int64
	for _, item := range items {
		total += item.TotalTokens
		totalRequestCount += item.RequestCount
	}

	// 计算实际消耗
	// actualQuota = quota_consumed(预扣费额度)  - refund_quota(退款额度)
	var info []dto.ModelSummaryItem
	if len(refundItems) > 0 {
		dic := make(map[string]float64)
		for _, item := range refundItems {
			dic[item.ModelName] = item.RefundQuota
		}
		for _, v := range items {
			v.QuotaConsumed -= dic[v.ModelName]
			info = append(info, v)
		}
	} else {
		info = items
	}

	return &dto.BillingSummaryResponse{
		Total:             total,
		TotalRequestCount: totalRequestCount,
		Items:             info,
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
		Select("username, token_name, COUNT(*) as request_count, SUM(prompt_tokens + completion_tokens) as total_tokens, "+fmt.Sprintf("SUM(quota) / %f as quota_consumed", common.QuotaPerUnit)).
		Where("user_id = ? AND type = ? AND created_at >= ? AND created_at < ?", userId, model.LogTypeConsume, startTime, endTime)

	query = query.Group("username, token_name").Order("total_tokens DESC")

	if err := query.Scan(&items).Error; err != nil {
		return nil, err
	}

	querySets := model.DB.Model(&model.Log{}).
		Select("token_name, "+fmt.Sprintf("SUM(quota) / %f as refund_quota", common.QuotaPerUnit)).
		Where("user_id = ? AND type = ? AND created_at >= ? AND created_at < ?", userId, model.LogTypeRefund, startTime, endTime)

	querySets = querySets.Group("username, token_name")

	var refundItems []struct {
		TokenName   string  `json:"token_name"`
		RefundQuota float64 `json:"refund_quota"`
	}

	// 这里不判断错误
	querySets.Scan(&refundItems)

	// 计算总数
	var total int64
	var totalRequestCount int64
	for _, item := range items {
		total += item.TotalTokens
		totalRequestCount += item.RequestCount
	}

	// 计算实际消耗
	// actualQuota = quota_consumed(预扣费额度)  - refund_quota(退款额度)
	var info []dto.TokenSummaryItem
	if len(refundItems) > 0 {
		dic := make(map[string]float64)
		for _, item := range refundItems {
			dic[item.TokenName] = item.RefundQuota
		}
		for _, v := range items {
			v.QuotaConsumed -= dic[v.TokenName]
			info = append(info, v)
		}
	} else {
		info = items
	}

	return &dto.BillingSummaryResponse{
		Total:             total,
		TotalRequestCount: totalRequestCount,
		Items:             info,
	}, nil
}
