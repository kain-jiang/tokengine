package dto

// ============================================
// 供应商定价相关 DTO
// ============================================

// SupplierPricingCreateRequest 供应商定价创建请求
type SupplierPricingCreateRequest struct {
	VendorId            int     `json:"vendor_id" binding:"required"`
	ModelId             int     `json:"model_id" binding:"required"`
	TokenRange          string  `json:"token_range"`
	PricingMethod       string  `json:"pricing_method" binding:"required"`
	OfficialInputPrice  float64 `json:"official_input_price" binding:"required"`
	OfficialOutputPrice float64 `json:"official_output_price" binding:"required"`
	DiscountRate        float64 `json:"discount_rate"`
	Remark              string  `json:"remark"`
}

// SupplierPricingUpdateRequest 供应商定价更新请求
type SupplierPricingUpdateRequest struct {
	TokenRange          string  `json:"token_range"`
	PricingMethod       string  `json:"pricing_method"`
	OfficialInputPrice  float64 `json:"official_input_price"`
	OfficialOutputPrice float64 `json:"official_output_price"`
	DiscountRate        float64 `json:"discount_rate"`
	ActualInputPrice    float64 `json:"actual_input_price"`
	ActualOutputPrice   float64 `json:"actual_output_price"`
	Remark              string  `json:"remark"`
}

// SupplierPricingSearchRequest 供应商定价搜索请求
type SupplierPricingSearchRequest struct {
	VendorId int    `form:"vendor_id"`
	ModelId  int    `form:"model_id"`
	Keyword  string `form:"keyword"`
}

// SupplierPricingImportRequest 供应商定价导入请求
type SupplierPricingImportRequest struct {
	CsvData []byte `form:"csv_file" binding:"required"`
}

// SupplierPricingBatchUpdateRequest 供应商定价批量更新请求
type SupplierPricingBatchUpdateRequest struct {
	ModelId           int     `json:"model_id" binding:"required"`
	DiscountRate      float64 `json:"discount_rate" binding:"required"`
	ActualInputPrice  float64 `json:"actual_input_price"`
	ActualOutputPrice float64 `json:"actual_output_price"`
}

// ============================================
// 定价统计相关 DTO
// ============================================

// SupplierPricingStatsResponse 供应商定价统计响应
type SupplierPricingStatsResponse struct {
	TotalVendors     int `json:"total_vendors"`     // 供应商数量
	TotalModels      int `json:"total_models"`      // 模型数量
	TotalPricings    int `json:"total_pricings"`    // 定价记录数量
	ActivePricings   int `json:"active_pricings"`   // 有效定价数量
	InactivePricings int `json:"inactive_pricings"` // 无效定价数量
}
