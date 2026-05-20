package controller

import (
	"fmt"
	"log"
	"net/url"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

// HelipayRequest 合利宝支付请求结构体
type HelipayRequest struct {
	Amount        int64  `json:"amount"`
	PaymentMethod string `json:"payment_method"`
}

// GetHelipayInfo 获取合利宝支付配置信息
func GetHelipayInfo(c *gin.Context) {
	enableHelipay := operation_setting.IsHelipayEnabled()

	data := gin.H{
		"enable_helipay_topup": enableHelipay,
	}
	common.ApiSuccess(c, data)
}

// RequestHelipay 发起合利宝支付请求
func RequestHelipay(c *gin.Context) {
	var req HelipayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "参数错误"})
		return
	}

	id := c.GetInt("id")

	// 应用充值金额折扣
	discount := 1.0
	if ds, ok := operation_setting.GetPaymentSetting().AmountDiscount[strconv.FormatFloat(float64(req.Amount), 'f', -1, 64)]; ok && ds > 0 {
		discount = ds
	}

	payMoney := float64(req.Amount) * discount

	if payMoney < 0.01 {
		c.JSON(200, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	// 生成订单号
	tradeNo := fmt.Sprintf("%s%d", common.GetRandomString(6), time.Now().Unix())
	tradeNo = fmt.Sprintf("USR%dHL%s", id, tradeNo)

	// 获取回调地址
	callBackAddress := service.GetCallbackAddress()
	returnUrl, _ := url.Parse(system_setting.ServerAddress + "/console/topup")
	notifyUrl, _ := url.Parse(callBackAddress + operation_setting.GetHelipayNotifyPath())

	// 构建预下单请求
	preOrderRequest := service.PreOrderRequest{
		OrderId:           tradeNo,
		OrderNo:           tradeNo + "NO",
		OrderAmount:       strconv.FormatFloat(payMoney, 'f', 2, 64),
		GoodsName:         fmt.Sprintf("TUC%d", req.Amount),
		Desc:              "充值",
		ServerCallbackUrl: notifyUrl.String(),
		CallbackUrl:       returnUrl.String(),
		IndustryType:      "DEFAULT",
	}

	// 调用合利宝预下单接口
	response, err := service.PreOrder(preOrderRequest)
	if err != nil {
		log.Printf("合利宝预下单失败: %v", err)
		c.JSON(200, gin.H{"message": "error", "data": "拉起支付失败: " + err.Error()})
		return
	}

	amount := req.Amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dAmount := decimal.NewFromInt(int64(amount))
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		amount = dAmount.Div(dQuotaPerUnit).IntPart()
	}

	// 创建充值订单
	topUp := &model.TopUp{
		UserId:        id,
		Amount:        amount,
		Money:         payMoney,
		TradeNo:       tradeNo,
		PaymentMethod: "helipay",
		CreateTime:    time.Now().Unix(),
		Status:        "pending",
	}
	err = topUp.Insert()
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	// 返回支付链接
	c.JSON(200, gin.H{
		"message":  "success",
		"trade_no": tradeNo,
		"amount":   amount,
		"data":     gin.H{"pay_link": response.WapUrl},
	})
}

// HelipayNotify 合利宝支付回调处理
func HelipayNotify(c *gin.Context) {
	var notifyData map[string]interface{}
	if err := c.ShouldBindJSON(&notifyData); err != nil {
		log.Println("合利宝回调参数解析失败: ", err)
		c.Writer.Write([]byte("fail"))
		return
	}

	log.Printf("合利宝回调数据: %+v", notifyData)

	// 获取订单号
	data, ok := notifyData["data"]
	if !ok {
		log.Println("合利宝回调缺少data字段")
		c.Writer.Write([]byte("fail"))
		return
	}

	dataMap, ok := data.(map[string]interface{})
	if !ok {
		log.Println("合利宝回调data字段格式错误")
		c.Writer.Write([]byte("fail"))
		return
	}

	orderId, ok := dataMap["orderId"].(string)
	if !ok || orderId == "" {
		log.Println("合利宝回调订单号为空")
		c.Writer.Write([]byte("fail"))
		return
	}

	// 验证签名
	sign, _ := notifyData["sign"].(string)
	dataJson, err := common.Marshal(data)
	if err != nil {
		log.Println("合利宝回调数据序列化失败: ", err)
		c.Writer.Write([]byte("fail"))
		return
	}
	if !service.VerifySign(string(dataJson), sign) {
		log.Println("合利宝回调签名验证失败")
		c.Writer.Write([]byte("fail"))
		return
	}

	tradeStatus, _ := dataMap["tradeStatus"].(string)

	LockOrder(orderId)
	defer UnlockOrder(orderId)

	topUp := model.GetTopUpByTradeNo(orderId)
	if topUp == nil {
		log.Printf("合利宝回调未找到订单: %s", orderId)
		c.Writer.Write([]byte("fail"))
		return
	}

	if topUp.Status == "pending" {
		if tradeStatus == "SUCCESS" {
			topUp.Status = "success"
			if err := topUp.Update(); err != nil {
				log.Printf("合利宝回调更新订单失败: %v", err)
				c.Writer.Write([]byte("fail"))
				return
			}

			dAmount := decimal.NewFromInt(int64(topUp.Amount))
			dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
			quotaToAdd := int(dAmount.Mul(dQuotaPerUnit).IntPart())

			if err := model.IncreaseUserQuota(topUp.UserId, quotaToAdd, true); err != nil {
				log.Printf("合利宝回调更新用户额度失败: %v", err)
				c.Writer.Write([]byte("fail"))
				return
			}

			log.Printf("合利宝支付成功: %s, 用户: %d, 充值: %d", orderId, topUp.UserId, quotaToAdd)
			model.RecordLog(topUp.UserId, model.LogTypeTopup, fmt.Sprintf("使用合利宝支付成功，充值金额: %v", quotaToAdd))
		} else if tradeStatus == "FAILED" {
			topUp.Status = "failed"
			if err := topUp.Update(); err != nil {
				log.Printf("合利宝回调更新订单失败: %v", err)
			}
		}
	}

	c.Writer.Write([]byte("success"))
}

// QueryHelipayStatus 查询合利宝支付状态
func QueryHelipayStatus(c *gin.Context) {
	tradeNo := c.Query("trade_no")
	if tradeNo == "" {
		c.JSON(200, gin.H{"message": "error", "data": "订单号不能为空"})
		return
	}

	response, err := service.QueryOrder(tradeNo, tradeNo+"NO")
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "查询失败: " + err.Error()})
		return
	}

	status := convertHelipayStatus(response.TradeStatus)

	c.JSON(200, gin.H{
		"message":      "success",
		"status":       status,
		"trade_no":     tradeNo,
		"order_amount": response.OrderAmount,
	})
}

// CancelHelipayOrder 取消合利宝订单
func CancelHelipayOrder(c *gin.Context) {
	tradeNo := c.Query("trade_no")
	if tradeNo == "" {
		c.JSON(200, gin.H{"message": "error", "data": "订单号不能为空"})
		return
	}

	userId := c.GetInt("id")

	err := model.CancelTopUpByTradeNo(tradeNo, userId)
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "取消订单失败: " + err.Error()})
		return
	}

	// 尝试调用合利宝取消接口
	_, err = service.CancelOrder(tradeNo, tradeNo+"NO")
	if err != nil {
		log.Println("合利宝取消订单失败: ", err)
	}

	c.JSON(200, gin.H{
		"message": "success",
		"data":    "订单已取消",
	})
}

// convertHelipayStatus 转换合利宝状态码
func convertHelipayStatus(status string) string {
	switch status {
	case "SUCCESS":
		return "PAID"
	case "FAILED":
		return "FAILED"
	case "CANCELLED":
		return "CANCELLED"
	case "REFUNDED":
		return "REFUNDED"
	default:
		return "PENDING"
	}
}
