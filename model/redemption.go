package model

import (
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"

	"gorm.io/gorm"
)

type Redemption struct {
	Id           int            `json:"id"`
	UserId       int            `json:"user_id"`
	Key          string         `json:"key" gorm:"type:char(32);uniqueIndex"`
	Status       int            `json:"status" gorm:"default:1"`
	Name         string         `json:"name" gorm:"index"`
	Quota        int            `json:"quota" gorm:"default:100"`
	CreatedTime  int64          `json:"created_time" gorm:"bigint"`
	RedeemedTime int64          `json:"redeemed_time" gorm:"bigint"`
	Count        int            `json:"count" gorm:"-:all"` // only for api request
	UsedUserId   int            `json:"used_user_id"`
	DeletedAt    gorm.DeletedAt `gorm:"index"`
	ExpiredTime  int64          `json:"expired_time" gorm:"bigint"`              // 过期时间，0 表示不过期
	PlanId       int            `json:"plan_id" gorm:"type:int;default:0;index"` // 关联的套餐 ID，0 表示不使用套餐（直接充值）
}

func GetAllRedemptions(startIdx int, num int) (redemptions []*Redemption, total int64, err error) {
	// 开始事务
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 获取总数
	err = tx.Model(&Redemption{}).Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// 获取分页数据
	err = tx.Order("id desc").Limit(num).Offset(startIdx).Find(&redemptions).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// 提交事务
	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	return redemptions, total, nil
}

func SearchRedemptions(keyword string, startIdx int, num int) (redemptions []*Redemption, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Build query based on keyword type
	query := tx.Model(&Redemption{})

	// Only try to convert to ID if the string represents a valid integer
	if id, err := strconv.Atoi(keyword); err == nil {
		query = query.Where("id = ? OR name LIKE ?", id, keyword+"%")
	} else {
		query = query.Where("name LIKE ?", keyword+"%")
	}

	// Get total count
	err = query.Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// Get paginated data
	err = query.Order("id desc").Limit(num).Offset(startIdx).Find(&redemptions).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	return redemptions, total, nil
}

func GetRedemptionById(id int) (*Redemption, error) {
	if id == 0 {
		return nil, errors.New("id 为空！")
	}
	redemption := Redemption{Id: id}
	var err error = nil
	err = DB.First(&redemption, "id = ?", id).Error
	return &redemption, err
}

// GetRedemptionByKey 根据 key 获取兑换码
func GetRedemptionByKey(key string) (*Redemption, error) {
	if key == "" {
		return nil, errors.New("兑换码不能为空")
	}
	redemption := &Redemption{}
	keyCol := "`key`"
	if common.UsingPostgreSQL {
		keyCol = `"key"`
	}
	err := DB.Where(keyCol+" = ?", key).First(redemption).Error
	return redemption, err
}

func Redeem(key string, userId int) (quota int, err error) {
	if key == "" {
		return 0, errors.New("未提供兑换码")
	}
	if userId == 0 {
		return 0, errors.New("无效的 user id")
	}
	redemption := &Redemption{}

	keyCol := "`key`"
	if common.UsingPostgreSQL {
		keyCol = `"key"`
	}
	common.RandomSleep()
	err = DB.Transaction(func(tx *gorm.DB) error {
		err := tx.Set("gorm:query_option", "FOR UPDATE").Where(keyCol+" = ?", key).First(redemption).Error
		if err != nil {
			return errors.New("无效的兑换码")
		}
		if redemption.Status != common.RedemptionCodeStatusEnabled {
			return errors.New("该兑换码已被使用")
		}
		if redemption.ExpiredTime != 0 && redemption.ExpiredTime < common.GetTimestamp() {
			return errors.New("该兑换码已过期")
		}

		// 检查是否关联套餐
		if redemption.PlanId > 0 {
			// 套餐模式：创建 UserSubscription
			return redeemAsSubscription(tx, redemption, userId)
		}

		// 传统模式：直接增加用户 quota
		err = tx.Model(&User{}).Where("id = ?", userId).Update("quota", gorm.Expr("quota + ?", redemption.Quota)).Error
		if err != nil {
			return err
		}
		redemption.RedeemedTime = common.GetTimestamp()
		redemption.Status = common.RedemptionCodeStatusUsed
		redemption.UsedUserId = userId
		err = tx.Save(redemption).Error
		return err
	})
	if err != nil {
		common.SysError("redemption failed: " + err.Error())
		return 0, ErrRedeemFailed
	}

	// 根据兑换模式记录日志
	if redemption.PlanId > 0 {
		plan, _ := GetSubscriptionPlanById(redemption.PlanId)
		planName := plan.Title
		RecordLog(userId, LogTypeSystem, fmt.Sprintf("兑换码兑换套餐 %s，兑换码ID %d", planName, redemption.Id))
		return redemption.PlanId, nil
	}
	RecordLog(userId, LogTypeSystem, fmt.Sprintf("兑换码充值 %s，兑换码ID %d", logger.LogQuota(redemption.Quota), redemption.Id))
	return redemption.Quota, nil
}

// redeemAsSubscription 以套餐形式兑换（创建 UserSubscription）
func redeemAsSubscription(tx *gorm.DB, redemption *Redemption, userId int) error {
	// 1. 获取套餐信息
	plan, err := getSubscriptionPlanByIdTx(tx, redemption.PlanId)
	if err != nil {
		return errors.New("关联的套餐不存在")
	}
	if !plan.Enabled {
		return errors.New("关联的套餐已禁用")
	}

	// 2. 计算套餐有效期
	startTime := common.GetTimestamp()
	endTime, err := calcPlanEndTime(time.Unix(startTime, 0), plan)
	if err != nil {
		return err
	}

	// 3. 如果兑换码有独立的过期时间，且早于套餐结束时间，则使用兑换码的过期时间
	if redemption.ExpiredTime > 0 && redemption.ExpiredTime < endTime {
		endTime = redemption.ExpiredTime
	}

	// 4. 计算重置时间
	lastResetTime := startTime
	nextResetTime := calcNextResetTime(time.Unix(startTime, 0), plan, endTime)

	// 5. 创建 UserSubscription
	subscription := &UserSubscription{
		UserId:           userId,
		PlanId:           plan.Id,
		AmountTotal:      plan.TotalAmount,
		AmountUsed:       0,
		StartTime:        startTime,
		EndTime:          endTime,
		Status:           "active",
		Source:           "redemption", // 标记来源为兑换
		LastResetTime:    lastResetTime,
		NextResetTime:    nextResetTime,
		UpgradeGroup:     plan.UpgradeGroup,
		PrevUserGroup:    "",
		TokensUsed:       0,
		TokensLimit:      plan.TokensLimit,
		ApplicableModels: plan.ApplicableModels,
	}

	// 使用 DB.Create 而不是 tx.Create，因为 UserSubscription.BeforeCreate 会使用 DB
	err = DB.Create(subscription).Error
	if err != nil {
		return err
	}

	// 6. 更新兑换码状态
	redemption.RedeemedTime = common.GetTimestamp()
	redemption.Status = common.RedemptionCodeStatusUsed
	redemption.UsedUserId = userId
	err = tx.Save(redemption).Error

	return err
}

func (redemption *Redemption) Insert() error {
	var err error
	err = DB.Create(redemption).Error
	return err
}

func (redemption *Redemption) SelectUpdate() error {
	// This can update zero values
	return DB.Model(redemption).Select("redeemed_time", "status").Updates(redemption).Error
}

// Update Make sure your token's fields is completed, because this will update non-zero values
func (redemption *Redemption) Update() error {
	var err error
	err = DB.Model(redemption).Select("name", "status", "quota", "redeemed_time", "expired_time", "plan_id").Updates(redemption).Error
	return err
}

func (redemption *Redemption) Delete() error {
	var err error
	err = DB.Delete(redemption).Error
	return err
}

func DeleteRedemptionById(id int) (err error) {
	if id == 0 {
		return errors.New("id 为空！")
	}
	redemption := Redemption{Id: id}
	err = DB.Where(redemption).First(&redemption).Error
	if err != nil {
		return err
	}
	return redemption.Delete()
}

func DeleteInvalidRedemptions() (int64, error) {
	now := common.GetTimestamp()
	result := DB.Where("status IN ? OR (status = ? AND expired_time != 0 AND expired_time < ?)", []int{common.RedemptionCodeStatusUsed, common.RedemptionCodeStatusDisabled}, common.RedemptionCodeStatusEnabled, now).Delete(&Redemption{})
	return result.RowsAffected, result.Error
}
