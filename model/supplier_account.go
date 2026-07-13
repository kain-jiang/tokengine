package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
)

// ============================================
// 账户状态常量
// ============================================

const (
	AccountStatusActive = "active" // 正常
	AccountStatusFrozen = "frozen" // 冻结
	AccountStatusClosed = "closed" // 已关闭
)

// ============================================
// SupplierAccount 供应商账户模型
// ============================================

type SupplierAccount struct {
	Id               int     `json:"id" gorm:"primaryKey"`
	VendorId         int     `json:"vendor_id" gorm:"uniqueIndex:uk_vendor_account"`
	VendorName       string  `json:"vendor_name" gorm:"type:varchar(200)"`
	TotalRecharge    float64 `json:"total_recharge" gorm:"type:decimal(12,2);default:0"`
	TotalConsumption float64 `json:"total_consumption" gorm:"type:decimal(12,2);default:0"`
	Balance          float64 `json:"balance" gorm:"type:decimal(12,2);default:0"`
	Currency         string  `json:"currency" gorm:"type:varchar(20);default:CNY"`
	Status           string  `json:"status" gorm:"type:varchar(20);default:active"`
	CreateTime       int64   `json:"create_time" gorm:"index"`
	UpdateTime       int64   `json:"update_time"`
}

func (SupplierAccount) TableName() string {
	return "supplier_account"
}

// Insert 插入账户
func (account *SupplierAccount) Insert() error {
	account.CreateTime = common.GetTimestamp()
	account.UpdateTime = account.CreateTime
	if account.Currency == "" {
		account.Currency = "CNY"
	}
	if account.Status == "" {
		account.Status = AccountStatusActive
	}
	return DB.Create(account).Error
}

// Update 更新账户
func (account *SupplierAccount) Update() error {
	account.UpdateTime = common.GetTimestamp()
	return DB.Model(&SupplierAccount{}).Where("id = ?", account.Id).Updates(account).Error
}

// GetSupplierAccountByVendorId 根据供应商ID获取账户
func GetSupplierAccountByVendorId(vendorId int) (*SupplierAccount, error) {
	var account SupplierAccount
	err := DB.Where("vendor_id = ?", vendorId).First(&account).Error
	return &account, err
}

// GetOrCreateSupplierAccount 获取或创建供应商账户
func GetOrCreateSupplierAccount(vendorId int, vendorName string) (*SupplierAccount, error) {
	var account SupplierAccount
	err := DB.Where("vendor_id = ?", vendorId).First(&account).Error
	if err != nil {
		if err.Error() == "record not found" {
			// 创建新账户
			account = SupplierAccount{
				VendorId:         vendorId,
				VendorName:       vendorName,
				Currency:         "CNY",
				Status:           AccountStatusActive,
				TotalRecharge:    0,
				TotalConsumption: 0,
				Balance:          0,
			}
			return &account, account.Insert()
		}
		return nil, err
	}
	return &account, nil
}

// GetAllSupplierAccounts 获取所有账户（分页）
func GetAllSupplierAccounts(pageInfo *common.PageInfo) ([]*SupplierAccount, int64, error) {
	var accounts []*SupplierAccount
	var total int64

	query := DB.Model(&SupplierAccount{}).Order("create_time desc")

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = query.Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&accounts).Error
	return accounts, total, err
}

// SearchSupplierAccounts 搜索账户
func SearchSupplierAccounts(keyword string, status string, pageInfo *common.PageInfo) ([]*SupplierAccount, int64, error) {
	var accounts []*SupplierAccount
	var total int64

	query := DB.Model(&SupplierAccount{})

	if keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("vendor_name LIKE ?", like)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}

	query = query.Order("create_time desc")

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = query.Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&accounts).Error
	return accounts, total, err
}

// ============================================
// 账户操作
// ============================================

// Recharge 充值（增加账户余额）
func (account *SupplierAccount) Recharge(amount float64) error {
	account.TotalRecharge += amount
	account.Balance += amount
	account.UpdateTime = common.GetTimestamp()
	return DB.Model(&SupplierAccount{}).Where("id = ?", account.Id).Updates(account).Error
}

// Deduct 扣费（减少账户余额）
func (account *SupplierAccount) Deduct(amount float64) error {
	if account.Balance < amount {
		return errors.New("账户余额不足")
	}
	account.TotalConsumption += amount
	account.Balance -= amount
	account.UpdateTime = common.GetTimestamp()
	return DB.Model(&SupplierAccount{}).Where("id = ?", account.Id).Updates(account).Error
}

// UpdateBalance 更新余额（根据充值和消耗重新计算）
func (account *SupplierAccount) UpdateBalance() error {
	account.Balance = account.TotalRecharge - account.TotalConsumption
	account.UpdateTime = common.GetTimestamp()
	return DB.Model(&SupplierAccount{}).Where("id = ?", account.Id).Updates(account).Error
}

// GetLowBalanceAccounts 获取余额低于阈值的账户
func GetLowBalanceAccounts(threshold float64) ([]*SupplierAccount, error) {
	var accounts []*SupplierAccount
	err := DB.Where("balance < ? AND status = ?", threshold, AccountStatusActive).Find(&accounts).Error
	return accounts, err
}
