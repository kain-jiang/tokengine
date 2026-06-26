package model

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// ============================================
// Invoice (发票模型)
// ============================================

// InvoiceType 发票类型
const (
	InvoiceTypeElectronic = "electronic" // 电子发票
	InvoiceTypePaper      = "paper"      // 纸质发票
)

// InvoiceStatus 发票状态
const (
	InvoiceStatusPending   = "pending"   // 待审核
	InvoiceStatusApproved  = "approved"  // 已通过
	InvoiceStatusRejected  = "rejected"  // 已拒绝
	InvoiceStatusIssued    = "issued"    // 已开具
	InvoiceStatusCancelled = "cancelled" // 已取消
)

// Invoice 发票模型
type Invoice struct {
	Id            int     `json:"id" gorm:"primaryKey"`
	InvoiceNo     string  `json:"invoice_no" gorm:"unique;type:varchar(50);column:invoice_no"` // 发票编号
	UserId        int     `json:"user_id" gorm:"index"`
	Username      string  `json:"username" gorm:"index;type:varchar(50)"`
	Type          string  `json:"type" gorm:"type:varchar(20)"`                               // electronic, paper
	Title         string  `json:"title" gorm:"type:varchar(200)"`                             // 发票抬头
	TaxNumber     string  `json:"tax_number" gorm:"type:varchar(50);column:tax_number"`       // 税号
	ContactName   string  `json:"contact_name" gorm:"type:varchar(50);column:contact_name"`   // 联系人
	ContactPhone  string  `json:"contact_phone" gorm:"type:varchar(20);column:contact_phone"` // 联系电话
	Address       string  `json:"address" gorm:"type:varchar(500)"`                           // 地址
	BankName      string  `json:"bank_name" gorm:"type:varchar(200);column:bank_name"`        // 开户行
	BankAccount   string  `json:"bank_account" gorm:"type:varchar(50);column:bank_account"`   // 银行账号
	Amount        float64 `json:"amount" gorm:"type:decimal(10,2)"`                           // 开票金额
	Quota         int     `json:"quota" gorm:"default:0"`                                     // 对应额度
	OrderIds      string  `json:"order_ids" gorm:"type:json"`                                 // 关联订单ID (JSON数组)
	Remark        string  `json:"remark" gorm:"type:varchar(500)"`                            // 备注
	Status        string  `json:"status" gorm:"type:varchar(20);default:'pending'"`           // pending, approved, rejected, issued, cancelled
	InvoiceFile   string  `json:"invoice_file" gorm:"type:varchar(500);column:invoice_file"`  // 发票文件路径
	ApprovedBy    int     `json:"approved_by" gorm:"default:0"`                               // 审批人ID
	ApprovedByStr string  `json:"approved_by_str" gorm:"-"`                                   // 审批人姓名 (不存储)
	ApprovedAt    int64   `json:"approved_at" gorm:"default:0"`                               // 审批时间
	IssuedAt      int64   `json:"issued_at" gorm:"default:0"`                                 // 开票时间
	CreateTime    int64   `json:"create_time" gorm:"index"`
	UpdateTime    int64   `json:"update_time"`
}

func (Invoice) TableName() string {
	return "invoices"
}

// Insert 插入发票记录
func (invoice *Invoice) Insert() error {
	invoice.CreateTime = common.GetTimestamp()
	invoice.UpdateTime = invoice.CreateTime
	return DB.Create(invoice).Error
}

// Update 更新发票记录
func (invoice *Invoice) Update() error {
	invoice.UpdateTime = common.GetTimestamp()
	return DB.Model(&Invoice{}).Where("id = ?", invoice.Id).Updates(invoice).Error
}

// GetInvoiceById 根据ID获取发票
func GetInvoiceById(id int) (*Invoice, error) {
	var invoice Invoice
	err := DB.Where("id = ?", id).First(&invoice).Error
	return &invoice, err
}

// GetInvoiceByInvoiceNo 根据发票编号获取发票
func GetInvoiceByInvoiceNo(invoiceNo string) (*Invoice, error) {
	var invoice Invoice
	err := DB.Where("invoice_no = ?", invoiceNo).First(&invoice).Error
	return &invoice, err
}

// GetUserInvoices 获取用户发票列表
func GetUserInvoices(userId int, status string, startTime, endTime int64, pageInfo *common.PageInfo) ([]*Invoice, int64, error) {
	var invoices []*Invoice
	var total int64

	query := DB.Where("user_id = ?", userId).Order("create_time desc")
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if startTime > 0 {
		query = query.Where("create_time >= ?", startTime)
	}
	if endTime > 0 {
		query = query.Where("create_time <= ?", endTime)
	}

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = query.Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&invoices).Error
	if err != nil {
		return nil, 0, err
	}

	// 填充审批人姓名
	for _, inv := range invoices {
		if inv.ApprovedBy > 0 {
			username, _ := GetUsernameById(inv.ApprovedBy, false)
			inv.ApprovedByStr = username
		}
	}

	return invoices, total, nil
}

// GetAllInvoices 获取全部发票（管理员）
func GetAllInvoices(status string, startTime, endTime int64, keyword string, pageInfo *common.PageInfo) ([]*InvoiceWithUsername, int64, error) {
	var invoices []*InvoiceWithUsername
	var total int64

	query := DB.Model(&Invoice{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if startTime > 0 {
		query = query.Where("create_time >= ?", startTime)
	}
	if endTime > 0 {
		query = query.Where("create_time <= ?", endTime)
	}
	if keyword != "" {
		query = query.Where("invoice_no LIKE ? OR username LIKE ? OR title LIKE ?", "%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%")
	}

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	// 使用JOIN获取用户名
	invoices = make([]*InvoiceWithUsername, 0)
	err = query.Select("invoices.*, users.username").
		Joins("LEFT JOIN users ON invoices.user_id = users.id").
		Order("invoices.create_time desc").
		Limit(pageInfo.GetPageSize()).
		Offset(pageInfo.GetStartIdx()).
		Find(&invoices).Error

	return invoices, total, err
}

// InvoiceWithUsername 发票（包含用户名）
type InvoiceWithUsername struct {
	Invoice
	Username string `json:"username" gorm:"column:username"`
}

// UpdateInvoiceStatus 更新发票状态
func UpdateInvoiceStatus(id int, status string, approvedBy int, remark string) error {
	updates := map[string]interface{}{
		"status":      status,
		"update_time": common.GetTimestamp(),
	}
	if status == InvoiceStatusApproved || status == InvoiceStatusRejected {
		updates["approved_by"] = approvedBy
		updates["approved_at"] = common.GetTimestamp()
	}
	if status == InvoiceStatusIssued {
		updates["issued_at"] = common.GetTimestamp()
	}
	if remark != "" {
		updates["remark"] = remark
	}
	return DB.Model(&Invoice{}).Where("id = ?", id).Updates(updates).Error
}

// ============================================
// Reconciliation (对账记录模型)
// ============================================

// ReconciliationType 对账类型
const (
	ReconciliationTypeDownstream = "downstream" // 下游消费对账
	ReconciliationTypeUpstream   = "upstream"   // 上游渠道对账
)

// ReconciliationStatus 对账状态
const (
	ReconciliationStatusPending     = "pending"     // 待对账
	ReconciliationStatusReconciled  = "reconciled"  // 已对账
	ReconciliationStatusDiscrepancy = "discrepancy" // 有差异
)

// Reconciliation 对账记录模型
type Reconciliation struct {
	Id               int             `json:"id" gorm:"primaryKey"`
	Type             string          `json:"type" gorm:"type:varchar(20)"`   // downstream, upstream
	Period           string          `json:"period" gorm:"type:varchar(20)"` // 2026-06
	ChannelId        int             `json:"channel_id" gorm:"default:0"`    // 渠道ID（上游对账时）
	ChannelName      string          `json:"channel_name" gorm:"type:varchar(100)"`
	TotalAmount      float64         `json:"total_amount" gorm:"type:decimal(12,2)"`           // 总金额
	TotalQuota       int             `json:"total_quota" gorm:"default:0"`                     // 总额度
	TransactionCount int             `json:"transaction_count" gorm:"default:0"`               // 交易笔数
	ReconciledAmount float64         `json:"reconciled_amount" gorm:"type:decimal(12,2)"`      // 对账金额
	Discrepancy      float64         `json:"discrepancy" gorm:"type:decimal(12,2)"`            // 差异金额
	Status           string          `json:"status" gorm:"type:varchar(20);default:'pending'"` // pending, reconciled, discrepancy
	Data             json.RawMessage `json:"data" gorm:"type:json"`                            // 详细数据
	Remark           string          `json:"remark" gorm:"type:varchar(500)"`                  // 备注
	CreateTime       int64           `json:"create_time" gorm:"index"`
	UpdateTime       int64           `json:"update_time"`
}

func (Reconciliation) TableName() string {
	return "reconciliations"
}

// Insert 插入对账记录
func (rec *Reconciliation) Insert() error {
	rec.CreateTime = common.GetTimestamp()
	rec.UpdateTime = rec.CreateTime
	return DB.Create(rec).Error
}

// Update 更新对账记录
func (rec *Reconciliation) Update() error {
	rec.UpdateTime = common.GetTimestamp()
	return DB.Model(&Reconciliation{}).Where("id = ?", rec.Id).Updates(rec).Error
}

// GetReconciliationByPeriod 根据周期获取对账记录
func GetReconciliationByPeriod(recType, period string) (*Reconciliation, error) {
	var rec Reconciliation
	err := DB.Where("type = ? AND period = ?", recType, period).First(&rec).Error
	return &rec, err
}

// GetAllReconciliations 获取全部对账记录
func GetAllReconciliations(recType, period, status string, pageInfo *common.PageInfo) ([]*Reconciliation, int64, error) {
	var reconciliations []*Reconciliation
	var total int64

	query := DB.Model(&Reconciliation{}).Order("create_time desc")
	if recType != "" {
		query = query.Where("type = ?", recType)
	}
	if period != "" {
		query = query.Where("period = ?", period)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = query.Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&reconciliations).Error
	return reconciliations, total, err
}

// ============================================
// RevenueReport (营收报表模型)
// ============================================

// RevenueReportType 营收报表类型
const (
	RevenueReportTypeDaily   = "daily"   // 日报
	RevenueReportTypeMonthly = "monthly" // 月报
	RevenueReportTypeYearly  = "yearly"  // 年报
)

// RevenueReport 营收报表模型
type RevenueReport struct {
	Id                int             `json:"id" gorm:"primaryKey"`
	ReportType        string          `json:"report_type" gorm:"type:varchar(20)"`          // daily, monthly, yearly
	Period            string          `json:"period" gorm:"type:varchar(20);index"`         // 2026-06-20 / 2026-06 / 2026
	TotalRevenue      float64         `json:"total_revenue" gorm:"type:decimal(12,2)"`      // 总营收
	TotalTopup        float64         `json:"total_topup" gorm:"type:decimal(12,2)"`        // 总充值
	TotalSubscription float64         `json:"total_subscription" gorm:"type:decimal(12,2)"` // 订阅收入
	TotalConsumption  float64         `json:"total_consumption" gorm:"type:decimal(12,2)"`  // 总消费
	NetRevenue        float64         `json:"net_revenue" gorm:"type:decimal(12,2)"`        // 净营收
	OrderCount        int             `json:"order_count" gorm:"default:0"`                 // 订单数
	UserCount         int             `json:"user_count" gorm:"default:0"`                  // 用户数
	RequestCount      int             `json:"request_count" gorm:"default:0"`               // 请求数
	Data              json.RawMessage `json:"data" gorm:"type:json"`                        // 详细数据
	CreateTime        int64           `json:"create_time" gorm:"uniqueIndex:idx_report_period"`
	UpdateTime        int64           `json:"update_time"`
}

func (RevenueReport) TableName() string {
	return "revenue_reports"
}

// Insert 插入营收报表
func (report *RevenueReport) Insert() error {
	report.CreateTime = common.GetTimestamp()
	report.UpdateTime = report.CreateTime
	return DB.Create(report).Error
}

// Update 更新营收报表
func (report *RevenueReport) Update() error {
	report.UpdateTime = common.GetTimestamp()
	return DB.Model(&RevenueReport{}).Where("id = ?", report.Id).Updates(report).Error
}

// GetRevenueReport 获取营收报表
func GetRevenueReport(reportType, period string) (*RevenueReport, error) {
	var report RevenueReport
	err := DB.Where("report_type = ? AND period = ?", reportType, period).First(&report).Error
	return &report, err
}

// GetAllRevenueReports 获取全部营收报表
func GetAllRevenueReports(reportType, period string, startTime, endTime int64, pageInfo *common.PageInfo) ([]*RevenueReport, int64, error) {
	var reports []*RevenueReport
	var total int64

	query := DB.Model(&RevenueReport{}).Order("period desc")
	if reportType != "" {
		query = query.Where("report_type = ?", reportType)
	}
	if period != "" {
		query = query.Where("period = ?", period)
	}
	if startTime > 0 {
		query = query.Where("create_time >= ?", startTime)
	}
	if endTime > 0 {
		query = query.Where("create_time <= ?", endTime)
	}

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = query.Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&reports).Error
	return reports, total, err
}

// GenerateRevenueReportKey 生成营收报表周期键
func GenerateRevenueReportKey(reportType string, t time.Time) string {
	switch reportType {
	case RevenueReportTypeDaily:
		return t.Format("2006-01-02")
	case RevenueReportTypeMonthly:
		return t.Format("2006-01")
	case RevenueReportTypeYearly:
		return t.Format("2006")
	default:
		return t.Format("2006-01-02")
	}
}

// ParsePeriodToTime 将周期字符串解析为时间
func ParsePeriodToTime(period string) (time.Time, error) {
	// 尝试不同格式
	formats := []string{
		"2006-01-02", // daily
		"2006-01",    // monthly
		"2006",       // yearly
	}
	for _, format := range formats {
		t, err := time.Parse(format, period)
		if err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("unable to parse period: %s", period)
}
