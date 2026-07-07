package model

import (
	"github.com/QuantumNous/new-api/common"
)

// ============================================
// 配置状态常量
// ============================================

const (
	RebateConfigStatusActive   = "active"   // 启用
	RebateConfigStatusInactive = "inactive" // 禁用
)

// ============================================
// SupplierRebateConfig 供应商返点接口配置模型
// ============================================

type SupplierRebateConfig struct {
	Id          int    `json:"id" gorm:"primaryKey"`
	VendorId    int    `json:"vendor_id" gorm:"uniqueIndex:uk_vendor_rebate_config"`
	VendorName  string `json:"vendor_name" gorm:"type:varchar(200)"`
	ApiUrl      string `json:"api_url" gorm:"type:varchar(500)"`
	ApiKey      string `json:"api_key" gorm:"type:varchar(200)"`
	ApiSecret   string `json:"api_secret" gorm:"type:varchar(200)"`
	SyncEnabled int    `json:"sync_enabled" gorm:"default:0"` // 0=禁用, 1=启用
	SyncCron    string `json:"sync_cron" gorm:"type:varchar(50)"`
	Status      string `json:"status" gorm:"type:varchar(20);default:active;index"`
	CreateTime  int64  `json:"create_time" gorm:"index"`
	UpdateTime  int64  `json:"update_time"`
}

func (SupplierRebateConfig) TableName() string {
	return "supplier_rebate_config"
}

// Insert 插入配置
func (config *SupplierRebateConfig) Insert() error {
	config.CreateTime = common.GetTimestamp()
	config.UpdateTime = config.CreateTime
	if config.Status == "" {
		config.Status = RebateConfigStatusActive
	}
	return DB.Create(config).Error
}

// Update 更新配置
func (config *SupplierRebateConfig) Update() error {
	config.UpdateTime = common.GetTimestamp()
	return DB.Model(&SupplierRebateConfig{}).Where("id = ?", config.Id).Updates(config).Error
}

// Delete 删除配置
func (config *SupplierRebateConfig) Delete() error {
	return DB.Delete(config).Error
}

// GetRebateConfigByVendorId 根据供应商ID获取配置
func GetRebateConfigByVendorId(vendorId int) (*SupplierRebateConfig, error) {
	var config SupplierRebateConfig
	err := DB.Where("vendor_id = ?", vendorId).First(&config).Error
	return &config, err
}

// GetRebateConfigById 根据ID获取配置
func GetRebateConfigById(id int) (*SupplierRebateConfig, error) {
	var config SupplierRebateConfig
	err := DB.Where("id = ?", id).First(&config).Error
	return &config, err
}

// GetAllRebateConfigs 获取所有配置（分页）
func GetAllRebateConfigs(pageInfo *common.PageInfo) ([]*SupplierRebateConfig, int64, error) {
	var configs []*SupplierRebateConfig
	var total int64

	query := DB.Model(&SupplierRebateConfig{}).Order("create_time desc")

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = query.Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&configs).Error
	return configs, total, err
}

// SearchRebateConfigs 搜索配置
func SearchRebateConfigs(vendorId int, status string, pageInfo *common.PageInfo) ([]*SupplierRebateConfig, int64, error) {
	var configs []*SupplierRebateConfig
	var total int64

	query := DB.Model(&SupplierRebateConfig{})

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

	err = query.Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&configs).Error
	return configs, total, err
}

// GetOrCreateRebateConfig 获取或创建配置
func GetOrCreateRebateConfig(vendorId int, vendorName string) (*SupplierRebateConfig, error) {
	var config SupplierRebateConfig
	err := DB.Where("vendor_id = ?", vendorId).First(&config).Error
	if err != nil {
		if err.Error() == "record not found" {
			// 创建新配置
			config = SupplierRebateConfig{
				VendorId:    vendorId,
				VendorName:  vendorName,
				Status:      RebateConfigStatusActive,
				SyncEnabled: 0,
			}
			return &config, config.Insert()
		}
		return nil, err
	}
	return &config, nil
}

// GetEnabledConfigs 获取所有启用的配置
func GetEnabledConfigs() ([]*SupplierRebateConfig, error) {
	var configs []*SupplierRebateConfig
	err := DB.Where("status = ? AND sync_enabled = ?", RebateConfigStatusActive, 1).Find(&configs).Error
	return configs, err
}
