package service

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// ============================================
// SupplierPricingService 供应商费率服务
// ============================================

type SupplierPricingService struct{}

var supplierPricingServiceInstance *SupplierPricingService

func GetSupplierPricingService() *SupplierPricingService {
	if supplierPricingServiceInstance == nil {
		supplierPricingServiceInstance = &SupplierPricingService{}
	}
	return supplierPricingServiceInstance
}

// CreatePricing 创建费率配置
func (s *SupplierPricingService) CreatePricing(pricing *model.SupplierPricing) error {
	// 验证数据
	if err := s.validatePricing(pricing); err != nil {
		return err
	}

	// 检查是否已存在相同的供应商+模型+TokenRange组合
	existing, err := model.GetPricingByVendorAndModel(pricing.VendorId, pricing.ModelId)
	if err == nil && existing != nil {
		return fmt.Errorf("该供应商和模型的费率配置已存在")
	}

	return pricing.Insert()
}

// UpdatePricing 更新费率配置
func (s *SupplierPricingService) UpdatePricing(pricing *model.SupplierPricing) error {
	// 验证数据
	if err := s.validatePricing(pricing); err != nil {
		return err
	}

	// 检查是否存在
	_, err := model.GetSupplierPricingById(pricing.Id)
	if err != nil {
		return fmt.Errorf("费率配置不存在")
	}

	return pricing.Update()
}

// DeletePricing 删除费率配置
func (s *SupplierPricingService) DeletePricing(id int) error {
	pricing, err := model.GetSupplierPricingById(id)
	if err != nil {
		return fmt.Errorf("费率配置不存在")
	}

	// 如果状态为active，先设置为inactive
	if pricing.Status == model.PricingStatusActive {
		pricing.Status = model.PricingStatusInactive
		pricing.UpdateTime = common.GetTimestamp()
		if updateErr := model.DB.Model(&model.SupplierPricing{}).Where("id = ?", id).Updates(map[string]interface{}{
			"status":      model.PricingStatusInactive,
			"update_time": pricing.UpdateTime,
		}).Error; updateErr != nil {
			return updateErr
		}
	}

	return model.DB.Delete(pricing).Error
}

// GetPricingById 根据ID获取费率配置
func (s *SupplierPricingService) GetPricingById(id int) (*model.SupplierPricing, error) {
	return model.GetSupplierPricingById(id)
}

// GetPricingsByVendor 获取指定供应商的所有费率配置
func (s *SupplierPricingService) GetPricingsByVendor(vendorId int) ([]*model.SupplierPricing, error) {
	return model.GetPricingsByVendor(vendorId)
}

// GetPricingsByModel 获取指定模型的所有费率配置
func (s *SupplierPricingService) GetPricingsByModel(modelId int) ([]*model.SupplierPricing, error) {
	return model.GetPricingsByModel(modelId)
}

// GetAllPricings 获取所有费率配置（分页）
func (s *SupplierPricingService) GetAllPricings(pageInfo *common.PageInfo) ([]*model.SupplierPricing, int64, error) {
	return model.GetAllSupplierPricings(pageInfo)
}

// SearchPricings 搜索费率配置
func (s *SupplierPricingService) SearchPricings(keyword string, vendorId int, modelId int, pageInfo *common.PageInfo) ([]*model.SupplierPricing, int64, error) {
	return model.SearchSupplierPricings(keyword, vendorId, modelId, pageInfo)
}

// ImportPricingsFromCSV 从CSV批量导入费率
func (s *SupplierPricingService) ImportPricingsFromCSV(vendorId int, csvData []byte) (int, int, error) {
	reader := csv.NewReader(strings.NewReader(string(csvData)))

	// 读取所有行
	rows, err := reader.ReadAll()
	if err != nil {
		return 0, 0, fmt.Errorf("解析CSV失败: %v", err)
	}

	if len(rows) < 2 {
		return 0, 0, fmt.Errorf("CSV数据为空")
	}

	// 跳过表头
	dataRows := rows[1:]

	successCount := 0
	failCount := 0
	var errors []string

	// 获取供应商名称
	vendor, err := model.GetVendorByID(vendorId)
	if err != nil {
		return 0, 0, fmt.Errorf("供应商不存在: %v", err)
	}

	for i, row := range dataRows {
		if len(row) < 10 {
			failCount++
			errors = append(errors, fmt.Sprintf("第%d行: 数据列数不足", i+2))
			continue
		}

		pricing := &model.SupplierPricing{
			VendorId:     vendorId,
			VendorName:   vendor.Name,
			Status:       model.PricingStatusActive,
			Currency:     "CNY",
			DiscountRate: 0.35, // 默认折扣
		}

		// 解析CSV列
		// 供应商名称,模型名称,可用区,单次输入token,目录价：输入单价,目录价：输出单价,缓存是否与模型官网保持一致,折扣,大客优惠价：输入单价,大客优惠价：输出单价,计费方式,结算货币,签约合同主体,TPM,RPM,服务时长,备注
		if len(row) > 1 {
			pricing.ModelName = strings.TrimSpace(row[1])
		}
		if len(row) > 2 {
			pricing.Region = strings.TrimSpace(row[2])
		}
		if len(row) > 3 {
			pricing.TokenRange = strings.TrimSpace(row[3])
		}
		if len(row) > 4 {
			pricing.OfficialInputPrice = model.ParsePrice(row[4])
		}
		if len(row) > 5 {
			pricing.OfficialOutputPrice = model.ParsePrice(row[5])
		}
		if len(row) > 7 {
			pricing.DiscountRate = model.ParseDiscountRate(row[7])
		}
		if len(row) > 10 {
			pricing.PricingMethod = strings.TrimSpace(row[10])
		}
		if len(row) > 11 {
			pricing.Currency = strings.TrimSpace(row[11])
		}
		if len(row) > 12 {
			pricing.ContractEntity = strings.TrimSpace(row[12])
		}
		if len(row) > 13 {
			pricing.Tpm = parseIntFromString(strings.TrimSpace(row[13]))
		}
		if len(row) > 14 {
			pricing.Rpm = parseIntFromString(strings.TrimSpace(row[14]))
		}
		if len(row) > 15 {
			pricing.ServiceDuration = strings.TrimSpace(row[15])
		}
		if len(row) > 16 {
			pricing.Notes = strings.TrimSpace(row[16])
		}

		// 根据模型名称查找model_id
		var m model.Model
		if err := model.DB.Where("model_name = ?", pricing.ModelName).First(&m).Error; err == nil {
			pricing.ModelId = m.Id
		}

		// 设置计费方式默认值
		if pricing.PricingMethod == "" {
			pricing.PricingMethod = model.PricingMethodPerToken
		}

		// 计算实际价格
		if pricing.DiscountRate > 0 {
			pricing.ActualInputPrice = model.CalculateActualPrice(pricing.OfficialInputPrice, pricing.DiscountRate)
			pricing.ActualOutputPrice = model.CalculateActualPrice(pricing.OfficialOutputPrice, pricing.DiscountRate)
		}

		// 设置价格字段（根据计费方式）
		if pricing.PricingMethod == model.PricingMethodPerCall && pricing.OfficialInputPrice > 0 {
			pricing.PerCallPrice = pricing.ActualInputPrice
		}
		if pricing.PricingMethod == model.PricingMethodPerImage && pricing.OfficialInputPrice > 0 {
			pricing.PerImagePrice = pricing.ActualInputPrice
		}

		if err := pricing.Insert(); err != nil {
			failCount++
			errors = append(errors, fmt.Sprintf("第%d行 (%s): %v", i+2, pricing.ModelName, err))
		} else {
			successCount++
		}
	}

	return successCount, failCount, nil
}

// CalculateActualPrice 计算实际价格
func (s *SupplierPricingService) CalculateActualPrice(officialPrice, discountRate float64) float64 {
	return model.CalculateActualPrice(officialPrice, discountRate)
}

// validatePricing 验证费率配置
func (s *SupplierPricingService) validatePricing(pricing *model.SupplierPricing) error {
	if pricing.VendorId == 0 {
		return fmt.Errorf("供应商ID不能为空")
	}
	if pricing.ModelId == 0 {
		return fmt.Errorf("模型ID不能为空")
	}
	if pricing.ModelName == "" {
		return fmt.Errorf("模型名称不能为空")
	}
	if pricing.PricingMethod == "" {
		return fmt.Errorf("计费方式不能为空")
	}

	// 验证计费方式
	switch pricing.PricingMethod {
	case model.PricingMethodPerToken, model.PricingMethodPerCall, model.PricingMethodPerSecond, model.PricingMethodPerImage:
		// 有效计费方式
	default:
		return fmt.Errorf("无效的计费方式: %s", pricing.PricingMethod)
	}

	// 验证折扣率
	if pricing.DiscountRate < 0 || pricing.DiscountRate > 1 {
		return fmt.Errorf("折扣率必须在0-1之间")
	}

	return nil
}

// parseIntFromString 从字符串解析整数
func parseIntFromString(s string) int {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0
	}
	// 简单处理，移除可能的千分位逗号
	s = strings.ReplaceAll(s, ",", "")
	var result int
	_, err := fmt.Sscanf(s, "%d", &result)
	if err != nil {
		return 0
	}
	return result
}

// ============================================
// CSV导入DTO
// ============================================

// ImportResult CSV导入结果
type ImportResult struct {
	SuccessCount int      `json:"success_count"`
	FailCount    int      `json:"fail_count"`
	Errors       []string `json:"errors,omitempty"`
}

// PricingFormData 费率表单数据（用于前端）
type PricingFormData struct {
	model.SupplierPricing
	VendorName          string  `json:"vendor_name_str"`
	ModelName           string  `json:"model_name_str"`
	OfficialInputPrice  float64 `json:"official_input_price_str"`
	OfficialOutputPrice float64 `json:"official_output_price_str"`
	DiscountRate        float64 `json:"discount_rate_str"`
	ActualInputPrice    float64 `json:"actual_input_price_str"`
	ActualOutputPrice   float64 `json:"actual_output_price_str"`
}

// ToJSON 转换为JSON字符串
func (r *ImportResult) ToJSON() string {
	data, _ := json.Marshal(r)
	return string(data)
}
