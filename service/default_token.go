package service

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
)

// DefaultTokenName 是新用户注册后自动创建的默认令牌名称。
const DefaultTokenName = "default"

// CreateDefaultTokenForUser 为指定用户创建一个默认令牌。
//
// 该令牌具有以下属性：
//   - 名称：default
//   - 分组：默认（若启用 auto 分组则使用 auto）
//   - 永不过期（ExpiredTime = -1）
//   - 无限额度（UnlimitedQuota = true）
//
// 仅当 constant.GenerateDefaultToken 为 true 时才会创建。
// 创建失败不会中断调用流程，仅记录日志，以保证用户注册主流程不受影响。
func CreateDefaultTokenForUser(userId int, username string) error {
	if !constant.GenerateDefaultToken {
		return nil
	}

	key, err := common.GenerateKey()
	if err != nil {
		common.SysLog(fmt.Sprintf("failed to generate default token key for user %d: %s", userId, err.Error()))
		return err
	}

	token := model.Token{
		UserId:             userId,
		Name:               DefaultTokenName,
		Key:                key,
		CreatedTime:        common.GetTimestamp(),
		AccessedTime:       common.GetTimestamp(),
		ExpiredTime:        -1, // 永不过期
		RemainQuota:        0,  // 无限额度时该值无意义
		UnlimitedQuota:     true,
		ModelLimitsEnabled: false,
	}

	// 若启用 auto 分组，则令牌使用 auto 分组；否则使用默认分组
	if setting.DefaultUseAutoGroup {
		token.Group = "auto"
	} else {
		token.Group = "default"
	}

	if err := token.Insert(); err != nil {
		common.SysError(fmt.Sprintf("failed to create default token for user %d (%s): %s", userId, username, err.Error()))
		return err
	}

	common.SysLog(fmt.Sprintf("created default token for new user %d (%s)", userId, username))
	return nil
}
