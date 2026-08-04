package model

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
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
func GetRealNameAuthByUserId(userId int, authType string) (*RealNameAuth, error) {
	var auth RealNameAuth
	query := DB.Model(&RealNameAuth{}).Where("user_id = ?", userId)
	// 主要查询个人是否认证
	if authType != "" {
		query = query.Where("auth_type = ?", authType)
	}
	err := query.Order("id desc").First(&auth).Error
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
		common.SysLog(fmt.Sprintf("username[%s]实名认证失败: "+err.Error(), auth.Username))
	} else {
		auth.Status = AuditPassed
		auth.Update()
		common.SysLog(fmt.Sprintf("username[%s]实名认证成功", auth.Username))

		// 更新用户类型
		userType := PersonalType
		if auth.AuthType == CompanyAuth {
			userType = CompanyType
		}
		err = UpdateUserType(auth.UserId, userType)
		if err == nil {
			common.SysLog(fmt.Sprintf("用户【%d】更新用户类型成功", auth.UserId))
		}

		if operation != "create" {
			return
		}

		// 认证只送一次token, 个人认证-->企业认证
		if auth.AuthType == CompanyAuth {
			return
		}

		// 实名认证成功后，根据系统设置绑定的赠送订阅套餐发放额度
		// 配置入口：系统设置 → 运营设置 → 额度设置 → 下发方式 → 选择订阅套餐
		// 套餐 source 标记为 "gift"，额度与充值隔离，可限制模型、可过期
		if common.RealNameAuthGiftPlanId > 0 {
			sub, bindErr := BindGiftSubscription(auth.UserId, common.RealNameAuthGiftPlanId)
			if bindErr != nil {
				common.SysLog("实名认证赠送订阅失败: " + bindErr.Error())
			} else if sub != nil {
				common.SysLog(fmt.Sprintf("实名认证成功，赠送用户【%d】订阅套餐", auth.UserId))
				RecordLog(auth.UserId, LogTypeManage,
					fmt.Sprintf("实名认证成功，系统赠送订阅套餐（额度 %s）", logger.LogQuota(int(sub.AmountTotal))))
			}
		}
	}
}
