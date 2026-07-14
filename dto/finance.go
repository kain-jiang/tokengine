package dto

// ============================================
// 财务概览相关 DTO
// ============================================

// FinanceDashboardRequest 财务概览请求
type FinanceDashboardRequest struct {
	StartDate string `form:"start_date"` // 开始日期 YYYY-MM-DD
	EndDate   string `form:"end_date"`   // 结束日期 YYYY-MM-DD
}

// FinanceDashboardResponse 财务概览响应
type FinanceDashboardResponse struct {
	TotalRevenue      float64 `json:"total_revenue"`      // 总营收
	TotalTopup        float64 `json:"total_topup"`        // 总充值
	TotalSubscription float64 `json:"total_subscription"` // 订阅收入
	TotalConsumption  float64 `json:"total_consumption"`  // 总消费
	NetRevenue        float64 `json:"net_revenue"`        // 净营收
	OrderCount        int     `json:"order_count"`        // 订单数
	UserCount         int     `json:"user_count"`         // 用户数
	RequestCount      int     `json:"request_count"`      // 请求数
	TodayRevenue      float64 `json:"today_revenue"`      // 今日营收
	MonthRevenue      float64 `json:"month_revenue"`      // 本月营收
	InvoicePending    int     `json:"invoice_pending"`    // 待审核发票数
	InvoiceTotal      float64 `json:"invoice_total"`      // 待开票总金额
}

// ============================================
// 订单相关 DTO
// ============================================

// OrderItem 订单项
type OrderItem struct {
	Id            int     `json:"id"`
	OrderId       string  `json:"order_id"` // 订单号
	UserId        int     `json:"user_id"`
	Username      string  `json:"username"`
	OrderType     string  `json:"order_type"`     // topup, subscription
	PaymentMethod string  `json:"payment_method"` // alipay, wxpay, stripe, etc.
	Amount        float64 `json:"amount"`         // 支付金额
	Quota         int     `json:"quota"`          // 获得额度
	Status        string  `json:"status"`         // pending, success, failed, cancelled
	CreateTime    int64   `json:"create_time"`    // 创建时间
	CompleteTime  int64   `json:"complete_time"`  // 完成时间
	TradeNo       string  `json:"trade_no"`       // 交易号
	Source        string  `json:"source"`         // 来源: web, api
}

// OrderListRequest 订单列表请求
type OrderListRequest struct {
	StartDate     string `form:"start_date"`
	EndDate       string `form:"end_date"`
	Status        string `form:"status"`
	OrderType     string `form:"order_type"`
	PaymentMethod string `form:"payment_method"`
	Keyword       string `form:"keyword"`
}

// OrderListResponse 订单列表响应
type OrderListResponse struct {
	Total int64        `json:"total"`
	Items []*OrderItem `json:"items"`
}

// ============================================
// 营收报表相关 DTO
// ============================================

// RevenueReportItem 营收报表项
type RevenueReportItem struct {
	Period            string  `json:"period"`
	ReportType        string  `json:"report_type"`
	TotalRevenue      float64 `json:"total_revenue"`
	TotalTopup        float64 `json:"total_topup"`
	TotalSubscription float64 `json:"total_subscription"`
	TotalConsumption  float64 `json:"total_consumption"`
	NetRevenue        float64 `json:"net_revenue"`
	OrderCount        int     `json:"order_count"`
	UserCount         int     `json:"user_count"`
	RequestCount      int     `json:"request_count"`
}

// RevenueReportRequest 营收报表请求
type RevenueReportRequest struct {
	ReportType string `form:"report_type"` // daily, monthly, yearly
	StartDate  string `form:"start_date"`
	EndDate    string `form:"end_date"`
}

// RevenueTrendItem 营收趋势项
type RevenueTrendItem struct {
	Date        string  `json:"date"`
	Revenue     float64 `json:"revenue"`
	Topup       float64 `json:"topup"`
	Consumption float64 `json:"consumption"`
}

// ============================================
// 发票相关 DTO
// ============================================

// InvoiceApplyRequest 发票申请请求
type InvoiceApplyRequest struct {
	Type         string   `json:"type" binding:"required"` // electronic, paper
	Title        string   `json:"title" binding:"required"`
	TaxNumber    string   `json:"tax_number"`
	ContactName  string   `json:"contact_name" binding:"required"`
	ContactPhone string   `json:"contact_phone" binding:"required"`
	Address      string   `json:"address"`
	BankName     string   `json:"bank_name"`
	BankAccount  string   `json:"bank_account"`
	Amount       float64  `json:"amount" binding:"required"`
	OrderIds     []string `json:"order_ids"` // 关联订单ID
	Remark       string   `json:"remark"`
}

// InvoiceItem 发票项
type InvoiceItem struct {
	Id            int     `json:"id"`
	InvoiceNo     string  `json:"invoice_no"`
	UserId        int     `json:"user_id"`
	Username      string  `json:"username"`
	Type          string  `json:"type"`
	Title         string  `json:"title"`
	TaxNumber     string  `json:"tax_number"`
	ContactName   string  `json:"contact_name"`
	ContactPhone  string  `json:"contact_phone"`
	Amount        float64 `json:"amount"`
	Quota         int     `json:"quota"`
	Status        string  `json:"status"`
	Remark        string  `json:"remark"`
	InvoiceFile   string  `json:"invoice_file"`
	ApprovedByStr string  `json:"approved_by_str"`
	ApprovedAt    int64   `json:"approved_at"`
	IssuedAt      int64   `json:"issued_at"`
	CreateTime    int64   `json:"create_time"`
	UpdateTime    int64   `json:"update_time"`
}

// InvoiceListRequest 发票列表请求
type InvoiceListRequest struct {
	Status    string `form:"status"`
	StartDate string `form:"start_date"`
	EndDate   string `form:"end_date"`
	Keyword   string `form:"keyword"`
}

// InvoiceUpdateRequest 发票更新请求（管理员审批）
type InvoiceUpdateRequest struct {
	Status     string `json:"status" binding:"required"` // approved, rejected, issued
	Remark     string `json:"remark"`
	InvoiceUrl string `json:"invoice_url"`
}

// ============================================
// 对账相关 DTO
// ============================================

// ReconciliationItem 对账项
type ReconciliationItem struct {
	Id               int     `json:"id"`
	Type             string  `json:"type"`
	Period           string  `json:"period"`
	ChannelId        int     `json:"channel_id"`
	ChannelName      string  `json:"channel_name"`
	TotalAmount      float64 `json:"total_amount"`
	TotalQuota       int     `json:"total_quota"`
	TransactionCount int     `json:"transaction_count"`
	ReconciledAmount float64 `json:"reconciled_amount"`
	Discrepancy      float64 `json:"discrepancy"`
	Status           string  `json:"status"`
	Remark           string  `json:"remark"`
	CreateTime       int64   `json:"create_time"`
	UpdateTime       int64   `json:"update_time"`
}

// ReconciliationListRequest 对账列表请求
type ReconciliationListRequest struct {
	Type   string `form:"type"`
	Period string `form:"period"`
	Status string `form:"status"`
}

// AutoReconciliationRequest 自动对账请求
type AutoReconciliationRequest struct {
	Type      string `json:"type" binding:"required"` // downstream, upstream
	Period    string `json:"period" binding:"required"`
	ChannelId int    `json:"channel_id"` // 上游对账时指定渠道
}
