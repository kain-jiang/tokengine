package service

import (
	"fmt"

	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

const (
	BillingSourceWallet       = "wallet"
	BillingSourceSubscription = "subscription"
)

// PreConsumeBilling 根据用户计费偏好创建 BillingSession 并执行预扣费。
// 会话存储在 relayInfo.Billing 上，供后续 Settle / Refund 使用。
func PreConsumeBilling(c *gin.Context, preConsumedQuota int, relayInfo *relaycommon.RelayInfo) *types.NewAPIError {
	session, apiErr := NewBillingSession(c, relayInfo, preConsumedQuota)
	if apiErr != nil {
		return apiErr
	}
	relayInfo.Billing = session
	return nil
}

// ---------------------------------------------------------------------------
// SettleBilling — 后结算辅助函数
// ---------------------------------------------------------------------------

// SettleBilling 执行计费结算。如果 RelayInfo 上有 BillingSession 则通过 session 结算，
// 否则回退到旧的 PostConsumeQuota 路径（兼容按次计费等场景）。
func SettleBilling(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, actualQuota int) error {
	if relayInfo.Billing != nil {
		preConsumed := relayInfo.Billing.GetPreConsumedQuota()
		delta := actualQuota - preConsumed

		if delta > 0 {
			logger.LogInfo(ctx, fmt.Sprintf("预扣费后补扣费：%s（实际消耗：%s，预扣费：%s）",
				logger.FormatQuota(delta),
				logger.FormatQuota(actualQuota),
				logger.FormatQuota(preConsumed),
			))
		} else if delta < 0 {
			logger.LogInfo(ctx, fmt.Sprintf("预扣费后返还扣费：%s（实际消耗：%s，预扣费：%s）",
				logger.FormatQuota(-delta),
				logger.FormatQuota(actualQuota),
				logger.FormatQuota(preConsumed),
			))
		} else {
			logger.LogInfo(ctx, fmt.Sprintf("预扣费与实际消耗一致，无需调整：%s（按次计费）",
				logger.FormatQuota(actualQuota),
			))
		}

		if err := relayInfo.Billing.Settle(actualQuota); err != nil {
			return err
		}

		// 发送额度通知（订阅计费使用订阅剩余额度）
		if actualQuota != 0 {
			if relayInfo.BillingSource == BillingSourceSubscription {
				checkAndSendSubscriptionQuotaNotify(relayInfo)
			} else {
				checkAndSendQuotaNotify(relayInfo, actualQuota-preConsumed, preConsumed)
			}
		}
		return nil
	}

	// 回退：无 BillingSession 时使用旧路径
	quotaDelta := actualQuota - relayInfo.FinalPreConsumedQuota
	if quotaDelta != 0 {
		return PostConsumeQuota(relayInfo, quotaDelta, relayInfo.FinalPreConsumedQuota, true)
	}
	return nil
}

// SettleBillingWithTokens 执行 tokens 计费结算。用于 tokens 类型的订阅套餐。
// actualTokens 是实际消耗的 tokens 数量。
func SettleBillingWithTokens(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, actualTokens int64, actualQuota int) error {
	if relayInfo.Billing == nil {
		// 无 BillingSession，回退到 quota 结算
		return SettleBilling(ctx, relayInfo, actualQuota)
	}

	// 检查是否是 tokens 计费模式
	billingMode := relayInfo.Billing.GetBillingMode()
	if billingMode != "tokens" {
		// 非 tokens 模式，使用 quota 结算
		return SettleBilling(ctx, relayInfo, actualQuota)
	}

	// tokens 模式结算
	preConsumedTokens := relayInfo.Billing.GetPreConsumedTokens()
	delta := actualTokens - preConsumedTokens

	if delta > 0 {
		logger.LogInfo(ctx, fmt.Sprintf("tokens预扣费后补扣费：%d tokens（实际消耗：%d，预扣费：%d）",
			delta, actualTokens, preConsumedTokens))
	} else if delta < 0 {
		logger.LogInfo(ctx, fmt.Sprintf("tokens预扣费后返还扣费：%d tokens（实际消耗：%d，预扣费：%d）",
			-delta, actualTokens, preConsumedTokens))
	} else {
		logger.LogInfo(ctx, fmt.Sprintf("tokens预扣费与实际消耗一致，无需调整：%d tokens", actualTokens))
	}

	if err := relayInfo.Billing.SettleTokens(actualTokens); err != nil {
		return err
	}

	// 发送额度通知
	if actualTokens != 0 {
		checkAndSendSubscriptionQuotaNotify(relayInfo)
	}
	return nil
}
