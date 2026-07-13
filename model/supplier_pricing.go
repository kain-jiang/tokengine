package model

import (
	"math"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

// ============================================
// 计费方式常量
// ============================================

const (
	PricingMethodPerToken  = "per_token"  // 按token计费
	PricingMethodPerCall   = "per_call"   // 按次计费
	PricingMethodPerSecond = "per_second" // 按秒计费
	PricingMethodPerImage  = "per_image"  // 按张计费
)

// ============================================
// 费率状态常量
// ============================================

const (
	PricingStatusActive   = "active"   // 启用
	PricingStatusInactive = "inactive" // 禁用
)

// ============================================
// Token范围常量
// ============================================

const (
	TokenRange0To32K     = "0<Token≤32K"
	TokenRange32KTo128K  = "32K<Token≤128K"
	TokenRange128KTo252K = "128K<Token≤252K"
	TokenRangeAll        = "全量"
	TokenRangeNA         = "N/A"
)

// ============================================
// SupplierPricing 供应商费率配置模型
// ============================================

type SupplierPricing struct {
	Id                  int     `json:"id" gorm:"primaryKey"`
	VendorId            int     `json:"vendor_id" gorm:"index"`
	VendorName          string  `json:"vendor_name" gorm:"type:varchar(200)"`
	ModelId             int     `json:"model_id" gorm:"index"`
	ModelName           string  `json:"model_name" gorm:"type:varchar(200)"`
	TokenRange          string  `json:"token_range" gorm:"type:varchar(100)"`
	PricingMethod       string  `json:"pricing_method" gorm:"type:varchar(50)"`
	OfficialInputPrice  float64 `json:"official_input_price" gorm:"type:decimal(10,6)"`
	OfficialOutputPrice float64 `json:"official_output_price" gorm:"type:decimal(10,6)"`
	DiscountRate        float64 `json:"discount_rate" gorm:"type:decimal(5,4)"`
	ActualInputPrice    float64 `json:"actual_input_price" gorm:"type:decimal(10,6)"`
	ActualOutputPrice   float64 `json:"actual_output_price" gorm:"type:decimal(10,6)"`
	PerCallPrice        float64 `json:"per_call_price" gorm:"type:decimal(10,6)"`
	PerSecondPrice      float64 `json:"per_second_price" gorm:"type:decimal(10,6)"`
	PerImagePrice       float64 `json:"per_image_price" gorm:"type:decimal(10,6)"`
	CachePrice          float64 `json:"cache_price" gorm:"type:decimal(10,6)"`
	CacheRate           float64 `json:"cache_rate" gorm:"type:decimal(5,4)"`
	Tpm                 int     `json:"tpm" gorm:"default:0"`
	Rpm                 int     `json:"rpm" gorm:"default:0"`
	Region              string  `json:"region" gorm:"type:varchar(100)"`
	Currency            string  `json:"currency" gorm:"type:varchar(20);default:CNY"`
	ContractEntity      string  `json:"contract_entity" gorm:"type:varchar(200)"`
	ServiceDuration     string  `json:"service_duration" gorm:"type:varchar(50)"`
	Notes               string  `json:"notes" gorm:"type:text"`
	Status              string  `json:"status" gorm:"type:varchar(20);default:active"`
	ValidFrom           int64   `json:"valid_from" gorm:"index"`
	ValidTo             int64   `json:"valid_to"`
	CreateTime          int64   `json:"create_time" gorm:"index"`
	UpdateTime          int64   `json:"update_time"`
}

func (SupplierPricing) TableName() string {
	return "supplier_pricing"
}

// CalculateActualPrice 计算实际价格（官方价格 × 折扣）
func CalculateActualPrice(officialPrice, discountRate float64) float64 {
	return math.Round(officialPrice*discountRate*10000) / 10000
}

// CalculateCost 根据计费方式计算费用
func CalculateCost(pricing *SupplierPricing, inputTokens, outputTokens, callCount, imageCount int64) float64 {
	var totalCost float64

	switch pricing.PricingMethod {
	case PricingMethodPerToken:
		// 费用 = 输入量 × 输入单价 + 输出量 × 输出单价
		inputCost := float64(inputTokens) / 1000000 * pricing.ActualInputPrice
		outputCost := float64(outputTokens) / 1000000 * pricing.ActualOutputPrice
		totalCost = inputCost + outputCost
	case PricingMethodPerCall:
		// 费用 = 调用次数 × 单次价格
		totalCost = float64(callCount) * pricing.PerCallPrice
	case PricingMethodPerSecond:
		// 费用 = 使用秒数 × 每秒单价（seconds 需要从外部传入）
		// 这里返回 0，实际计算需要在服务层处理
		totalCost = 0
	case PricingMethodPerImage:
		// 费用 = 生成张数 × 单张价格
		totalCost = float64(imageCount) * pricing.PerImagePrice
	}

	return math.Round(totalCost*100) / 100
}

// Insert 插入费率配置
func (pricing *SupplierPricing) Insert() error {
	pricing.CreateTime = common.GetTimestamp()
	pricing.UpdateTime = pricing.CreateTime
	// 计算实际价格
	if pricing.DiscountRate > 0 {
		pricing.ActualInputPrice = CalculateActualPrice(pricing.OfficialInputPrice, pricing.DiscountRate)
		pricing.ActualOutputPrice = CalculateActualPrice(pricing.OfficialOutputPrice, pricing.DiscountRate)
	}
	return DB.Create(pricing).Error
}

// Update 更新费率配置
func (pricing *SupplierPricing) Update() error {
	pricing.UpdateTime = common.GetTimestamp()
	// 重新计算实际价格
	if pricing.DiscountRate > 0 {
		pricing.ActualInputPrice = CalculateActualPrice(pricing.OfficialInputPrice, pricing.DiscountRate)
		pricing.ActualOutputPrice = CalculateActualPrice(pricing.OfficialOutputPrice, pricing.DiscountRate)
	}
	return DB.Model(&SupplierPricing{}).Where("id = ?", pricing.Id).Updates(pricing).Error
}

// Delete 删除费率配置（软删除）
func (pricing *SupplierPricing) Delete() error {
	return DB.Delete(pricing).Error
}

// GetSupplierPricingById 根据ID获取费率配置
func GetSupplierPricingById(id int) (*SupplierPricing, error) {
	var pricing SupplierPricing
	err := DB.Where("id = ?", id).First(&pricing).Error
	return &pricing, err
}

// GetAllSupplierPricings 获取所有费率配置（分页）
func GetAllSupplierPricings(pageInfo *common.PageInfo) ([]*SupplierPricing, int64, error) {
	var pricings []*SupplierPricing
	var total int64

	query := DB.Model(&SupplierPricing{}).Order("create_time desc")

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = query.Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&pricings).Error
	return pricings, total, err
}

// SearchSupplierPricings 搜索费率配置
func SearchSupplierPricings(keyword string, vendorId int, modelId int, pageInfo *common.PageInfo) ([]*SupplierPricing, int64, error) {
	var pricings []*SupplierPricing
	var total int64

	query := DB.Model(&SupplierPricing{})

	if keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("vendor_name LIKE ? OR model_name LIKE ? OR notes LIKE ?", like, like, like)
	}
	if vendorId > 0 {
		query = query.Where("vendor_id = ?", vendorId)
	}
	if modelId > 0 {
		query = query.Where("model_id = ?", modelId)
	}

	query = query.Order("create_time desc")

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = query.Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&pricings).Error
	return pricings, total, err
}

// GetPricingsByVendor 获取指定供应商的所有费率配置
func GetPricingsByVendor(vendorId int) ([]*SupplierPricing, error) {
	var pricings []*SupplierPricing
	err := DB.Where("vendor_id = ? AND status = ?", vendorId, PricingStatusActive).Find(&pricings).Error
	return pricings, err
}

// GetPricingsByModel 获取指定模型的所有费率配置
func GetPricingsByModel(modelId int) ([]*SupplierPricing, error) {
	var pricings []*SupplierPricing
	err := DB.Where("model_id = ? AND status = ?", modelId, PricingStatusActive).Find(&pricings).Error
	return pricings, err
}

// GetPricingByVendorAndModel 获取指定供应商和模型的费率配置
func GetPricingByVendorAndModel(vendorId int, modelId int) (*SupplierPricing, error) {
	var pricing SupplierPricing
	err := DB.Where("vendor_id = ? AND model_id = ? AND status = ?", vendorId, modelId, PricingStatusActive).First(&pricing).Error
	return &pricing, err
}

// ============================================
// CSV导入相关结构
// ============================================

// SupplierPricingCSVRow CSV导入的行数据结构
type SupplierPricingCSVRow struct {
	VendorName          string `csv:"供应商名称"`
	ModelName           string `csv:"模型名称"`
	Region              string `csv:"可用区"`
	TokenRange          string `csv:"Token范围"`
	OfficialInputPrice  string `csv:"目录价：输入单价"`
	OfficialOutputPrice string `csv:"目录价：输出单价"`
	CacheSync           string `csv:"缓存是否与模型官网保持一致"`
	Discount            string `csv:"折扣"`
	CustomerInputPrice  string `csv:"大客优惠价：输入单价"`
	CustomerOutputPrice string `csv:"大客优惠价：输出单价"`
	PricingMethod       string `csv:"计费方式"`
	Currency            string `csv:"结算货币"`
	ContractEntity      string `csv:"签约合同主体"`
	Tpm                 string `csv:"TPM"`
	Rpm                 string `csv:"RPM"`
	ServiceDuration     string `csv:"服务时长"`
	Notes               string `csv:"备注"`
}

// ParseDiscountRate 解析折扣率字符串（如"35%"转换为0.35）
func ParseDiscountRate(discountStr string) float64 {
	discountStr = strings.TrimSpace(discountStr)
	if strings.HasSuffix(discountStr, "%") {
		discountStr = strings.TrimSuffix(discountStr, "%")
		rate, err := strconv.ParseFloat(discountStr, 64)
		if err == nil {
			return rate / 100
		}
	}
	// 尝试直接解析为小数
	rate, err := strconv.ParseFloat(discountStr, 64)
	if err == nil {
		return rate
	}
	return 0.35 // 默认折扣
}

// ParsePrice 解析价格字符串
func ParsePrice(priceStr string) float64 {
	priceStr = strings.TrimSpace(priceStr)
	if priceStr == "" || priceStr == "-" || priceStr == "N/A" {
		return 0
	}
	// 移除货币符号和千分位逗号
	priceStr = strings.ReplaceAll(priceStr, "¥", "")
	priceStr = strings.ReplaceAll(priceStr, "$", "")
	priceStr = strings.ReplaceAll(priceStr, ",", "")
	price, err := strconv.ParseFloat(priceStr, 64)
	if err != nil {
		return 0
	}
	return price
}
