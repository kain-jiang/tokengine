package controller

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

type SubscriptionHelipayRequest struct {
	PlanId        int    `json:"plan_id"`
	PaymentMethod string `json:"payment_method"`
}

func SubscriptionRequestHelipay(c *gin.Context) {
	var req SubscriptionHelipayRequest
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

	// 生成订单号
	tradeNo := fmt.Sprintf("%s%d", common.GetRandomString(6), time.Now().Unix())
	tradeNo = fmt.Sprintf("SUBUSR%dHL%s", userId, tradeNo)

	// 使用套餐价格作为支付金额
	payMoney := plan.PriceAmount

	// 获取回调地址
	returnUrl, _ := url.Parse(system_setting.ServerAddress + "/console/topup")
	notifyUrl, _ := url.Parse(system_setting.ServerAddress + operation_setting.GetHelipayNotifyPath())

	// 构建预下单请求
	preOrderRequest := service.PreOrderRequest{
		OrderId:           tradeNo,
		OrderNo:           tradeNo + "NO",
		OrderAmount:       strconv.FormatFloat(payMoney, 'f', 2, 64),
		GoodsName:         fmt.Sprintf("SUB:%s", plan.Title),
		Desc:              "订阅套餐",
		ServerCallbackUrl: notifyUrl.String(),
		CallbackUrl:       returnUrl.String(),
		IndustryType:      "E_BUSINESS",
	}

	// 调用合利宝预下单接口
	response, err := service.PreOrder(preOrderRequest)
	if err != nil {
		log.Printf("订阅合利宝预下单失败: %v", err)
		common.ApiErrorMsg(c, "拉起支付失败")
		return
	}

	// 创建订阅订单
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

	// 返回支付链接
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data":    gin.H{"pay_link": response.WapUrl, "order_id": tradeNo},
	})
}

func SubscriptionHelipayNotify(c *gin.Context) {
	// 先读取原始 body 用于调试
	bodyBytes, _ := io.ReadAll(c.Request.Body)
	log.Printf("订阅合利宝回调原始body: %s", string(bodyBytes))

	// 解析 form-urlencoded 数据
	formStr := string(bodyBytes)
	parsedForm, err := url.ParseQuery(formStr)
	if err != nil {
		log.Printf("订阅合利宝回调解析失败: %v", err)
		c.Writer.Write([]byte("fail"))
		return
	}

	// 将 form 数据转换为 map
	notifyData := make(map[string]interface{})
	for key, values := range parsedForm {
		if len(values) > 0 {
			notifyData[key] = values[0]
		}
	}

	log.Printf("订阅合利宝回调数据: %+v", notifyData)

	orderId, ok := notifyData["orderId"].(string)
	if !ok || orderId == "" {
		log.Println("订阅合利宝回调订单号为空")
		c.Writer.Write([]byte("fail"))
		return
	}

	tradeState, _ := notifyData["tradeState"].(string)
	log.Printf("订阅合利宝回调解析完成，订单号: %s, 交易状态: %s", orderId, tradeState)

	LockOrder(orderId)
	defer UnlockOrder(orderId)

	if tradeState == "SUCCESS" {
		if err := model.CompleteSubscriptionOrder(orderId, common.GetJsonString(notifyData)); err != nil {
			log.Printf("订阅订单完成失败: %v", err)
			c.Writer.Write([]byte("fail"))
			return
		}
	}

	c.Writer.Write([]byte("success"))
}

func SubscriptionHelipayReturn(c *gin.Context) {
	// 先读取原始 body 用于调试
	bodyBytes, _ := io.ReadAll(c.Request.Body)

	// 解析 form-urlencoded 数据
	formStr := string(bodyBytes)
	parsedForm, err := url.ParseQuery(formStr)
	if err != nil {
		c.Redirect(http.StatusFound, system_setting.ServerAddress+"/console/topup?pay=fail")
		return
	}

	// 将 form 数据转换为 map
	notifyData := make(map[string]interface{})
	for key, values := range parsedForm {
		if len(values) > 0 {
			notifyData[key] = values[0]
		}
	}

	if len(notifyData) == 0 {
		// 尝试从 query string 获取
		query := c.Request.URL.Query()
		for key := range query {
			notifyData[key] = query.Get(key)
		}
	}

	if len(notifyData) == 0 {
		c.Redirect(http.StatusFound, system_setting.ServerAddress+"/console/topup?pay=fail")
		return
	}

	orderId, ok := notifyData["orderId"].(string)
	if !ok || orderId == "" {
		c.Redirect(http.StatusFound, system_setting.ServerAddress+"/console/topup?pay=fail")
		return
	}

	tradeState, _ := notifyData["tradeState"].(string)
	if tradeState == "SUCCESS" {
		LockOrder(orderId)
		defer UnlockOrder(orderId)
		if err := model.CompleteSubscriptionOrder(orderId, common.GetJsonString(notifyData)); err != nil {
			c.Redirect(http.StatusFound, system_setting.ServerAddress+"/console/topup?pay=fail")
			return
		}
		c.Redirect(http.StatusFound, system_setting.ServerAddress+"/console/topup?pay=success")
		return
	}

	c.Redirect(http.StatusFound, system_setting.ServerAddress+"/console/topup?pay=fail")
}
