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

// OrderStatistics 订单统计数据（用于 Orders 页面概览）
type OrderStatistics struct {
	TotalAmount  float64 `json:"total_amount"`  // 总充值金额（截止目前成功订单）
	SuccessCount int64   `json:"success_count"` // 成功订单数
	PendingCount int64   `json:"pending_count"` // 待处理订单数
	FailedCount  int64   `json:"failed_count"`  // 失败订单数
	TotalRefund  float64 `json:"total_refund"`  // 退款总金额
	RefundCount  int64   `json:"refund_count"`  // 退款订单数
	TodayAmount  float64 `json:"today_amount"`  // 今日充值金额
	TodayCount   int64   `json:"today_count"`   // 今日充值订单数
	MonthAmount  float64 `json:"month_amount"`  // 本月充值金额
	MonthCount   int64   `json:"month_count"`   // 本月充值订单数
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

// ============================================
// 订单图表相关 DTO
// ============================================

// TrendPoint 趋势数据点
type TrendPoint struct {
	Date   string  `json:"date"`   // 日期 YYYY-MM-DD
	Amount float64 `json:"amount"` // 充值金额
	Count  int     `json:"count"`  // 订单数
}

// UserTypeDistribution 用户类型分布
type UserTypeDistribution struct {
	Label string  `json:"label"` // 标签：企业用户/个人用户
	Value float64 `json:"value"` // 充值金额
	Count int     `json:"count"` // 订单数
}

// OrderChartStatistics 订单图表统计数据
type OrderChartStatistics struct {
	Trend                []TrendPoint           `json:"trend"`
	UserTypeDistribution []UserTypeDistribution `json:"user_type_distribution"`
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

// ============================================
// 营收分析 DTO
// ============================================

// UserRevenueListRequest 用户营收列表请求
type UserRevenueListRequest struct {
	Keyword   string `form:"keyword"` // 用户名/昵称/邮箱
	StartDate string `form:"start_date"`
	EndDate   string `form:"end_date"`
}

// UserRevenueStats 用户营收统计
type UserRevenueStats struct {
	TotalTopupMoney  float64 `json:"total_topup_money"`  // 所有用户充值总额
	TotalUsedMoney   float64 `json:"total_used_money"`   // 所有用户使用总额
	TotalRemainMoney float64 `json:"total_remain_money"` // 所有用户剩余总额
}

// UserRevenueSummary 用户营收汇总
type UserRevenueSummary struct {
	Id               int     `json:"id"`
	Username         string  `json:"username"`
	DisplayName      string  `json:"display_name"`
	TotalTopupMoney  float64 `json:"total_topup_money"`  // 充值总额
	TotalUsedMoney   float64 `json:"total_used_money"`   // 使用总额
	TotalRemainMoney float64 `json:"total_remain_money"` // 剩余总额
	TokenRemain      int64   `json:"token_remain"`       // token 剩余额度
	TokenUsed        int64   `json:"token_used"`         // token 使用额度
	TokenTotal       int64   `json:"token_total"`        // token 总额度
}

// UserRevenueDetailRequest 用户营收详情请求
type UserRevenueDetailRequest struct {
	StartDate string `form:"start_date"` // YYYY-MM-DD
	EndDate   string `form:"end_date"`   // YYYY-MM-DD
}

// UserRevenueDetailResponse 用户营收详情响应
type UserRevenueDetailResponse struct {
	UserId           int                     `json:"user_id"`
	Username         string                  `json:"username"`
	DisplayName      string                  `json:"display_name"`
	TotalTopupMoney  float64                 `json:"total_topup_money"`  // 充值总额
	TotalUsedMoney   float64                 `json:"total_used_money"`   // 使用总额
	TotalRemainMoney float64                 `json:"total_remain_money"` // 剩余总额
	TokenTotal       int64                   `json:"token_total"`        // 用户总 token
	TokenUsed        int64                   `json:"token_used"`         // 使用 token
	TokenRemain      int64                   `json:"token_remain"`       // 剩余 token
	Trend            []*UserRevenueTrendItem `json:"trend"`              // 额度消耗趋势
	ModelConsumption []*ModelConsumptionItem `json:"model_consumption"`  // 模型消耗排行
}

// UserRevenueTrendItem 用户营收趋势项
type UserRevenueTrendItem struct {
	Date       string  `json:"date"`        // 日期 YYYY-MM-DD
	UsedMoney  float64 `json:"used_money"`  // 使用金额
	UsedQuota  int64   `json:"used_quota"`  // 使用 token 数
	TopupMoney float64 `json:"topup_money"` // 充值金额
	TopupQuota int64   `json:"topup_quota"` // 充值 token 数
	Count      int64   `json:"count"`       // 调用次数
}

// ModelConsumptionItem 模型消耗项
type ModelConsumptionItem struct {
	ModelName string `json:"model_name"` // 模型名称
	Quota     int64  `json:"quota"`      // 消耗 token 数
	Count     int64  `json:"count"`      // 调用次数
}

// ============================================
// 财务运营概览（Dashboard）相关 DTO - v3
// ============================================

// DashboardStats 统计指标（9个指标 + 性能指标）
type DashboardStats struct {
	TotalUsers          int     `json:"total_users"`           // 用户数量
	TotalEffectiveTopup float64 `json:"total_effective_topup"` // 有效充值金额
	SuccessOrderCount   int64   `json:"success_order_count"`   // 成功订单数
	TotalTokenCalls     int64   `json:"total_token_calls"`     // Token调用次数
	WeekTopupAmount     float64 `json:"week_topup_amount"`     // 本周充值金额
	WeekTokenCalls      int64   `json:"week_token_calls"`      // 本周Tokens调用次数
	WeekRevenue         float64 `json:"week_revenue"`          // 本周营业收入
	TopModelName        string  `json:"top_model_name"`        // 本周调用次数最多的模型名称
	TopModelCallCount   int64   `json:"top_model_call_count"`  // 本周调用次数最多的模型调用次数
	AvgRPM              float64 `json:"avg_rpm"`               // 平均RPM（请求数/分钟）
	AvgTPM              float64 `json:"avg_tpm"`               // 平均TPM（tokens/分钟）
}

// UserTrendItem 用户注册趋势项
type UserTrendItem struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
}

// UserAuthDistribution 用户认证分布
type UserAuthDistribution struct {
	Unverified int `json:"unverified"` // 0: 未认证
	Individual int `json:"individual"` // 1: 个人用户
	Enterprise int `json:"enterprise"` // 2: 企业用户
	Total      int `json:"total"`
}

// TopupTrendItem 充值趋势项
type TopupTrendItem struct {
	Date   string  `json:"date"`
	Amount float64 `json:"amount"` // 充值金额
	Count  int     `json:"count"`  // 订单数
}

// UserTypeTopupDist 用户类型充值分布
type UserTypeTopupDist struct {
	Unverified float64 `json:"unverified"` // 未认证用户充值
	Individual float64 `json:"individual"` // 个人用户充值
	Enterprise float64 `json:"enterprise"` // 企业用户充值
}

// ConsumptionTrendItem 消费趋势项
type ConsumptionTrendItem struct {
	Date         string  `json:"date"`
	Cost         float64 `json:"cost"`          // 消耗金额
	Tokens       int64   `json:"tokens"`        // Tokens消耗数量
	RequestCount int     `json:"request_count"` // 请求次数
}

// PaymentModeTokensDist 付费方式Tokens分布
type PaymentModeTokensDist struct {
	PayAsYouGo   int64 `json:"pay_as_you_go"` // 按量付费Tokens
	Subscription int64 `json:"subscription"`  // 订阅Tokens
}

// RevenueByUserItem 按用户维度的营收分析项
type RevenueByUserItem struct {
	UserID       int     `json:"user_id"`
	Username     string  `json:"username"`
	PayAsYouGo   float64 `json:"pay_as_you_go"` // 按量付费金额
	Subscription float64 `json:"subscription"`  // 订阅金额
	Total        float64 `json:"total"`         // 总金额
}

// RevenueByUserResponse 按用户营收分析响应
type RevenueByUserResponse struct {
	Items []RevenueByUserItem `json:"items"`
	Total int64               `json:"total"`
}

// PaymentModeRevenueDist 付费方式收入分布
type PaymentModeRevenueDist struct {
	PayAsYouGo   float64 `json:"pay_as_you_go"` // 按量付费收入
	Subscription float64 `json:"subscription"`  // 订阅收入
}

// SupplierTrendItem 渠道消费趋势项
type SupplierTrendItem struct {
	Date         string  `json:"date"`
	Supplier     string  `json:"supplier"`      // 供应商名称
	Tokens       int64   `json:"tokens"`        // Tokens消耗
	RequestCount int     `json:"request_count"` // 请求次数
	Cost         float64 `json:"cost"`          // 消费金额
}

// SupplierDist 渠道消费占比
type SupplierDist struct {
	Items []SupplierDistItem `json:"items"`
}

// SupplierDistItem 渠道消费占比项
type SupplierDistItem struct {
	Supplier string  `json:"supplier"` // 供应商名称
	Cost     float64 `json:"cost"`     // 消费金额
	Ratio    float64 `json:"ratio"`    // 占比（0-1）
}

// PayAsYouGoItem 按量付费（消费记录）营收分析项
type PayAsYouGoItem struct {
	UserID   int     `json:"user_id"`
	Username string  `json:"username"`
	Amount   float64 `json:"amount"` // 按量付费金额（logs.type=2 的 quota 折算）
}

// PayAsYouGoResponse 按量付费营收分析响应
type PayAsYouGoResponse struct {
	Items []PayAsYouGoItem `json:"items"`
	Total int64            `json:"total"`
}

// SubscriptionOrderItem 订阅套餐营收分析项（一个用户购买多个套餐产生多条记录）
type SubscriptionOrderItem struct {
	UserID           int     `json:"user_id"`
	Username         string  `json:"username"`
	PlanType         string  `json:"plan_type"`         // quota / tokens
	PlanName         string  `json:"plan_name"`         // 套餐名
	SubscribeTime    int64   `json:"subscribe_time"`    // 订阅时间（下单时间 create_time）
	StartTime        int64   `json:"start_time"`        // 生效时间（user_subscriptions.start_time）
	ExpireTime       int64   `json:"expire_time"`       // 到期时间（user_subscriptions.end_time）
	Status           string  `json:"status"`            // 订阅状态（active/expired/cancelled）
	PaidAmount       float64 `json:"paid_amount"`       // 实收金额（subscription_orders.money，美元）
	Currency         string  `json:"currency"`          // 货币单位（USD/CNY）
	AmountTotal      int64   `json:"amount_total"`      // 总额度（quota类型的总额度或tokens类型的tokens_limit）
	AmountUsed       int64   `json:"amount_used"`       // 已用额度
	TokensAmount     int64   `json:"tokens_amount"`     // 实得金额（Tokens数量，user_subscriptions.tokens_limit）
	TokensUsed       int64   `json:"tokens_used"`       // 已用Tokens
	UpgradeGroup     string  `json:"upgrade_group"`     // 分组（升级用户组）
	ApplicableModels string  `json:"applicable_models"` // 适用模型
	Source           string  `json:"source"`            // 来源（兑换/钱包）
}

// SubscriptionOrderResponse 订阅套餐营收分析响应
type SubscriptionOrderResponse struct {
	Items []SubscriptionOrderItem `json:"items"`
	Total int64                   `json:"total"`
}

// ============================================
// 营收管理（独立页面）相关 DTO
// ============================================

// RevenueManagementStats 营收管理 头部统计指标
type RevenueManagementStats struct {
	ConsumeUserCount   int64   `json:"consume_user_count"`   // 消费用户数（按量付费去重用户）
	PayAsYouGoAmount   float64 `json:"pay_as_you_go_amount"` // 按量付费金额（logs.type=2 quota 折算）
	SubscriptionAmount float64 `json:"subscription_amount"`  // 订阅付费金额（subscription_orders 成功订单 money 求和）
	SubscriptionCount  int64   `json:"subscription_count"`   // 订阅付费次数（subscription_orders 成功订单数）
	TopSubscription    string  `json:"top_subscription"`     // 热门订阅（购买次数最多的套餐名）
}

// RevenueManagementExportData 营收管理 CSV 导出响应
// 仅用于 service 内部构造，不直接作为 JSON 响应体
type RevenueManagementExportData struct {
	PayAsYouGoItems   []PayAsYouGoItem        `json:"pay_as_you_go_items"`
	SubscriptionItems []SubscriptionOrderItem `json:"subscription_items"`
}

// ============================================
// 营收趋势相关 DTO
// ============================================

// DashboardRevenueTrendItem 营收趋势数据点
type DashboardRevenueTrendItem struct {
	Date   string  `json:"date"`   // 日期 YYYY-MM-DD
	Amount float64 `json:"amount"` // 金额（CNY）
}

// DashboardRevenueTrendResponse 营收趋势响应
type DashboardRevenueTrendResponse struct {
	PayAsYouGo   []DashboardRevenueTrendItem `json:"pay_as_you_go"` // 按量付费趋势
	Subscription []DashboardRevenueTrendItem `json:"subscription"`  // 订阅套餐趋势
}

// DashboardUserAgentDistributionItem User-Agent 分布数据点
type DashboardUserAgentDistributionItem struct {
	UserAgent string `json:"user_agent"` // 客户端 User-Agent
	Count     int    `json:"count"`      // 请求次数
}
