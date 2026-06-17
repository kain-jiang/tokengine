package controller

import (
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

type ZSPayRequest struct {
	Amount        float64 `json:"amount"`
	PaymentMethod string  `json:"payment_method"`
}

func GetZSPayInfo(c *gin.Context) {
	enableZS := service.IsZSPayEnabled()

	data := gin.H{
		"enable_zs_pay_topup": enableZS,
	}
	common.ApiSuccess(c, data)
}

func RequestZSPay(c *gin.Context) {
	var req ZSPayRequest
	err := c.ShouldBindJSON(&req)
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "参数错误"})
		return
	}

	id := c.GetInt("id")

	// 招商银行支付直接使用用户输入的金额，但需要应用折扣
	originalAmount := float64(req.Amount)

	// 应用充值金额折扣
	discount := 1.0
	if ds, ok := operation_setting.GetPaymentSetting().AmountDiscount[strconv.FormatFloat(float64(req.Amount), 'f', -1, 64)]; ok && ds > 0 {
		discount = ds
	}

	payMoney := originalAmount * discount

	if payMoney < 0.01 {
		c.JSON(200, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	zsService := service.GetZSPayService()
	if zsService == nil {
		c.JSON(200, gin.H{"message": "error", "data": "招商银行聚合支付未启用"})
		return
	}

	notifyURL := zsService.GetNotifyURL()
	tradeNo := fmt.Sprintf("%s%d", common.GetRandomString(6), time.Now().Unix())
	tradeNo = fmt.Sprintf("USR%dZS%s", id, tradeNo)

	qrResult, err := zsService.QRCodeApply(tradeNo, payMoney, notifyURL)
	if err != nil {
		log.Printf("招商银行聚合支付申请二维码失败: %v", err)
		c.JSON(200, gin.H{"message": "error", "data": "申请支付二维码失败"})
		return
	}

	amount := req.Amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dAmount := decimal.NewFromFloat(amount)
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		amount = dAmount.Div(dQuotaPerUnit).InexactFloat64()
	}

	topUp := &model.TopUp{
		UserId:        id,
		Amount:        int64(amount),
		Money:         payMoney,
		TradeNo:       tradeNo,
		PaymentMethod: req.PaymentMethod,
		CreateTime:    time.Now().Unix(),
		Status:        "pending",
	}
	err = topUp.Insert()
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "创建订单失败"})
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

// 只有成功支付的交易才会有支付结果通知
func ZSPayNotify(c *gin.Context) {
	var notifyData service.ZSPaymentNotifyData

	// 招行回调格式：biz_content=<URL编码的JSON>&sign=xxx&encoding=UTF-8&version=0.0.1&signMethod=02
	// 需要先解析 form 获取 biz_content，再解析 biz_content 中的 JSON
	if err := c.Request.ParseForm(); err != nil {
		log.Printf("[ZSPay-Notify] ParseForm失败: %v", err)
		c.Writer.Write([]byte("fail"))
		return
	}

	bizContent := c.Request.FormValue("biz_content")
	if bizContent == "" {
		log.Println("[ZSPay-Notify] biz_content为空")
		c.Writer.Write([]byte("fail"))
		return
	}

	log.Printf("[ZSPay-Notify] biz_content: %s", bizContent)

	// 解析 biz_content 中的 JSON 数据
	if err := json.Unmarshal([]byte(bizContent), &notifyData); err != nil {
		log.Printf("[ZSPay-Notify] 解析biz_content失败: %v", err)
		c.Writer.Write([]byte("fail"))
		return
	}

	// 获取外层字段（sign, version, encoding, signMethod）
	notifyData.Sign = c.Request.FormValue("sign")
	notifyData.Version = c.Request.FormValue("version")
	notifyData.Encoding = c.Request.FormValue("encoding")
	notifyData.SignMethod = c.Request.FormValue("signMethod")

	log.Printf("[ZSPay-Notify] 收到回调: orderId=%s, cmbOrderId=%s, txnAmt=%s, payType=%s",
		notifyData.OrderID, notifyData.CmbOrderID, notifyData.TxnAmt, notifyData.PayType)

	if notifyData.OrderID == "" {
		log.Println("招商银行聚合支付回调订单号为空")
		c.Writer.Write([]byte("fail"))
		return
	}

	zsService := service.GetZSPayService()
	if zsService == nil {
		log.Println("招商银行聚合支付服务未初始化")
		c.Writer.Write([]byte("fail"))
		return
	}

	orderNo := notifyData.OrderID

	LockOrder(orderNo)
	defer UnlockOrder(orderNo)

	topUp := model.GetTopUpByTradeNo(orderNo)
	if topUp == nil {
		log.Printf("招商银行聚合支付回调未找到订单: %s", orderNo)
		c.Writer.Write([]byte("fail"))
		return
	}

	if topUp.Status == "pending" {
		topUp.Status = "success"
		if err := topUp.Update(); err != nil {
			log.Printf("招商银行聚合支付回调更新订单失败: %v", topUp)
			c.Writer.Write([]byte("fail"))
			return
		}

		dAmount := decimal.NewFromInt(int64(topUp.Amount))
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		quotaToAdd := int(dAmount.Mul(dQuotaPerUnit).IntPart())

		if err := model.IncreaseUserQuota(topUp.UserId, quotaToAdd, true); err != nil {
			log.Printf("招商银行聚合支付回调更新用户失败: %v", topUp)
			c.Writer.Write([]byte("fail"))
			return
		}

		log.Printf("招商银行聚合支付回调成功: %s, 用户: %d, 充值: %d", orderNo, topUp.UserId, quotaToAdd)
		model.RecordLog(topUp.UserId, model.LogTypeTopup, fmt.Sprintf("使用招商银行聚合支付成功，充值金额: %v", quotaToAdd))
	}

	c.Writer.Write([]byte("success"))
}

func QueryZSPayStatus(c *gin.Context) {
	tradeNo := c.Query("trade_no")
	if tradeNo == "" {
		c.JSON(200, gin.H{"message": "error", "data": "订单号不能为空"})
		return
	}

	zsService := service.GetZSPayService()
	if zsService == nil {
		c.JSON(200, gin.H{"message": "error", "data": "招商银行聚合支付未启用"})
		return
	}

	resp, err := zsService.OrderQuery(tradeNo)
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": err.Error()})
		return
	}
	// 转换状态：C-已关闭 D-已撤销 P-进行中 F-失败 S-成功 R-转入退款
	status := convertTradeState(resp.TradeState)
	tradeState := resp.TradeState

	// 如果查询到订单已支付且当前状态为待支付，则自动更新数据库
	if tradeState == "S" {
		LockOrder(tradeNo)
		defer UnlockOrder(tradeNo)

		topUp := model.GetTopUpByTradeNo(tradeNo)
		if topUp != nil && topUp.Status == "pending" {
			topUp.Status = "success"
			if err := topUp.Update(); err != nil {
				log.Printf("招商银行聚合支付查询更新订单失败: %s, 错误: %v", tradeNo, err)
			} else {
				dAmount := decimal.NewFromInt(topUp.Amount)
				dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
				quotaToAdd := int(dAmount.Mul(dQuotaPerUnit).IntPart())

				if err := model.IncreaseUserQuota(topUp.UserId, quotaToAdd, true); err != nil {
					log.Printf("招商银行聚合支付查询更新用户额度失败: %s, 错误: %v", tradeNo, err)
				} else {
					log.Printf("招商银行聚合支付查询自动更新订单成功: %s, 用户: %d, 充值: %d", tradeNo, topUp.UserId, quotaToAdd)
					model.RecordLog(topUp.UserId, model.LogTypeTopup, fmt.Sprintf("查询支付状态发现已支付，充值金额: %d tokens", quotaToAdd))
				}
			}
		}
	}

	c.JSON(200, gin.H{
		"message":    "success",
		"status":     status,
		"tradeState": tradeState,
	})
}

func convertTradeState(state string) string {
	switch state {
	case "S":
		return "PAID"
	case "F":
		return "FAILED"
	case "C", "D":
		return "CLOSED"
	case "R":
		return "REFUNDED"
	default:
		return "PENDING"
	}
}

func FormatZSMoney(fen string) string {
	f, _ := strconv.ParseFloat(fen, 64)
	return fmt.Sprintf("%.2f", f/100)
}

func CancelZSPayOrder(c *gin.Context) {
	tradeNo := c.Query("trade_no")
	if tradeNo == "" {
		c.JSON(200, gin.H{"message": "error", "data": "订单号不能为空"})
		return
	}

	userId := c.GetInt("id")

	err := model.CancelTopUpByTradeNo(tradeNo, userId)
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": err.Error()})
		return
	}

	c.JSON(200, gin.H{
		"message": "success",
		"data":    "订单已取消",
	})
}
