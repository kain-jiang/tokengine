package service

import (
	"fmt"
	"math"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// ============================================
// SupplierSettlementService 供应商结算服务
// ============================================

type SupplierSettlementService struct{}

var supplierSettlementServiceInstance *SupplierSettlementService

func GetSupplierSettlementService() *SupplierSettlementService {
	if supplierSettlementServiceInstance == nil {
		supplierSettlementServiceInstance = &SupplierSettlementService{}
	}
	return supplierSettlementServiceInstance
}

// GenerateSettlement 生成结算单
func (s *SupplierSettlementService) GenerateSettlement(vendorId int, period string, periodType string, operatorId int) (*model.SupplierSettlement, error) {
	// 计算周期时间范围
	startTime, endTime, err := s.calculatePeriodTime(period, periodType)
	if err != nil {
		return nil, err
	}

	// 检查是否已存在相同周期的结算单
	existing, _ := model.GetSettlementsByPeriod(period)
	for _, e := range existing {
		if e.VendorId == vendorId && e.Status != model.SettlementStatusCancelled {
			return nil, fmt.Errorf("该供应商在该周期的结算单已存在")
		}
	}

	// 获取供应商信息
	vendor, err := model.GetVendorByID(vendorId)
	if err != nil {
		return nil, fmt.Errorf("供应商不存在")
	}

	// 获取该供应商的所有费率配置
	pricings, err := model.GetPricingsByVendor(vendorId)
	if err != nil || len(pricings) == 0 {
		return nil, fmt.Errorf("该供应商没有配置的费率")
	}

	// 统计调用数据（从logs表）
	stats := s.getCallStats(vendorId, startTime, endTime)

	// 创建结算单
	settlement := &model.SupplierSettlement{
		VendorId:          vendorId,
		VendorName:        vendor.Name,
		Period:            period,
		PeriodType:        periodType,
		StartTime:         startTime,
		EndTime:           endTime,
		Status:            model.SettlementStatusPending,
		TotalInputTokens:  stats.TotalInputTokens,
		TotalOutputTokens: stats.TotalOutputTokens,
		TotalCalls:        stats.TotalCalls,
	}

	if err := settlement.Insert(); err != nil {
		return nil, err
	}

	// 生成结算明细
	details, totalCost := s.generateSettlementDetails(settlement.Id, vendorId, pricings, stats)

	settlement.TotalCost = totalCost
	if err := settlement.Update(); err != nil {
		return nil, err
	}

	// 批量插入明细
	if len(details) > 0 {
		model.BatchInsertDetails(details)
	}

	return settlement, nil
}

// CallStats 调用统计数据
type CallStats struct {
	TotalInputTokens  int64
	TotalOutputTokens int64
	TotalCalls        int
	// 按模型统计
	ByModel map[int64]*ModelCallStats
}

// ModelCallStats 按模型的调用统计
type ModelCallStats struct {
	InputTokens  int64
	OutputTokens int64
	CallCount    int
}

// getCallStats 统计调用数据 - 从logs表获取
func (s *SupplierSettlementService) getCallStats(vendorId int, startTime, endTime int64) *CallStats {
	// TODO: 实际实现需要从logs表统计
	// 这里返回空统计，实际使用时需要根据logs表结构实现
	stats := &CallStats{
		ByModel: make(map[int64]*ModelCallStats),
	}

	// 这里需要根据实际的logs表结构来统计
	// 例如：
	// model.DB.Model(&model.Log{}).
	// 	Where("vendor_id = ? AND created_at BETWEEN ? AND ?", vendorId, startTime, endTime).
	// 	Select("SUM(prompt_tokens) as input_tokens, SUM(completion_tokens) as output_tokens, COUNT(*) as call_count").
	// 	Find(&stats)

	return stats
}

// generateSettlementDetails 生成结算明细
func (s *SupplierSettlementService) generateSettlementDetails(settlementId, vendorId int, pricings []*model.SupplierPricing, stats *CallStats) ([]*model.SupplierSettlementDetail, float64) {
	var details []*model.SupplierSettlementDetail
	var totalCost float64

	for _, pricing := range pricings {
		modelStats, exists := stats.ByModel[int64(pricing.ModelId)]
		if !exists {
			continue
		}

		detail := &model.SupplierSettlementDetail{
			SettlementId:  settlementId,
			VendorId:      vendorId,
			ModelId:       pricing.ModelId,
			ModelName:     pricing.ModelName,
			TokenRange:    pricing.TokenRange,
			PricingMethod: pricing.PricingMethod,
			InputTokens:   modelStats.InputTokens,
			OutputTokens:  modelStats.OutputTokens,
			CallCount:     modelStats.CallCount,
		}

		// 计算费用
		detail.TotalCost = s.CalculateSettlementCost(detail, pricing)
		totalCost += detail.TotalCost

		details = append(details, detail)
	}

	return details, math.Round(totalCost*100) / 100
}

// CalculateSettlementCost 计算结算费用
func (s *SupplierSettlementService) CalculateSettlementCost(detail *model.SupplierSettlementDetail, pricing *model.SupplierPricing) float64 {
	return model.CalculateCost(pricing, detail.InputTokens, detail.OutputTokens, int64(detail.CallCount), 0)
}

// GetSettlementById 根据ID获取结算单
func (s *SupplierSettlementService) GetSettlementById(id int) (*model.SupplierSettlement, error) {
	return model.GetSupplierSettlementById(id)
}

// GetSettlementsByVendor 获取指定供应商的结算单
func (s *SupplierSettlementService) GetSettlementsByVendor(vendorId int, pageInfo *common.PageInfo) ([]*model.SupplierSettlement, int64, error) {
	return model.GetSettlementsByVendor(vendorId, pageInfo)
}

// GetAllSettlements 获取所有结算单
func (s *SupplierSettlementService) GetAllSettlements(pageInfo *common.PageInfo) ([]*model.SupplierSettlement, int64, error) {
	return model.GetAllSupplierSettlements(pageInfo)
}

// GetSettlementDetails 获取结算单明细
func (s *SupplierSettlementService) GetSettlementDetails(settlementId int) ([]*model.SupplierSettlementDetail, error) {
	return model.GetSettlementDetails(settlementId)
}

// SearchSupplierSettlements 搜索结算单
func (s *SupplierSettlementService) SearchSupplierSettlements(vendorId int, period string, status string, pageInfo *common.PageInfo) ([]*model.SupplierSettlement, int64, error) {
	return model.SearchSupplierSettlements(vendorId, period, status, pageInfo)
}

// ConfirmSettlement 确认结算单
func (s *SupplierSettlementService) ConfirmSettlement(id int, operatorId int) error {
	settlement, err := model.GetSupplierSettlementById(id)
	if err != nil {
		return fmt.Errorf("结算单不存在")
	}

	if settlement.Status != model.SettlementStatusPending {
		return fmt.Errorf("只有待确认的结算单才能确认")
	}

	// 确认结算单
	if err := settlement.Confirm(operatorId); err != nil {
		return err
	}

	// 更新供应商账户余额
	return s.updateAccountBalance(settlement)
}

// MarkAsPaid 标记已付款
func (s *SupplierSettlementService) MarkAsPaid(id int, operatorId int) error {
	settlement, err := model.GetSupplierSettlementById(id)
	if err != nil {
		return fmt.Errorf("结算单不存在")
	}

	if settlement.Status != model.SettlementStatusConfirmed {
		return fmt.Errorf("只有已确认的结算单才能标记为已付款")
	}

	return settlement.MarkAsPaid(operatorId)
}

// CancelSettlement 取消结算单
func (s *SupplierSettlementService) CancelSettlement(id int, operatorId int) error {
	settlement, err := model.GetSupplierSettlementById(id)
	if err != nil {
		return fmt.Errorf("结算单不存在")
	}

	if settlement.Status == model.SettlementStatusPaid {
		return fmt.Errorf("已付款的结算单不能取消")
	}

	return settlement.Cancel()
}

// GenerateAllSettlements 批量生成所有供应商的结算单
func (s *SupplierSettlementService) GenerateAllSettlements(period string, periodType string) error {
	// 获取所有有费率配置的供应商
	vendors, err := model.GetAllVendors(0, 0)
	if err != nil {
		return err
	}

	for _, vendor := range vendors {
		// 检查该供应商是否有费率配置
		pricings, _ := model.GetPricingsByVendor(vendor.Id)
		if len(pricings) == 0 {
			continue
		}

		// 生成结算单
		_, err := s.GenerateSettlement(vendor.Id, period, periodType, 0)
		if err != nil {
			common.SysLog(fmt.Sprintf("生成供应商 %s 的结算单失败: %v", vendor.Name, err))
			continue
		}
	}

	return nil
}

// updateAccountBalance 更新供应商账户余额
func (s *SupplierSettlementService) updateAccountBalance(settlement *model.SupplierSettlement) error {
	account, err := model.GetOrCreateSupplierAccount(settlement.VendorId, settlement.VendorName)
	if err != nil {
		return err
	}

	// 扣费
	return account.Deduct(settlement.TotalCost)
}

// calculatePeriodTime 计算周期时间范围
func (s *SupplierSettlementService) calculatePeriodTime(period string, periodType string) (int64, int64, error) {
	var startTime, endTime int64

	switch periodType {
	case model.PeriodTypeMonthly:
		// period 格式: 2026-06
		t, err := time.Parse("2006-01", period)
		if err != nil {
			return 0, 0, fmt.Errorf("周期格式错误: %v", err)
		}
		startTime = t.Unix()
		// 下月第一天
		nextMonth := t.AddDate(0, 1, 0)
		endTime = nextMonth.Unix()
	case model.PeriodTypeDaily:
		// period 格式: 2026-06-30
		t, err := time.Parse("2006-01-02", period)
		if err != nil {
			return 0, 0, fmt.Errorf("周期格式错误: %v", err)
		}
		startTime = t.Unix()
		endTime = t.AddDate(0, 0, 1).Unix()
	default:
		return 0, 0, fmt.Errorf("不支持的周期类型: %s", periodType)
	}

	return startTime, endTime, nil
}

// SearchSupplierSettlementsForExport 导出结算单（无分页）
func (s *SupplierSettlementService) SearchSupplierSettlementsForExport(vendorId int, period string, status string) ([]*model.SupplierSettlement, error) {
	var settlements []*model.SupplierSettlement
	query := model.DB.Model(&model.SupplierSettlement{})

	if vendorId > 0 {
		query = query.Where("vendor_id = ?", vendorId)
	}
	if period != "" {
		query = query.Where("period = ?", period)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}

	err := query.Order("create_time desc").Find(&settlements).Error
	return settlements, err
}

// SettlementStatistics 结算统计数据结构
type SettlementStatistics struct {
	TotalSettlements     int64   `json:"total_settlements"`     // 总结算数
	PendingSettlements   int64   `json:"pending_settlements"`   // 待确认结算数
	ConfirmedSettlements int64   `json:"confirmed_settlements"` // 已确认结算数
	PaidSettlements      int64   `json:"paid_settlements"`      // 已支付结算数
	TotalAmount          float64 `json:"total_amount"`          // 总金额
	PendingAmount        float64 `json:"pending_amount"`        // 待确认金额
	ConfirmedAmount      float64 `json:"confirmed_amount"`      // 已确认金额
	PaidAmount           float64 `json:"paid_amount"`           // 已支付金额
}

// GetSettlementStatistics 获取结算统计
func (s *SupplierSettlementService) GetSettlementStatistics(vendorId int) (*SettlementStatistics, error) {
	stats := &SettlementStatistics{}

	// 总结算数
	query := model.DB.Model(&model.SupplierSettlement{})
	if vendorId > 0 {
		query = query.Where("vendor_id = ?", vendorId)
	}
	query.Count(&stats.TotalSettlements)

	// 待确认结算数
	pendingQuery := model.DB.Model(&model.SupplierSettlement{})
	if vendorId > 0 {
		pendingQuery = pendingQuery.Where("vendor_id = ?", vendorId)
	}
	pendingQuery.Where("status = ?", model.SettlementStatusPending).Count(&stats.PendingSettlements)

	// 已确认结算数
	confirmedQuery := model.DB.Model(&model.SupplierSettlement{})
	if vendorId > 0 {
		confirmedQuery = confirmedQuery.Where("vendor_id = ?", vendorId)
	}
	confirmedQuery.Where("status = ?", model.SettlementStatusConfirmed).Count(&stats.ConfirmedSettlements)

	// 已支付结算数
	paidQuery := model.DB.Model(&model.SupplierSettlement{})
	if vendorId > 0 {
		paidQuery = paidQuery.Where("vendor_id = ?", vendorId)
	}
	paidQuery.Where("status = ?", model.SettlementStatusPaid).Count(&stats.PaidSettlements)

	// 总金额
	var totalResult struct {
		Total float64 `gorm:"column:total"`
	}
	totalQ := model.DB.Model(&model.SupplierSettlement{})
	if vendorId > 0 {
		totalQ = totalQ.Where("vendor_id = ?", vendorId)
	}
	totalQ.Select("COALESCE(SUM(total_cost), 0) as total").Scan(&totalResult)
	stats.TotalAmount = totalResult.Total

	// 待确认金额
	var pendingResult struct {
		Total float64 `gorm:"column:total"`
	}
	pendingAmountQ := model.DB.Model(&model.SupplierSettlement{})
	if vendorId > 0 {
		pendingAmountQ = pendingAmountQ.Where("vendor_id = ?", vendorId)
	}
	pendingAmountQ.Where("status = ?", model.SettlementStatusPending).Select("COALESCE(SUM(total_cost), 0) as total").Scan(&pendingResult)
	stats.PendingAmount = pendingResult.Total

	// 已确认金额
	var confirmedResult struct {
		Total float64 `gorm:"column:total"`
	}
	confirmedAmountQ := model.DB.Model(&model.SupplierSettlement{})
	if vendorId > 0 {
		confirmedAmountQ = confirmedAmountQ.Where("vendor_id = ?", vendorId)
	}
	confirmedAmountQ.Where("status = ?", model.SettlementStatusConfirmed).Select("COALESCE(SUM(total_cost), 0) as total").Scan(&confirmedResult)
	stats.ConfirmedAmount = confirmedResult.Total

	// 已支付金额
	var paidResult struct {
		Total float64 `gorm:"column:total"`
	}
	paidAmountQ := model.DB.Model(&model.SupplierSettlement{})
	if vendorId > 0 {
		paidAmountQ = paidAmountQ.Where("vendor_id = ?", vendorId)
	}
	paidAmountQ.Where("status = ?", model.SettlementStatusPaid).Select("COALESCE(SUM(total_cost), 0) as total").Scan(&paidResult)
	stats.PaidAmount = paidResult.Total

	return stats, nil
}
