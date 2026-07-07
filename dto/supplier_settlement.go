package dto

// ============================================
// 供应商结算相关 DTO
// ============================================

// SupplierSettlementCreateRequest 供应商结算创建请求
type SupplierSettlementCreateRequest struct {
	VendorId   int    `json:"vendor_id" binding:"required"`
	Period     string `json:"period" binding:"required"`
	PeriodType string `json:"period_type" binding:"required"` // daily, monthly
}

// SupplierSettlementUpdateRequest 供应商结算更新请求
type SupplierSettlementUpdateRequest struct {
	Status       string  `json:"status" binding:"required"` // confirmed, paid, cancelled
	Remark       string  `json:"remark"`
	PaidAt       int64   `json:"paid_at"`
	ActualAmount float64 `json:"actual_amount"`
}

// SupplierSettlementSearchRequest 供应商结算搜索请求
type SupplierSettlementSearchRequest struct {
	VendorId int    `form:"vendor_id"`
	Period   string `form:"period"`
	Status   string `form:"status"`
}

// SupplierSettlementBatchGenerateRequest 批量生成结算请求
type SupplierSettlementBatchGenerateRequest struct {
	Period     string `json:"period" binding:"required"`
	PeriodType string `json:"period_type" binding:"required"` // daily, monthly
}

// ============================================
// 结算统计相关 DTO
// ============================================

// SupplierSettlementStatsResponse 供应商结算统计响应
type SupplierSettlementStatsResponse struct {
	TotalSettlements     int     `json:"total_settlements"`     // 总结算数
	PendingSettlements   int     `json:"pending_settlements"`   // 待确认结算数
	ConfirmedSettlements int     `json:"confirmed_settlements"` // 已确认结算数
	PaidSettlements      int     `json:"paid_settlements"`      // 已支付结算数
	TotalAmount          float64 `json:"total_amount"`          // 总金额
	PendingAmount        float64 `json:"pending_amount"`        // 待确认金额
	ConfirmedAmount      float64 `json:"confirmed_amount"`      // 已确认金额
	PaidAmount           float64 `json:"paid_amount"`           // 已支付金额
}

// ============================================
// 结算明细 DTO
// ============================================

// SupplierSettlementDetailItem 结算明细项
type SupplierSettlementDetailItem struct {
	Id            int     `json:"id"`
	ModelId       int     `json:"model_id"`
	ModelName     string  `json:"model_name"`
	PricingMethod string  `json:"pricing_method"`
	InputTokens   int64   `json:"input_tokens"`
	OutputTokens  int64   `json:"output_tokens"`
	CallCount     int64   `json:"call_count"`
	ImageCount    int64   `json:"image_count"`
	InputPrice    float64 `json:"input_price"`
	OutputPrice   float64 `json:"output_price"`
	Cost          float64 `json:"cost"`
	Remark        string  `json:"remark"`
}
