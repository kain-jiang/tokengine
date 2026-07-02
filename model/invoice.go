package model

// 发票抬头
type InvoiceTitle struct {
	Id             int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId         int    `json:"user_id" gorm:"index"`
	Type           string `json:"type" gorm:"type:varchar(20)"`
	CompanyName    string `json:"company_name" gorm:"type:varchar(100)"`
	CompanyUSCC    string `json:"uscc" gorm:"type:varchar(20)"`
	CompanyAddress string `json:"company_address" gorm:"type:varchar(255)"`
	CompanyPhone   string `json:"company_phone" gorm:"type:varchar(15)"`
	BankName       string `json:"bank_name" gorm:"type:varchar(100)"`
	BankAccount    string `json:"bank_account" gorm:"type:varchar(30)"`
	Email          string `json:"email" gorm:"type:varchar(30)"`
}
