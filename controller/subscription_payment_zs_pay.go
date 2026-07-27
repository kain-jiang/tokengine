package controller

import (
	"fmt"
	"log"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

type SubscriptionZSPayRequest struct {
	PlanId        int    `json:"plan_id"`
	PaymentMethod string `json:"payment_method"`
}

func SubscriptionRequestZSPay(c *gin.Context) {
	var req SubscriptionZSPayRequest
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

	zsService := service.GetZSPayService()
	if zsService == nil {
		common.ApiErrorMsg(c, "招商银行聚合支付未启用")
		return
	}

	notifyURL := zsService.GetNotifyURL()
	tradeNo := fmt.Sprintf("%s%d", common.GetRandomString(6), time.Now().Unix())
	tradeNo = fmt.Sprintf("SUBUSR%dZS%s", userId, tradeNo)

	// 使用套餐价格作为支付金额
	payMoney := plan.PriceAmount

	qrResult, err := zsService.QRCodeApply(tradeNo, payMoney, notifyURL)
	if err != nil {
		log.Printf("订阅招商银行聚合支付申请二维码失败: %v", err)
		common.ApiErrorMsg(c, "申请支付二维码失败")
		return
	}

	order := &model.SubscriptionOrder{
		UserId:        userId,
		PlanId:        plan.Id,
		Money:         payMoney,
		TradeNo:       tradeNo,
		PaymentMethod: req.PaymentMethod,
		CreateTime:    time.Now().Unix(),
		Status:        common.TopUpStatusPending,
	}
	if err := order.Insert(); err != nil {
		common.ApiErrorMsg(c, "创建订单失败")
		return
	}

	// 计算过期时间
	payValidTime, _ := strconv.Atoi(operation_setting.GetZSPayPayValidTime())
	expireAt := time.Now().Add(time.Duration(payValidTime) * time.Second).Format(time.RFC3339)

	c.JSON(200, gin.H{
		"message":      "success",
		"qr_code_url":  qrResult.QRCodeURL,
		"cmb_order_id": qrResult.CmbOrderID,
		"trade_no":     tradeNo,
		"amount":       payMoney,
		"expire_at":    expireAt,
	})
}

func SubscriptionZSPayNotify(c *gin.Context) {
	var notifyData service.ZSPaymentNotifyData

	if c.Request.Method == "POST" {
		if err := c.Request.ParseForm(); err != nil {
			log.Println("订阅招商银行聚合支付回调POST解析失败:", err)
			c.Writer.Write([]byte("fail"))
			return
		}

		for key, values := range c.Request.PostForm {
			if len(values) > 0 {
				switch key {
				case "orderId":
					notifyData.OrderID = values[0]
				case "cmbOrderId":
					notifyData.CmbOrderID = values[0]
				case "txnAmt":
					notifyData.TxnAmt = values[0]
				case "payType":
					notifyData.PayType = values[0]
				}
			}
		}
	} else {
		// GET 请求处理
		query := c.Request.URL.Query()
		notifyData.OrderID = query.Get("orderId")
		notifyData.CmbOrderID = query.Get("cmbOrderId")
		notifyData.TxnAmt = query.Get("txnAmt")
		notifyData.PayType = query.Get("payType")
	}

	// 处理支付成功 - 使用订单号完成订阅
	if notifyData.OrderID != "" {
		LockOrder(notifyData.OrderID)
		defer UnlockOrder(notifyData.OrderID)

		if err := model.CompleteSubscriptionOrder(notifyData.OrderID, common.GetJsonString(notifyData)); err != nil {
			logger.LogError(c, fmt.Sprintf("订阅订单完成失败: %v", err))
			c.Writer.Write([]byte("fail"))
			return
		}
	}

	c.Writer.Write([]byte("success"))
}
