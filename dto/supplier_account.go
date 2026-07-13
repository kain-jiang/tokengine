package dto

// ============================================
// 供应商账户相关 DTO
// ============================================

// SupplierAccountCreateRequest 供应商账户创建请求
type SupplierAccountCreateRequest struct {
	VendorId   int     `json:"vendor_id" binding:"required"`
	VendorName string  `json:"vendor_name"`
	Balance    float64 `json:"balance"`
	Remark     string  `json:"remark"`
}

// SupplierAccountUpdateRequest 供应商账户更新请求
type SupplierAccountUpdateRequest struct {
	VendorName string `json:"vendor_name"`
	Remark     string `json:"remark"`
}

// SupplierAccountRechargeRequest 供应商账户充值请求
type SupplierAccountRechargeRequest struct {
	Amount        float64 `json:"amount" binding:"required,gt=0"`
	PaymentMethod string  `json:"payment_method"` // bank_transfer, alipay, wechat
	Remark        string  `json:"remark"`
}

// SupplierAccountSearchRequest 供应商账户搜索请求
type SupplierAccountSearchRequest struct {
	VendorId   int    `form:"vendor_id"`
	VendorName string `form:"vendor_name"`
	Keyword    string `form:"keyword"`
}

// ============================================
// 账户统计相关 DTO
// ============================================

// SupplierAccountStatsResponse 供应商账户统计响应
type SupplierAccountStatsResponse struct {
	TotalAccounts    int     `json:"total_accounts"`    // 总账户数
	PositiveBalance  int     `json:"positive_balance"`  // 余额大于0的账户数
	NegativeBalance  int     `json:"negative_balance"`  // 余额小于0的账户数
	TotalBalance     float64 `json:"total_balance"`     // 总余额
	TotalRecharge    float64 `json:"total_recharge"`    // 总充值金额
	TotalDeduction   float64 `json:"total_deduction"`   // 总扣款金额
	ActiveAccounts   int     `json:"active_accounts"`   // 活跃账户数（有结算记录）
	InactiveAccounts int     `json:"inactive_accounts"` // 非活跃账户数
}

// ============================================
// 供应商充值记录 DTO
// ============================================

// SupplierRechargeItem 供应商充值项
type SupplierRechargeItem struct {
	Id            int     `json:"id"`
	VendorId      int     `json:"vendor_id"`
	VendorName    string  `json:"vendor_name"`
	Amount        float64 `json:"amount"`         // 充值金额
	BalanceBefore float64 `json:"balance_before"` // 充值前余额
	BalanceAfter  float64 `json:"balance_after"`  // 充值后余额
	Status        string  `json:"status"`         // pending, completed, failed
	PaymentMethod string  `json:"payment_method"`
	Remark        string  `json:"remark"`
	OperatorId    int     `json:"operator_id"`
	OperatorName  string  `json:"operator_name"`
	CreateTime    int64   `json:"create_time"`
}

// SupplierRechargeSearchRequest 供应商充值记录搜索请求
type SupplierRechargeSearchRequest struct {
	VendorId int    `form:"vendor_id"`
	Status   string `form:"status"`
	Keyword  string `form:"keyword"`
}

// SupplierRechargeStatsResponse 供应商充值统计响应
type SupplierRechargeStatsResponse struct {
	TotalRecharge     float64 `json:"total_recharge"`     // 总充值金额
	CompletedRecharge float64 `json:"completed_recharge"` // 已完成充值金额
	PendingRecharge   float64 `json:"pending_recharge"`   // 待处理充值金额
	FailedRecharge    float64 `json:"failed_recharge"`    // 失败充值金额
	RechargeCount     int     `json:"recharge_count"`     // 充值次数
	CompletedCount    int     `json:"completed_count"`    // 已完成次数
	PendingCount      int     `json:"pending_count"`      // 待处理次数
	FailedCount       int     `json:"failed_count"`       // 失败次数
}
