package controller

import (
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// LogTypeTopup is defined in model/log.go
const LogTypeTopup = 1

type SubscriptionWalletPayRequest struct {
	PlanId int `json:"plan_id"`
}

// SubscriptionRequestWalletPay 用钱包余额购买订阅
func SubscriptionRequestWalletPay(c *gin.Context) {
	var req SubscriptionWalletPayRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.PlanId <= 0 {
		common.ApiErrorMsg(c, "参数错误")
		return
	}

	plan, err := model.GetSubscriptionPlanById(req.PlanId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !plan.Enabled {
		common.ApiErrorMsg(c, "套餐未启用")
		return
	}
	if plan.PriceAmount < 0.01 {
		common.ApiErrorMsg(c, "套餐金额过低")
		return
	}

	userId := c.GetInt("id")

	// 检查购买上限
	if plan.MaxPurchasePerUser > 0 {
		count, err := model.CountUserSubscriptionsByPlan(userId, plan.Id)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if count >= int64(plan.MaxPurchasePerUser) {
			common.ApiErrorMsg(c, "已达到该套餐购买上限")
			return
		}
	}

	// 计算需要的 quota 数量
	quotaPerUnit := common.QuotaPerUnit
	if quotaPerUnit <= 0 {
		quotaPerUnit = 10000 // 默认值
	}
	requiredQuota := int(plan.PriceAmount * float64(quotaPerUnit))

	// 获取用户当前余额
	currentQuota, err := model.GetUserQuota(userId, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// 检查钱包余额是否足够
	if currentQuota < requiredQuota {
		// 余额不足，返回提示信息
		common.ApiErrorMsg(c, fmt.Sprintf("余额不足，需要 %d 配额，当前余额 %d 配额，请先充值", requiredQuota, currentQuota))
		return
	}

	// 生成订单号
	tradeNo := fmt.Sprintf("%s%d", common.GetRandomString(6), time.Now().Unix())
	tradeNo = fmt.Sprintf("SUBUSR%dWL%s", userId, tradeNo)

	// 创建订阅订单（状态为成功，因为直接扣款）
	order := &model.SubscriptionOrder{
		UserId:        userId,
		PlanId:        plan.Id,
		Money:         plan.PriceAmount,
		TradeNo:       tradeNo,
		PaymentMethod: "wallet",
		CreateTime:    time.Now().Unix(),
		Status:        common.TopUpStatusSuccess, // 直接成功
		CompleteTime:  time.Now().Unix(),
	}
	if err := order.Insert(); err != nil {
		common.ApiErrorMsg(c, "创建订单失败")
		return
	}

	// 扣减用户钱包余额
	if err := model.DecreaseUserQuota(userId, requiredQuota, false); err != nil {
		// 回滚订单状态
		order.Status = common.TopUpStatusFailed
		order.Update()
		common.ApiErrorMsg(c, "扣款失败")
		return
	}

	// 创建用户订阅
	_, err = model.CreateUserSubscriptionFromPlanTx(model.DB, userId, plan, "wallet")
	if err != nil {
		// 回滚余额和订单
		model.IncreaseUserQuota(userId, requiredQuota, false)
		order.Status = common.TopUpStatusFailed
		order.Update()
		common.ApiErrorMsg(c, "创建订阅失败: "+err.Error())
		return
	}

	// 记录日志
	upgradeGroup := ""
	if plan.UpgradeGroup != "" {
		upgradeGroup = plan.UpgradeGroup
		_ = model.UpdateUserGroupCache(userId, upgradeGroup)
	}
	msg := fmt.Sprintf("订阅购买成功，套餐: %s，支付金额: %.2f，支付方式: 钱包余额", plan.Title, plan.PriceAmount)
	model.RecordLog(userId, LogTypeTopup, msg)

	// 返回成功
	common.ApiSuccess(c, gin.H{
		"message":    "购买成功",
		"trade_no":   tradeNo,
		"plan_title": plan.Title,
		"money":      plan.PriceAmount,
	})
}
