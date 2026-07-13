package model

import (
	"github.com/QuantumNous/new-api/common"
)

// ============================================
// 充值状态常量
// ============================================

const (
	RechargeStatusPending = "pending" // 待处理
	RechargeStatusSuccess = "success" // 成功
	RechargeStatusFailed  = "failed"  // 失败
)

// ============================================
// 支付方式常量
// ============================================

const (
	PaymentMethodBankTransfer = "bank_transfer" // 银行转账
	PaymentMethodAlipay       = "alipay"        // 支付宝
	PaymentMethodWechat       = "wechat"        // 微信
	PaymentMethodStripe       = "stripe"        // Stripe
	PaymentMethodOther        = "other"         // 其他
)

// ============================================
// SupplierRecharge 供应商充值记录模型
// ============================================

type SupplierRecharge struct {
	Id           int     `json:"id" gorm:"primaryKey"`
	VendorId     int     `json:"vendor_id" gorm:"index"`
	VendorName   string  `json:"vendor_name" gorm:"type:varchar(200)"`
	Amount       float64 `json:"amount" gorm:"type:decimal(12,2)"`
	Method       string  `json:"method" gorm:"type:varchar(50)"`
	Status       string  `json:"status" gorm:"type:varchar(20);default:pending"`
	Remark       string  `json:"remark" gorm:"type:varchar(500)"`
	OperatorId   int     `json:"operator_id"`
	OperatorName string  `json:"operator_name" gorm:"-"` // 不存储，用于前端展示
	CreateTime   int64   `json:"create_time" gorm:"index"`
	CompleteTime int64   `json:"complete_time"`
}

func (SupplierRecharge) TableName() string {
	return "supplier_recharge"
}

// Insert 插入充值记录
func (recharge *SupplierRecharge) Insert() error {
	recharge.CreateTime = common.GetTimestamp()
	if recharge.Status == "" {
		recharge.Status = RechargeStatusPending
	}
	return DB.Create(recharge).Error
}

// Update 更新充值记录
func (recharge *SupplierRecharge) Update() error {
	recharge.CompleteTime = common.GetTimestamp()
	return DB.Model(&SupplierRecharge{}).Where("id = ?", recharge.Id).Updates(recharge).Error
}

// Complete 完成充值（标记为成功）
func (recharge *SupplierRecharge) Complete() error {
	recharge.Status = RechargeStatusSuccess
	recharge.CompleteTime = common.GetTimestamp()
	return DB.Model(&SupplierRecharge{}).Where("id = ?", recharge.Id).Updates(recharge).Error
}

// Fail 充值失败
func (recharge *SupplierRecharge) Fail() error {
	recharge.Status = RechargeStatusFailed
	recharge.CompleteTime = common.GetTimestamp()
	return DB.Model(&SupplierRecharge{}).Where("id = ?", recharge.Id).Updates(recharge).Error
}

// GetSupplierRechargeById 根据ID获取充值记录
func GetSupplierRechargeById(id int) (*SupplierRecharge, error) {
	var recharge SupplierRecharge
	err := DB.Where("id = ?", id).First(&recharge).Error
	return &recharge, err
}

// GetAllSupplierRecharges 获取所有充值记录（分页）
func GetAllSupplierRecharges(pageInfo *common.PageInfo) ([]*SupplierRecharge, int64, error) {
	var recharges []*SupplierRecharge
	var total int64

	query := DB.Model(&SupplierRecharge{}).Order("create_time desc")

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = query.Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&recharges).Error
	return recharges, total, err
}

// SearchSupplierRecharges 搜索充值记录
func SearchSupplierRecharges(vendorId int, status string, pageInfo *common.PageInfo) ([]*SupplierRecharge, int64, error) {
	var recharges []*SupplierRecharge
	var total int64

	query := DB.Model(&SupplierRecharge{})

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

	err = query.Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&recharges).Error
	return recharges, total, err
}

// GetRechargesByVendor 获取指定供应商的充值记录
func GetRechargesByVendor(vendorId int, pageInfo *common.PageInfo) ([]*SupplierRecharge, int64, error) {
	var recharges []*SupplierRecharge
	var total int64

	query := DB.Model(&SupplierRecharge{}).Where("vendor_id = ?", vendorId).Order("create_time desc")

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = query.Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&recharges).Error
	return recharges, total, err
}

// GetTotalRechargeAmount 获取指定时间段内的充值总额
func GetTotalRechargeAmount(vendorId int, startTime, endTime int64) float64 {
	var result struct {
		Total float64 `gorm:"column:total"`
	}
	query := DB.Model(&SupplierRecharge{}).
		Where("vendor_id = ? AND status = ?", vendorId, RechargeStatusSuccess).
		Select("SUM(amount) as total")

	if startTime > 0 {
		query = query.Where("create_time >= ?", startTime)
	}
	if endTime > 0 {
		query = query.Where("create_time <= ?", endTime)
	}

	query.Scan(&result)
	return result.Total
}

// SearchSupplierRechargesForExport 导出充值记录（无分页）
func SearchSupplierRechargesForExport(vendorId int, status string) ([]*SupplierRecharge, error) {
	var recharges []*SupplierRecharge
	query := DB.Model(&SupplierRecharge{})

	if vendorId > 0 {
		query = query.Where("vendor_id = ?", vendorId)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}

	err := query.Order("create_time desc").Find(&recharges).Error
	return recharges, err
}
