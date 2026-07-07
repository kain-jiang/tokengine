package model

import (
	"github.com/QuantumNous/new-api/common"
)

// ============================================
// 返点状态常量
// ============================================

const (
	RebateStatusPending   = "pending"   // 待同步
	RebateStatusSynced    = "synced"    // 已同步
	RebateStatusFailed    = "failed"    // 同步失败
	RebateStatusConfirmed = "confirmed" // 已确认
)

// ============================================
// 返点来源常量
// ============================================

const (
	RebateSourceManual = "manual" // 手动录入
	RebateSourceAuto   = "auto"   // 自动同步
)

// ============================================
// 返点类型常量
// ============================================

const (
	RebateTypeToken  = "token"  // token返点
	RebateTypeAmount = "amount" // 金额返点
)

// ============================================
// SupplierRebate 供应商返点记录模型
// ============================================

type SupplierRebate struct {
	Id           int     `json:"id" gorm:"primaryKey"`
	VendorId     int     `json:"vendor_id" gorm:"index"`
	VendorName   string  `json:"vendor_name" gorm:"type:varchar(200)"`
	Period       string  `json:"period" gorm:"type:varchar(20);index"`
	RebateType   string  `json:"rebate_type" gorm:"type:varchar(50)"`
	RebateAmount float64 `json:"rebate_amount" gorm:"type:decimal(12,4)"`
	RebateTokens int64   `json:"rebate_tokens" gorm:"default:0"`
	Status       string  `json:"status" gorm:"type:varchar(20);default:pending;index"`
	Source       string  `json:"source" gorm:"type:varchar(50)"`
	Remark       string  `json:"remark" gorm:"type:varchar(500)"`
	CreateTime   int64   `json:"create_time" gorm:"index"`
	UpdateTime   int64   `json:"update_time"`
}

func (SupplierRebate) TableName() string {
	return "supplier_rebate"
}

// Insert 插入返点记录
func (rebate *SupplierRebate) Insert() error {
	rebate.CreateTime = common.GetTimestamp()
	rebate.UpdateTime = rebate.CreateTime
	if rebate.Status == "" {
		rebate.Status = RebateStatusPending
	}
	if rebate.Source == "" {
		rebate.Source = RebateSourceManual
	}
	return DB.Create(rebate).Error
}

// Update 更新返点记录
func (rebate *SupplierRebate) Update() error {
	rebate.UpdateTime = common.GetTimestamp()
	return DB.Model(&SupplierRebate{}).Where("id = ?", rebate.Id).Updates(rebate).Error
}

// Delete 删除返点记录
func (rebate *SupplierRebate) Delete() error {
	return DB.Delete(rebate).Error
}

// MarkAsSynced 标记为已同步
func (rebate *SupplierRebate) MarkAsSynced() error {
	rebate.Status = RebateStatusSynced
	rebate.UpdateTime = common.GetTimestamp()
	return DB.Model(&SupplierRebate{}).Where("id = ?", rebate.Id).Updates(rebate).Error
}

// MarkAsFailed 标记为同步失败
func (rebate *SupplierRebate) MarkAsFailed(reason string) error {
	rebate.Status = RebateStatusFailed
	rebate.Remark = reason
	rebate.UpdateTime = common.GetTimestamp()
	return DB.Model(&SupplierRebate{}).Where("id = ?", rebate.Id).Updates(rebate).Error
}

// GetSupplierRebateById 根据ID获取返点记录
func GetSupplierRebateById(id int) (*SupplierRebate, error) {
	var rebate SupplierRebate
	err := DB.Where("id = ?", id).First(&rebate).Error
	return &rebate, err
}

// GetAllSupplierRebates 获取所有返点记录（分页）
func GetAllSupplierRebates(pageInfo *common.PageInfo) ([]*SupplierRebate, int64, error) {
	var rebates []*SupplierRebate
	var total int64

	query := DB.Model(&SupplierRebate{}).Order("create_time desc")

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = query.Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&rebates).Error
	return rebates, total, err
}

// SearchSupplierRebates 搜索返点记录
func SearchSupplierRebates(vendorId int, period string, status string, pageInfo *common.PageInfo) ([]*SupplierRebate, int64, error) {
	var rebates []*SupplierRebate
	var total int64

	query := DB.Model(&SupplierRebate{})

	if vendorId > 0 {
		query = query.Where("vendor_id = ?", vendorId)
	}
	if period != "" {
		query = query.Where("period = ?", period)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}

	query = query.Order("create_time desc")

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = query.Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&rebates).Error
	return rebates, total, err
}

// GetRebatesByVendor 获取指定供应商的返点记录
func GetRebatesByVendor(vendorId int, pageInfo *common.PageInfo) ([]*SupplierRebate, int64, error) {
	var rebates []*SupplierRebate
	var total int64

	query := DB.Model(&SupplierRebate{}).Where("vendor_id = ?", vendorId).Order("create_time desc")

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = query.Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&rebates).Error
	return rebates, total, err
}

// GetRebatesByPeriod 获取指定周期的返点记录
func GetRebatesByPeriod(period string) ([]*SupplierRebate, error) {
	var rebates []*SupplierRebate
	err := DB.Where("period = ?", period).Find(&rebates).Error
	return rebates, err
}

// GetTotalRebateByVendor 获取指定供应商的返点总额
func GetTotalRebateByVendor(vendorId int) float64 {
	var result struct {
		Total float64 `json:"total"`
	}
	DB.Model(&SupplierRebate{}).Where("vendor_id = ? AND status = ?", vendorId, RebateStatusSynced).Select("COALESCE(SUM(rebate_amount), 0)").Scan(&result)
	return result.Total
}

// GetTotalRebateByPeriod 获取指定周期的返点总额
func GetTotalRebateByPeriod(period string) float64 {
	var result struct {
		Total float64 `json:"total"`
	}
	DB.Model(&SupplierRebate{}).Where("period = ? AND status = ?", period, RebateStatusSynced).Select("COALESCE(SUM(rebate_amount), 0)").Scan(&result)
	return result.Total
}

// ============================================
// SupplierRebateStatistics 返点统计
// ============================================

type SupplierRebateStatistics struct {
	TotalRebate       float64 `json:"total_rebate"`        // 总返点金额
	TotalRebateTokens int64   `json:"total_rebate_tokens"` // 总返点token
	RebateCount       int64   `json:"rebate_count"`        // 返点记录数
	PendingRebate     float64 `json:"pending_rebate"`      // 待确认返点
}

// GetRebateStatistics 获取返点统计
func GetRebateStatistics(vendorId int) (*SupplierRebateStatistics, error) {
	stats := &SupplierRebateStatistics{}

	query := DB.Model(&SupplierRebate{})
	if vendorId > 0 {
		query = query.Where("vendor_id = ?", vendorId)
	}

	// 总返点
	var result struct {
		TotalRebate       float64 `json:"total_rebate"`
		TotalRebateTokens int64   `json:"total_rebate_tokens"`
		RebateCount       int64   `json:"rebate_count"`
	}
	query.Select("COALESCE(SUM(rebate_amount), 0) as total_rebate, COALESCE(SUM(rebate_tokens), 0) as total_rebate_tokens, COUNT(*) as rebate_count").Scan(&result)
	stats.TotalRebate = result.TotalRebate
	stats.TotalRebateTokens = result.TotalRebateTokens
	stats.RebateCount = result.RebateCount

	// 待确认返点
	var pendingResult struct {
		Total float64 `json:"total"`
	}
	pendingQuery := DB.Model(&SupplierRebate{})
	if vendorId > 0 {
		pendingQuery = pendingQuery.Where("vendor_id = ?", vendorId)
	}
	pendingQuery.Where("status = ?", RebateStatusPending).Select("COALESCE(SUM(rebate_amount), 0)").Scan(&pendingResult)
	stats.PendingRebate = pendingResult.Total

	return stats, nil
}
