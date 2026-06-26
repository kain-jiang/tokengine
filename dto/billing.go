package dto

// BillingSummaryRequest 账单汇总请求
type BillingSummaryRequest struct {
	StartDate string `form:"start_date"` // 开始日期 YYYY-MM-DD
	EndDate   string `form:"end_date"`   // 结束日期 YYYY-MM-DD
}

// ModelSummaryItem 模型汇总项
type ModelSummaryItem struct {
	Username      string  `json:"username"`
	ModelName     string  `json:"model_name"`
	RequestCount  int64   `json:"request_count"`
	TotalTokens   int64   `json:"total_tokens"`
	QuotaConsumed float64 `json:"quota_consumed"`
}

// TokenSummaryItem 令牌汇总项
type TokenSummaryItem struct {
	Username      string  `json:"username"`
	TokenName     string  `json:"token_name"`
	RequestCount  int64   `json:"request_count"`
	TotalTokens   int64   `json:"total_tokens"`
	QuotaConsumed float64 `json:"quota_consumed"`
}

// BillingSummaryResponse 账单汇总响应
type BillingSummaryResponse struct {
	Total             int64       `json:"total"`
	TotalRequestCount int64       `json:"total_request_count"`
	Items             interface{} `json:"items"`
}
