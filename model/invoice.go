package model

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
)

const (
	PersonaInvoice = "personal" // 个人开票
	CompanyInvoice = "company"  // 企业开票

	// 开票状态
	InvoicePendingStatus   = "pending"   // 待开票
	InvoiceRunningStatus   = "running"   // 开票中
	InvoiceStatusCompleted = "completed" // 开票完成
	InvoiceStatusFailed    = "failed"    // 开票失败

	// 开票类型
	GeneralInvoice = "GENERAL_INVOICE"
	SpecialInvoice = "SPECIAL_INVOICE"
)

// 发票抬头
type InvoiceTitle struct {
	Id             int            `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId         int            `json:"user_id" gorm:"index;not null"`
	InvoiceType    string         `json:"type" gorm:"type:varchar(20)"`             // 开票主体类型 个人/公司
	Title          string         `json:"title" gorm:"type:varchar(100);index"`     // 发票抬头
	CompanyUSCC    string         `json:"uscc" gorm:"type:varchar(18)"`             // 统一社会信用代码
	CompanyAddress string         `json:"company_address" gorm:"type:varchar(255)"` // 公司地址
	CompanyPhone   string         `json:"company_phone" gorm:"type:varchar(20)"`    // 公司电话
	BankName       string         `json:"bank_name" gorm:"type:varchar(100)"`       // 开户银行
	BankAccount    string         `json:"bank_account" gorm:"type:varchar(30)"`     // 银行账号
	Email          string         `json:"email" gorm:"type:varchar(30)"`            // 接收邮箱
	CreatedAt      time.Time      `gorm:"autoCreateTime"`
	UpdatedAt      time.Time      `gorm:"autoUpdateTime"`
	DeletedAt      gorm.DeletedAt `gorm:"index"`
}

func (o *InvoiceTitle) String() string {
	bytes, _ := json.Marshal(o)
	return string(bytes)
}

func (o *InvoiceTitle) ToMap() map[string]interface{} {
	dic := map[string]interface{}{
		"id":              o.Id,
		"user_id":         o.UserId,
		"type":            o.InvoiceType,
		"title":           o.Title,
		"uscc":            o.CompanyUSCC,
		"company_address": o.CompanyAddress,
		"company_phone":   o.CompanyPhone,
		"bank_name":       o.BankName,
		"bank_account":    o.BankAccount,
		"email":           o.Email,
		"created_at":      o.CreatedAt.Format("2006-01-02 15:04:05"),
	}
	return dic
}

func (InvoiceTitle) TableName() string {
	return "invoice_title"
}

// 开票记录

// 开票类型：增值税普通发票、增值税专用发票
// 个人只能开普通发票
// 企业可以开普通发票，也可以开增值税专用发票
// 企业开普通票，必须提供公司的纳税人识别号或统一社会信用代码；
// 企业开增值税专用发票，必须提供纳税人识别号或统一社会信用代码、开户银行、银行账号、注册地址、注册电话。
type InvoiceRecord struct {
	Id               int       `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId           int       `json:"user_id" gorm:"index;not null"`
	InvoiceTitleId   int       `json:"invoice_title_id" gorm:"index;not null"`
	InvoiceTitleInfo string    `json:"invoice_title_info" gorm:"type:varchar(1000)"` // 发票抬头信息, 存储json数据, 防止用户发票抬头信息修改,而没有对上开票记录
	OrderIds         string    `json:"order_ids" gorm:"type:varchar(500)"`           // 订单id列表, 逗号分割 1,2,3
	Amount           float64   `json:"amount" gorm:"index;not null"`                 // 开票金额
	CreatedAt        time.Time `gorm:"autoCreateTime"`
	UpdatedAt        time.Time `gorm:"autoUpdateTime"`
	Status           string    `json:"status" gorm:"type:varchar(20)"`       // 开票状态 pending/completed/failed
	InvoiceType      string    `json:"invoice_type" gorm:"type:varchar(20)"` // 开票类型，普票general_invoice、专票special_invoice
	InvoiceUrl       string    `json:"invoice_url" gorm:"type:varchar(255)"` // 发票下载链接
	Remark           string    `json:"remark" gorm:"type:varchar(255)"`      // 用户备注
	ErrorMsg         string    `json:"error_msg" gorm:"type:varchar(255)"`   // 开票失败原因, 运营人员填写
}

func (InvoiceRecord) TableName() string {
	return "invoice_record"
}

func (o *InvoiceRecord) ToMap() (map[string]interface{}, error) {
	invoiceTitleInfo := make(map[string]interface{})
	err := json.Unmarshal([]byte(o.InvoiceTitleInfo), &invoiceTitleInfo)
	if err != nil {
		return nil, err
	}
	dic := map[string]interface{}{
		"id":                 o.Id,
		"user_id":            o.UserId,
		"invoice_title_id":   o.InvoiceTitleId,
		"invoice_title_info": o.InvoiceTitleInfo,
		"order_ids":          o.OrderIds,
		"amount":             o.Amount,
		"status":             o.Status,
		"invoice_type":       o.InvoiceType,
		"invoice_url":        o.InvoiceUrl,
		"created_at":         o.CreatedAt.Format("2006-01-02 15:04:05"),
	}
	return dic, nil
}

// 获取已经开票、正在开票的订单
func GetInvoicedOrderIds(userId int) (map[int]bool, error) {
	var invoicedOrderIds []string
	err := DB.Model(&InvoiceRecord{}).
		Where("user_id = ? AND status IN ?", userId, []string{
			InvoicePendingStatus,
			InvoiceRunningStatus,
			InvoiceStatusCompleted,
		}).
		Pluck("order_ids", &invoicedOrderIds).Error
	if err != nil {
		return nil, fmt.Errorf("查询失败, 错误详情：%s", err)
	}
	invoicedOrderIdMap := make(map[int]bool)
	for _, orderIdsStr := range invoicedOrderIds {
		if orderIdsStr == "" {
			continue
		}
		for _, idStr := range strings.Split(orderIdsStr, ",") {
			idStr = strings.TrimSpace(idStr)
			if idStr == "" {
				continue
			}
			var id int
			_, err = fmt.Sscanf(idStr, "%d", &id)
			if err == nil {
				invoicedOrderIdMap[id] = true
			}
		}
	}
	return invoicedOrderIdMap, nil
}
