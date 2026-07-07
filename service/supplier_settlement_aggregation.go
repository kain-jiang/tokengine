package service

import (
	"fmt"
	"math"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// ============================================
// SupplierSettlementAggregationService 供应商结算聚合查询服务
// ============================================

type SupplierSettlementAggregationService struct{}

// SupplierSettlementItem 供应商结算列表项（聚合数据）
type SupplierSettlementItem struct {
	Id                      int     `json:"id"`
	VendorId                int     `json:"vendor_id"`
	VendorName              string  `json:"vendor_name"`
	Channel                 string  `json:"channel"`
	Model                   string  `json:"model"`
	OfficialInputPrice      float64 `json:"official_input_price"`
	Quota                   float64 `json:"quota"`
	Tokens                  int64   `json:"tokens"`
	PricingMethod           string  `json:"pricing_method"`
	PlatformConsumedTokens  int64   `json:"platform_consumed_tokens"`
	PlatformCost            float64 `json:"platform_cost"`
	PlatformRemainingTokens int64   `json:"platform_remaining_tokens"`
	PlatformRemainingAmount float64 `json:"platform_remaining_amount"`
	RebateAmount            float64 `json:"rebate_amount"`
	Status                  string  `json:"status"`
	Period                  string  `json:"period"`
	CreateTime              int64   `json:"create_time"`
	UpdateTime              int64   `json:"update_time"`
}

// SupplierRebateItem 用户侧返点记录项
type SupplierRebateItem struct {
	Id           int     `json:"id"`
	VendorId     int     `json:"vendor_id"`
	VendorName   string  `json:"vendor_name"`
	Period       string  `json:"period"`
	RebateType   string  `json:"rebate_type"`
	RebateAmount float64 `json:"rebate_amount"`
	RebateTokens int64   `json:"rebate_tokens"`
	Status       string  `json:"status"`
	Source       string  `json:"source"`
	Remark       string  `json:"remark"`
	CreateTime   int64   `json:"create_time"`
	UpdateTime   int64   `json:"update_time"`
}

// RebateStatistics 返点统计数据
type RebateStatistics struct {
	TotalRebates      int64   `json:"total_rebates"`
	SuccessedRebates  int64   `json:"successed_rebates"`
	FailedRebates     int64   `json:"failed_rebates"`
	PendingRebates    int64   `json:"pending_rebates"`
	TotalRebateAmount float64 `json:"total_rebate_amount"`
	TotalRebateTokens int64   `json:"total_rebate_tokens"`
}

var supplierSettlementAggregationService *SupplierSettlementAggregationService

// GetSupplierSettlementAggregationService 获取聚合查询服务单例
func GetSupplierSettlementAggregationService() *SupplierSettlementAggregationService {
	if supplierSettlementAggregationService == nil {
		supplierSettlementAggregationService = &SupplierSettlementAggregationService{}
	}
	return supplierSettlementAggregationService
}

// GetSupplierSettlementList 获取供应商结算列表（聚合查询）
func (s *SupplierSettlementAggregationService) GetSupplierSettlementList(pageInfo *common.PageInfo, vendorId int, modelId int, status string) ([]SupplierSettlementItem, int64, error) {
	var allItems []SupplierSettlementItem
	var total int64

	// 获取所有结算单
	var allSettlements []*model.SupplierSettlement
	query := model.DB.Model(&model.SupplierSettlement{})
	if vendorId > 0 {
		query = query.Where("vendor_id = ?", vendorId)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	err := query.Order("create_time desc").Find(&allSettlements).Error
	if err != nil {
		return nil, 0, err
	}

	total = int64(len(allSettlements))

	// 获取供应商账户信息
	accountMap := make(map[int]*model.SupplierAccount)
	for _, settlement := range allSettlements {
		if _, exists := accountMap[settlement.VendorId]; !exists {
			account, err := model.GetSupplierAccountByVendorId(settlement.VendorId)
			if err == nil && account != nil {
				accountMap[settlement.VendorId] = account
			}
		}
	}

	// 获取所有费率配置
	var allPricings []*model.SupplierPricing
	pricingQuery := model.DB.Model(&model.SupplierPricing{})
	if vendorId > 0 {
		pricingQuery = pricingQuery.Where("vendor_id = ?", vendorId)
	}
	if modelId > 0 {
		pricingQuery = pricingQuery.Where("model_id = ?", modelId)
	}
	pricingQuery.Find(&allPricings)

	// 按vendor_id分组费率配置
	pricingByVendor := make(map[int][]*model.SupplierPricing)
	for _, pricing := range allPricings {
		pricingByVendor[pricing.VendorId] = append(pricingByVendor[pricing.VendorId], pricing)
	}

	// 聚合数据
	for _, settlement := range allSettlements {
		pricings := pricingByVendor[settlement.VendorId]
		if len(pricings) == 0 {
			continue
		}

		// 获取返点金额
		var totalRebate float64
		model.DB.Model(&model.SupplierRebate{}).
			Where("vendor_id = ? AND period = ? AND status = ?", settlement.VendorId, settlement.Period, "successed").
			Select("COALESCE(SUM(rebate_amount), 0)").
			Scan(&totalRebate)

		// 获取账户信息
		var account *model.SupplierAccount
		var accExists bool
		account, accExists = accountMap[settlement.VendorId]

		// 为每个费率配置创建一个列表项
		for _, pricing := range pricings {
			item := SupplierSettlementItem{
				Id:                     settlement.Id,
				VendorId:               settlement.VendorId,
				VendorName:             settlement.VendorName,
				Model:                  pricing.ModelName,
				Channel:                pricing.Region,
				OfficialInputPrice:     pricing.OfficialInputPrice,
				Tokens:                 settlement.TotalInputTokens + settlement.TotalOutputTokens,
				PricingMethod:          pricing.PricingMethod,
				PlatformCost:           settlement.TotalCost,
				Status:                 settlement.Status,
				Period:                 settlement.Period,
				CreateTime:             settlement.CreateTime,
				UpdateTime:             settlement.UpdateTime,
				RebateAmount:           totalRebate,
				PlatformConsumedTokens: settlement.TotalInputTokens + settlement.TotalOutputTokens,
			}

			// 从账户获取剩余金额
			if accExists {
				item.PlatformRemainingAmount = account.Balance
				// 剩余token估算（余额 / 平均token价格）
				if pricing.OfficialInputPrice > 0 {
					item.PlatformRemainingTokens = int64(account.Balance / pricing.OfficialInputPrice * 1000000)
				}
			}

			allItems = append(allItems, item)
		}
	}

	// 分页处理
	page := pageInfo.Page
	pageSize := pageInfo.PageSize
	startIdx := (page - 1) * pageSize
	endIdx := startIdx + pageSize

	if startIdx > int(len(allItems)) {
		allItems = []SupplierSettlementItem{}
	} else {
		if endIdx > int(len(allItems)) {
			endIdx = int(len(allItems))
		}
		allItems = allItems[startIdx:endIdx]
	}

	return allItems, total, nil
}

// GetRebateList 获取返点记录列表
func (s *SupplierSettlementAggregationService) GetRebateList(pageInfo *common.PageInfo, vendorId int, status string) ([]SupplierRebateItem, int64, error) {
	var rebates []*model.SupplierRebate
	var total int64

	query := model.DB.Model(&model.SupplierRebate{})
	if vendorId > 0 {
		query = query.Where("vendor_id = ?", vendorId)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	query = query.Order("create_time desc")

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = query.Limit(pageInfo.PageSize).Offset((pageInfo.Page - 1) * pageInfo.PageSize).Find(&rebates).Error
	if err != nil {
		return nil, 0, err
	}

	items := make([]SupplierRebateItem, len(rebates))
	for i, rebate := range rebates {
		items[i] = SupplierRebateItem{
			Id:           rebate.Id,
			VendorId:     rebate.VendorId,
			VendorName:   rebate.VendorName,
			Period:       rebate.Period,
			RebateType:   rebate.RebateType,
			RebateAmount: rebate.RebateAmount,
			RebateTokens: rebate.RebateTokens,
			Status:       rebate.Status,
			Source:       rebate.Source,
			Remark:       rebate.Remark,
			CreateTime:   rebate.CreateTime,
			UpdateTime:   rebate.UpdateTime,
		}
	}

	return items, total, nil
}

// CreateManualSettlement 手动创建供应商结算记录
func (s *SupplierSettlementAggregationService) CreateManualSettlement(req *model.SupplierSettlement) error {
	// 验证供应商是否存在
	vendor, err := model.GetVendorByID(req.VendorId)
	if err != nil {
		return fmt.Errorf("供应商不存在")
	}
	req.VendorName = vendor.Name

	// 设置默认值
	if req.PeriodType == "" {
		req.PeriodType = model.PeriodTypeMonthly
	}
	if req.Status == "" {
		req.Status = model.SettlementStatusPending
	}
	if req.TotalCost == 0 {
		req.TotalCost = req.PendingAmount
		req.PendingAmount = 0
	}

	return req.Insert()
}

// CreateManualRebate 手动创建返点记录
func (s *SupplierSettlementAggregationService) CreateManualRebate(req *model.SupplierRebate) error {
	// 验证供应商是否存在
	_, err := model.GetVendorByID(req.VendorId)
	if err != nil {
		return fmt.Errorf("供应商不存在")
	}

	// 设置默认值
	if req.Status == "" {
		req.Status = RebateStatusPending
	}
	if req.RebateType == "" {
		req.RebateType = RebateTypeManual
	}
	if req.Source == "" {
		req.Source = "manual"
	}

	return req.Insert()
}

// UpdateRebateStatus 更新返点记录状态
func (s *SupplierSettlementAggregationService) UpdateRebateStatus(rebateId int, status string, remark string) error {
	rebate, err := model.GetSupplierRebateById(rebateId)
	if err != nil {
		return fmt.Errorf("返点记录不存在")
	}

	if status == RebateStatusSuccessed {
		rebate.Status = RebateStatusSuccessed
		if remark != "" {
			rebate.Remark = remark
		}
		return rebate.Update()
	} else if status == RebateStatusFailed {
		rebate.Status = RebateStatusFailed
		if remark != "" {
			rebate.Remark = remark
		}
		return rebate.Update()
	}
	return fmt.Errorf("无效的状态: %s", status)
}

// GetRebateStatistics 获取返点统计
func (s *SupplierSettlementAggregationService) GetRebateStatistics(vendorId int) (*RebateStatistics, error) {
	stats := &RebateStatistics{}

	query := model.DB.Model(&model.SupplierRebate{})
	if vendorId > 0 {
		query = query.Where("vendor_id = ?", vendorId)
	}

	// 总返点数
	query.Count(&stats.TotalRebates)

	// 各状态数量
	successedQuery := model.DB.Model(&model.SupplierRebate{})
	if vendorId > 0 {
		successedQuery = successedQuery.Where("vendor_id = ?", vendorId)
	}
	successedQuery.Where("status = ?", RebateStatusSuccessed).Count(&stats.SuccessedRebates)

	failedQuery := model.DB.Model(&model.SupplierRebate{})
	if vendorId > 0 {
		failedQuery = failedQuery.Where("vendor_id = ?", vendorId)
	}
	failedQuery.Where("status = ?", RebateStatusFailed).Count(&stats.FailedRebates)

	pendingQuery := model.DB.Model(&model.SupplierRebate{})
	if vendorId > 0 {
		pendingQuery = pendingQuery.Where("vendor_id = ?", vendorId)
	}
	pendingQuery.Where("status = ?", RebateStatusPending).Count(&stats.PendingRebates)

	// 总金额和token
	var totalResult struct {
		Amount float64 `gorm:"column:total_amount"`
		Tokens int64   `gorm:"column:total_tokens"`
	}
	amountQuery := model.DB.Model(&model.SupplierRebate{})
	if vendorId > 0 {
		amountQuery = amountQuery.Where("vendor_id = ?", vendorId)
	}
	amountQuery.Select("COALESCE(SUM(rebate_amount), 0) as total_amount, COALESCE(SUM(rebate_tokens), 0) as total_tokens").Scan(&totalResult)
	stats.TotalRebateAmount = totalResult.Amount
	stats.TotalRebateTokens = totalResult.Tokens

	return stats, nil
}

// ExportSupplierSettlementList 导出供应商结算列表（完整数据，用于CSV导出）
func (s *SupplierSettlementAggregationService) ExportSupplierSettlementList(vendorId int, modelId int, status string) ([]SupplierSettlementItem, error) {
	items, _, err := s.GetSupplierSettlementList(&common.PageInfo{Page: 1, PageSize: 10000}, vendorId, modelId, status)
	return items, err
}

// ExportRebateList 导出返点列表（用于CSV导出）
func (s *SupplierSettlementAggregationService) ExportRebateList(vendorId int, status string) ([]SupplierRebateItem, error) {
	items, _, err := s.GetRebateList(&common.PageInfo{Page: 1, PageSize: 10000}, vendorId, status)
	return items, err
}

// ============================================
// 返点状态常量
// ============================================

const (
	RebateStatusPending   = "pending"   // 待同步
	RebateStatusSuccessed = "successed" // 同步成功
	RebateStatusFailed    = "failed"    // 同步失败
)

const (
	RebateTypeManual    = "manual"    // 手动
	RebateTypeAutomatic = "automatic" // 自动
	RebateTypePromotion = "promotion" // 活动返点
)

// math 用于浮点运算
var _ = math.Round
