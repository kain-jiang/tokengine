package model

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// 实名认证

const (
	PersonalAuth = "personal" // 个人认证
	CompanyAuth  = "company"  // 企业认证

	AuditPending  = "AuditPending"  // 审核中
	AuditPassed   = "AuditPassed"   // 审核通过
	AuditRejected = "AuditRejected" // 审核拒绝
)

var AuthType = struct {
	PersonalAuth string
	CompanyAuth  string
}{PersonalAuth: PersonalAuth, CompanyAuth: CompanyAuth}

var AuthStatus = struct {
	AuditPending  string
	AuditPassed   string
	AuditRejected string
}{AuditPending: AuditPending, AuditPassed: AuditPassed, AuditRejected: AuditRejected}

func (RealNameAuth) TableName() string {
	return "real_name_auth"
}

// GetRealNameAuthByUserId 根据用户ID获取实名认证信息
func GetRealNameAuthByUserId(userId int) (*RealNameAuth, error) {
	var auth RealNameAuth
	err := DB.Where("user_id = ?", userId).First(&auth).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &auth, nil
}

// Create 创建实名认证记录
func (auth *RealNameAuth) Create() error {
	return DB.Create(auth).Error
}

// Update 更新实名认证记录
func (auth *RealNameAuth) Update() error {
	if auth.Id == 0 {
		return errors.New("实名认证记录ID不能为空")
	}
	return DB.Save(auth).Error
}

type RealNameAuth struct {
	Id                     int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId                 int    `json:"user_id" gorm:"index"`
	AuthType               string `json:"auth_type" gorm:"type:varchar(20)"`
	Username               string `json:"username" gorm:"type:varchar(100)"`    // 用户名字（法人姓名）
	PersonICard            string `json:"person_icard" gorm:"type:varchar(18)"` // 身份证号码
	CompanyName            string `json:"company_name" gorm:"type:varchar(100)"`
	CompanyUSCC            string `json:"uscc" gorm:"type:varchar(20)"`                      // 统一社会信用代码
	CompanyBusinessLicense string `json:"company_business_license" gorm:"type:varchar(255)"` // 营业执照(图片地址)
	CompanyContactPerson   string `json:"company_contact_person" gorm:"type:varchar(100)"`   // 联系人姓名
	CompanyContactPhone    string `json:"company_contact_phone" gorm:"type:varchar(11)"`     // 联系人电话
	Status                 string `json:"status" gorm:"type:varchar(20)"`                    // 审核状态
	CreatedAt              int64  `json:"created_at" gorm:"type:bigint;default:0;index"`     // 创建时间（Unix时间戳）
	UpdatedAt              int64  `json:"updated_at" gorm:"type:bigint;default:0;index"`
}

// operation create or update
func (auth *RealNameAuth) ToAuth(operation string) {
	var ok bool
	var err error
	if auth.AuthType == CompanyAuth {
		sceneCode := "company_auth"
		merchantBizId := "ciLian"
		merchantUserId := auth.Username
		ok, err = common.VerifyCompany(sceneCode, merchantBizId, merchantUserId, "", "", auth.CompanyName, auth.CompanyUSCC)
	} else {
		ok, err = common.VerifyIdentityCard(auth.Username, auth.PersonICard)
	}
	if !ok {
		auth.Status = AuditRejected
		auth.Update()
		common.SysLog("实名认证失败: " + err.Error())
	} else {
		auth.Status = AuditPassed
		auth.Update()
		common.SysLog("实名认证成功: " + err.Error())

		if operation != "create" {
			return
		}
		// 实名认证成功，赠送100万tokens, 100万tokens=2美元
		// todo 要改，赠送的额度要与充值的额度分级使用，赠送额度只能使用某些模型
		//common.QuotaPerUnit

		usdExchangeRate := operation_setting.USDExchangeRate
		if usdExchangeRate <= 0 {
			usdExchangeRate = 7.3 // 默认汇率
		}
		cnyMoney := 2 * usdExchangeRate
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		quotaToAdd := int(decimal.NewFromFloat(cnyMoney).Div(decimal.NewFromFloat(usdExchangeRate)).Mul(dQuotaPerUnit).IntPart())
		if err = IncreaseUserQuota(auth.UserId, quotaToAdd, true); err != nil {
			common.SysLog("实名认证成功，但赠送用户额度失败: " + err.Error())
			return
		}
		common.SysLog(fmt.Sprintf("实名认证成功，赠送用户【%d】额度 %s", auth.UserId, logger.LogQuota(quotaToAdd)))
		RecordLog(auth.UserId, LogTypeManage,
			fmt.Sprintf("实名认证成功，系统赠送用户【%d】额度 %s", auth.UserId, logger.LogQuota(quotaToAdd)))
	}
}
