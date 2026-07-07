package model

import (
	"github.com/QuantumNous/new-api/common"
)

// ============================================
// 结算单状态常量
// ============================================

const (
	SettlementStatusPending   = "pending"   // 待确认
	SettlementStatusConfirmed = "confirmed" // 已确认
	SettlementStatusPaid      = "paid"      // 已付款
	SettlementStatusCancelled = "cancelled" // 已取消
)

// ============================================
// 结算周期类型常量
// ============================================

const (
	PeriodTypeDaily   = "daily"   // 日结
	PeriodTypeMonthly = "monthly" // 月结
)

// ============================================
// SupplierSettlement 供应商结算单模型
// ============================================

type SupplierSettlement struct {
	Id                int     `json:"id" gorm:"primaryKey"`
	VendorId          int     `json:"vendor_id" gorm:"index"`
	VendorName        string  `json:"vendor_name" gorm:"type:varchar(200)"`
	Period            string  `json:"period" gorm:"type:varchar(20);index"`
	PeriodType        string  `json:"period_type" gorm:"type:varchar(10)"`
	StartTime         int64   `json:"start_time" gorm:"index"`
	EndTime           int64   `json:"end_time"`
	TotalInputTokens  int64   `json:"total_input_tokens" gorm:"default:0"`
	TotalOutputTokens int64   `json:"total_output_tokens" gorm:"default:0"`
	TotalCalls        int     `json:"total_calls" gorm:"default:0"`
	TotalCost         float64 `json:"total_cost" gorm:"type:decimal(12,2)"`
	PaidAmount        float64 `json:"paid_amount" gorm:"type:decimal(12,2);default:0"`
	PendingAmount     float64 `json:"pending_amount" gorm:"type:decimal(12,2);default:0"`
	Status            string  `json:"status" gorm:"type:varchar(20);default:pending"`
	Remark            string  `json:"remark" gorm:"type:varchar(500)"`
	CreateTime        int64   `json:"create_time" gorm:"index"`
	UpdateTime        int64   `json:"update_time"`
	ConfirmedBy       int     `json:"confirmed_by" gorm:"default:0"`
	ConfirmedAt       int64   `json:"confirmed_at"`
	PaidBy            int     `json:"paid_by" gorm:"default:0"`
	PaidAt            int64   `json:"paid_at"`
}

func (SupplierSettlement) TableName() string {
	return "supplier_settlement"
}

// Insert 插入结算单
func (settlement *SupplierSettlement) Insert() error {
	settlement.CreateTime = common.GetTimestamp()
	settlement.UpdateTime = settlement.CreateTime
	if settlement.PendingAmount == 0 {
		settlement.PendingAmount = settlement.TotalCost
	}
	return DB.Create(settlement).Error
}

// Update 更新结算单
func (settlement *SupplierSettlement) Update() error {
	settlement.UpdateTime = common.GetTimestamp()
	// 重新计算待付金额
	settlement.PendingAmount = settlement.TotalCost - settlement.PaidAmount
	return DB.Model(&SupplierSettlement{}).Where("id = ?", settlement.Id).Updates(settlement).Error
}

// Delete 删除结算单
func (settlement *SupplierSettlement) Delete() error {
	return DB.Delete(settlement).Error
}

// Confirm 确认结算单
func (settlement *SupplierSettlement) Confirm(operatorId int) error {
	settlement.Status = SettlementStatusConfirmed
	settlement.ConfirmedBy = operatorId
	settlement.ConfirmedAt = common.GetTimestamp()
	settlement.UpdateTime = common.GetTimestamp()
	return DB.Model(&SupplierSettlement{}).Where("id = ?", settlement.Id).Updates(settlement).Error
}

// MarkAsPaid 标记已付款
func (settlement *SupplierSettlement) MarkAsPaid(operatorId int) error {
	settlement.Status = SettlementStatusPaid
	settlement.PaidBy = operatorId
	settlement.PaidAt = common.GetTimestamp()
	settlement.PaidAmount = settlement.TotalCost
	settlement.PendingAmount = 0
	settlement.UpdateTime = common.GetTimestamp()
	return DB.Model(&SupplierSettlement{}).Where("id = ?", settlement.Id).Updates(settlement).Error
}

// Cancel 取消结算单
func (settlement *SupplierSettlement) Cancel() error {
	settlement.Status = SettlementStatusCancelled
	settlement.UpdateTime = common.GetTimestamp()
	return DB.Model(&SupplierSettlement{}).Where("id = ?", settlement.Id).Updates(settlement).Error
}

// GetSupplierSettlementById 根据ID获取结算单
func GetSupplierSettlementById(id int) (*SupplierSettlement, error) {
	var settlement SupplierSettlement
	err := DB.Where("id = ?", id).First(&settlement).Error
	return &settlement, err
}

// GetAllSupplierSettlements 获取所有结算单（分页）
func GetAllSupplierSettlements(pageInfo *common.PageInfo) ([]*SupplierSettlement, int64, error) {
	var settlements []*SupplierSettlement
	var total int64

	query := DB.Model(&SupplierSettlement{}).Order("create_time desc")

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = query.Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&settlements).Error
	return settlements, total, err
}

// SearchSupplierSettlements 搜索结算单
func SearchSupplierSettlements(vendorId int, period string, status string, pageInfo *common.PageInfo) ([]*SupplierSettlement, int64, error) {
	var settlements []*SupplierSettlement
	var total int64

	query := DB.Model(&SupplierSettlement{})

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

	err = query.Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&settlements).Error
	return settlements, total, err
}

// GetSettlementsByVendor 获取指定供应商的结算单
func GetSettlementsByVendor(vendorId int, pageInfo *common.PageInfo) ([]*SupplierSettlement, int64, error) {
	var settlements []*SupplierSettlement
	var total int64

	query := DB.Model(&SupplierSettlement{}).Where("vendor_id = ?", vendorId).Order("create_time desc")

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = query.Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&settlements).Error
	return settlements, total, err
}

// GetSettlementsByPeriod 获取指定周期的结算单
func GetSettlementsByPeriod(period string) ([]*SupplierSettlement, error) {
	var settlements []*SupplierSettlement
	err := DB.Where("period = ?", period).Find(&settlements).Error
	return settlements, err
}

// ============================================
// SupplierSettlementDetail 供应商结算明细模型
// ============================================

type SupplierSettlementDetail struct {
	Id            int     `json:"id" gorm:"primaryKey"`
	SettlementId  int     `json:"settlement_id" gorm:"index"`
	VendorId      int     `json:"vendor_id"`
	ModelId       int     `json:"model_id"`
	ModelName     string  `json:"model_name" gorm:"type:varchar(200)"`
	TokenRange    string  `json:"token_range" gorm:"type:varchar(100)"`
	PricingMethod string  `json:"pricing_method" gorm:"type:varchar(50)"`
	InputTokens   int64   `json:"input_tokens" gorm:"default:0"`
	OutputTokens  int64   `json:"output_tokens" gorm:"default:0"`
	InputCost     float64 `json:"input_cost" gorm:"type:decimal(12,4)"`
	OutputCost    float64 `json:"output_cost" gorm:"type:decimal(12,4)"`
	CallCount     int     `json:"call_count" gorm:"default:0"`
	CallCost      float64 `json:"call_cost" gorm:"type:decimal(12,4)"`
	ImageCount    int     `json:"image_count" gorm:"default:0"`
	ImageCost     float64 `json:"image_cost" gorm:"type:decimal(12,4)"`
	TotalCost     float64 `json:"total_cost" gorm:"type:decimal(12,4)"`
	CreateTime    int64   `json:"create_time"`
}

func (SupplierSettlementDetail) TableName() string {
	return "supplier_settlement_detail"
}

// Insert 插入结算明细
func (detail *SupplierSettlementDetail) Insert() error {
	detail.CreateTime = common.GetTimestamp()
	return DB.Create(detail).Error
}

// GetSettlementDetails 获取结算单的所有明细
func GetSettlementDetails(settlementId int) ([]*SupplierSettlementDetail, error) {
	var details []*SupplierSettlementDetail
	err := DB.Where("settlement_id = ?", settlementId).Find(&details).Error
	return details, err
}

// BatchInsertDetails 批量插入结算明细
func BatchInsertDetails(details []*SupplierSettlementDetail) error {
	return DB.CreateInBatches(details, 100).Error
}

// DeleteSettlementDetails 删除结算单的所有明细
func DeleteSettlementDetails(settlementId int) error {
	return DB.Where("settlement_id = ?", settlementId).Delete(&SupplierSettlementDetail{}).Error
}
