package controller

import (
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

const LogTypeTopup = 1

type SubscriptionWalletPayRequest struct {
	PlanId int `json:"plan_id"`
}

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

	quotaPerUnit := common.QuotaPerUnit
	if quotaPerUnit <= 0 {
		quotaPerUnit = 10000
	}
	requiredQuota := int(plan.PriceAmount * float64(quotaPerUnit))

	currentQuota, err := model.GetUserQuota(userId, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	if currentQuota < requiredQuota {
		// 余额不足，返回简洁的提示信息
		common.ApiErrorMsg(c, "余额不足，请先充值")
		return
	}

	tradeNo := fmt.Sprintf("%s%d", common.GetRandomString(6), time.Now().Unix())
	tradeNo = fmt.Sprintf("SUBUSR%dWL%s", userId, tradeNo)

	order := &model.SubscriptionOrder{
		UserId:        userId,
		PlanId:        plan.Id,
		Money:         plan.PriceAmount,
		TradeNo:       tradeNo,
		PaymentMethod: "wallet",
		CreateTime:    time.Now().Unix(),
		Status:        common.TopUpStatusSuccess,
		CompleteTime:  time.Now().Unix(),
	}
	if err := order.Insert(); err != nil {
		common.ApiErrorMsg(c, "创建订单失败")
		return
	}

	if err := model.DecreaseUserQuota(userId, requiredQuota, false); err != nil {
		order.Status = common.TopUpStatusFailed
		order.Update()
		common.ApiErrorMsg(c, "扣款失败")
		return
	}

	sub, err := model.CreateUserSubscriptionFromPlanTx(model.DB, userId, plan, "wallet")
	if err != nil {
		model.IncreaseUserQuota(userId, requiredQuota, false)
		order.Status = common.TopUpStatusFailed
		order.Update()
		common.ApiErrorMsg(c, "创建订阅失败: "+err.Error())
		return
	}

	if plan.PlanType == "tokens" {
		_, err = model.CreateSubscriptionToken(model.DB, userId, sub.Id, sub.EndTime)
		if err != nil {
			common.SysLog("failed to create subscription token: " + err.Error())
		}
	}

	upgradeGroup := ""
	if plan.UpgradeGroup != "" {
		upgradeGroup = plan.UpgradeGroup
		_ = model.UpdateUserGroupCache(userId, upgradeGroup)
	}
	usdToCnyRate := operation_setting.USDExchangeRate
	cnyAmount := plan.PriceAmount * usdToCnyRate
	msg := fmt.Sprintf("订阅购买成功，套餐: %s，支付金额: %.2f美元（约%.2f人民币），支付方式: 钱包余额", plan.Title, plan.PriceAmount, cnyAmount)
	model.RecordLog(userId, model.LogTypeTopup, msg) //  todo  LogTypeTopup  这个有问题，值得商榷！！！！

	common.ApiSuccess(c, gin.H{
		"message":    "购买成功",
		"trade_no":   tradeNo,
		"plan_title": plan.Title,
		"money":      plan.PriceAmount,
	})
}
