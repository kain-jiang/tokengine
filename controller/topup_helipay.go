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
	Amount        float64 `json:"amount"`
	PaymentMethod string  `json:"payment_method"`
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
	if ds, ok := operation_setting.GetPaymentSetting().AmountDiscount[strconv.FormatFloat(req.Amount, 'f', -1, 64)]; ok && ds > 0 {
		discount = ds
	}

	payMoney := req.Amount * discount

	if payMoney < 0.01 {
		c.JSON(200, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	// 生成订单号
	tradeNo := fmt.Sprintf("%s%d", common.GetRandomString(6), time.Now().Unix())
	tradeNo = fmt.Sprintf("USR%dHL%s", id, tradeNo)

	// 获取回调地址
	returnUrl, _ := url.Parse(system_setting.ServerAddress + "/console/topup")
	notifyUrl, _ := url.Parse(system_setting.ServerAddress + operation_setting.GetHelipayNotifyPath())

	// 构建预下单请求
	preOrderRequest := service.PreOrderRequest{
		OrderId:           tradeNo,
		OrderNo:           tradeNo + "NO",
		OrderAmount:       strconv.FormatFloat(payMoney, 'f', 2, 64),
		GoodsName:         fmt.Sprintf("TUC%v", req.Amount),
		Desc:              "充值",
		ServerCallbackUrl: notifyUrl.String(),
		CallbackUrl:       returnUrl.String(),
		IndustryType:      "E_BUSINESS",
	}

	// 调用合利宝预下单接口
	response, err := service.PreOrder(preOrderRequest)
	if err != nil {
		log.Printf("合利宝预下单失败: %v", err)
		c.JSON(200, gin.H{"message": "error", "data": "拉起支付失败: " + err.Error()})
		return
	}

	amount := req.Amount
	var quotaAmount int64
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dAmount := decimal.NewFromFloat(amount)
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		quotaAmount = dAmount.Div(dQuotaPerUnit).IntPart()
	} else {
		quotaAmount = int64(amount)
	}

	// 创建充值订单
	topUp := &model.TopUp{
		UserId:        id,
		Amount:        quotaAmount,
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
		"message": "success",
		"data":    gin.H{"pay_link": response.WapUrl, "order_id": tradeNo},
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

	// 1. 解密敏感数据
	encryptionKey, ok := notifyData["encryptionKey"].(string)
	if !ok || encryptionKey == "" {
		log.Println("合利宝回调缺少encryptionKey")
		c.Writer.Write([]byte("fail"))
		return
	}

	// SM2 解密 SM4 密钥
	sm4Key, err := service.SM2Decrypt(encryptionKey)
	if err != nil {
		log.Printf("合利宝回调 SM2 解密 SM4 密钥失败: %v", err)
		c.Writer.Write([]byte("fail"))
		return
	}

	// 获取加密的 data 字段
	data, ok := notifyData["data"]
	if !ok {
		log.Println("合利宝回调缺少data字段")
		c.Writer.Write([]byte("fail"))
		return
	}

	// 合利宝回调的 data 可能是 map[string]interface{} 且包含加密的 "data" 字符串
	var encryptedDataStr string
	if dataMap, ok := data.(map[string]interface{}); ok {
		if d, ok := dataMap["data"].(string); ok {
			encryptedDataStr = d
		}
	} else if dStr, ok := data.(string); ok {
		encryptedDataStr = dStr
	}

	if encryptedDataStr == "" {
		log.Println("合利宝回调 data 字段为空或格式不正确")
		c.Writer.Write([]byte("fail"))
		return
	}

	// SM4 解密敏感数据
	decryptedBytes, err := service.SM4Decrypt(encryptedDataStr, sm4Key)
	if err != nil {
		log.Printf("合利宝回调 SM4 解密敏感数据失败: %v", err)
		c.Writer.Write([]byte("fail"))
		return
	}

	var dataMap map[string]interface{}
	if err := common.Unmarshal(decryptedBytes, &dataMap); err != nil {
		log.Printf("合利宝回调解密数据解析 JSON 失败: %v", err)
		c.Writer.Write([]byte("fail"))
		return
	}

	orderId, ok := dataMap["orderId"].(string)
	if !ok || orderId == "" {
		log.Println("合利宝回调解密后订单号为空")
		c.Writer.Write([]byte("fail"))
		return
	}
	//  todo
	/*
		// 验证签名
		sign, _ := notifyData["sign"].(string)

		// 1. 提取所有参数并排除指定字段
		params := make(map[string]string)
		for k, v := range notifyData {
			if k == "encryptionKey" || k == "signatureType" || k == "sign" {
				continue
			}
			// 处理嵌套的 data 字段，将其展开到顶层
			if k == "data" {
				continue
			}
			params[k] = fmt.Sprintf("%v", v)
		}

		// 将解密后的 dataMap 字段也加入验签参数（如果合利宝要求解密后验签，但通常是加密串验签）
		// 根据 Java Demo，验签通常使用原始请求参数。
		// 这里我们已经有了解密后的 dataMap，为了后续业务逻辑，我们将其保留。

		// 2. 字典序排序
		keys := make([]string, 0, len(params))
		for k := range params {
			keys = append(keys, k)
		}
		sort.Strings(keys)

		// 3. 拼接字符串
		var sb strings.Builder
		for i, k := range keys {
			if i > 0 {
				sb.WriteString("&")
			}
			sb.WriteString(fmt.Sprintf("%s=%s", k, params[k]))
		}
		signStr := sb.String()


			if !service.VerifySign(signStr, sign) {
				log.Printf("合利宝回调签名验证失败, 待验签串: %s", signStr)
				c.Writer.Write([]byte("fail"))
				return
			}
	*/
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

			quotaToAdd := int(decimal.NewFromFloat(topUp.Money).Mul(decimal.NewFromFloat(common.QuotaPerUnit)).IntPart())

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
	orderId := c.Query("order_id")
	if orderId == "" {
		c.JSON(200, gin.H{"message": "error", "data": "订单号不能为空"})
		return
	}

	response, err := service.QueryOrder(orderId, orderId+"NO")
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": "查询失败: " + err.Error()})
		return
	}

	status := convertHelipayStatus(response.TradeState)

	c.JSON(200, gin.H{
		"message": "success",
		"data": map[string]interface{}{
			"status":       status,
			"order_id":     orderId,
			"order_amount": response.OrderAmount,
		},
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
