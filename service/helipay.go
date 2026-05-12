package service

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// HelipayRequest 合利宝请求结构体
type HelipayRequest struct {
	CustomerNumber string                 `json:"customerNumber"`
	RequestId      string                 `json:"requestId"`
	RequestTime    string                 `json:"requestTime"`
	Sign           string                 `json:"sign"`
	Data           map[string]interface{} `json:"data"`
}

// HelipayResponse 合利宝响应结构体
type HelipayResponse struct {
	Code    string                 `json:"code"`
	Message string                 `json:"message"`
	Sign    string                 `json:"sign"`
	Data    map[string]interface{} `json:"data"`
}

// PreOrderRequest 预下单请求数据
type PreOrderRequest struct {
	OrderId           string `json:"orderId"`
	OrderNo           string `json:"orderNo"`
	OrderAmount       string `json:"orderAmount"`
	GoodsName         string `json:"goodsName"`
	Desc              string `json:"desc"`
	ServerCallbackUrl string `json:"serverCallbackUrl"`
	CallbackUrl       string `json:"callbackUrl"`
	IndustryType      string `json:"industryType"`
	IndustryExt       string `json:"industryExt,omitempty"`
	CardType          string `json:"cardType,omitempty"`
	Period            string `json:"period,omitempty"`
	PeriodUnit        string `json:"periodUnit,omitempty"`
	RuleJson          string `json:"ruleJson,omitempty"`
	UserId            string `json:"userId,omitempty"`
}

// PreOrderResponse 预下单响应数据
type PreOrderResponse struct {
	WapUrl      string `json:"wapUrl"`
	OrderId     string `json:"orderId"`
	OrderNo     string `json:"orderNo"`
	OrderAmount string `json:"orderAmount"`
	TradeTime   string `json:"tradeTime"`
}

// QueryOrderRequest 订单查询请求
type QueryOrderRequest struct {
	OrderId string `json:"orderId"`
	OrderNo string `json:"orderNo"`
}

// QueryOrderResponse 订单查询响应
type QueryOrderResponse struct {
	OrderId     string `json:"orderId"`
	OrderNo     string `json:"orderNo"`
	OrderAmount string `json:"orderAmount"`
	TradeStatus string `json:"tradeStatus"`
	TradeTime   string `json:"tradeTime"`
	PayTime     string `json:"payTime"`
	ErrorCode   string `json:"errorCode"`
	ErrorMsg    string `json:"errorMsg"`
}

// CancelOrderRequest 取消订单请求
type CancelOrderRequest struct {
	OrderId string `json:"orderId"`
	OrderNo string `json:"orderNo"`
}

// CancelOrderResponse 取消订单响应
type CancelOrderResponse struct {
	OrderId   string `json:"orderId"`
	OrderNo   string `json:"orderNo"`
	TradeTime string `json:"tradeTime"`
}

// RefundRequest 退款请求
type RefundRequest struct {
	OrderId       string `json:"orderId"`
	OrderNo       string `json:"orderNo"`
	RefundAmount  string `json:"refundAmount"`
	RefundDesc    string `json:"refundDesc"`
}

// RefundResponse 退款响应
type RefundResponse struct {
	OrderId     string `json:"orderId"`
	OrderNo     string `json:"orderNo"`
	RefundNo    string `json:"refundNo"`
	RefundAmount string `json:"refundAmount"`
	TradeTime   string `json:"tradeTime"`
}

// GenerateRequestId 生成请求ID
func GenerateRequestId() string {
	return fmt.Sprintf("%d%d", time.Now().UnixNano(), GetRandomInt(1000, 9999))
}

// GenerateOrderId 生成订单ID
func GenerateOrderId() string {
	return fmt.Sprintf("ORD%d%d", time.Now().Unix(), GetRandomInt(1000, 9999))
}

// GetCurrentTime 获取当前时间字符串（yyyy-MM-dd HH:mm:ss）
func GetCurrentTime() string {
	return time.Now().Format("2006-01-02 15:04:05")
}

// GenerateSign 生成签名（SM3WITHSM2）
func GenerateSign(data string) (string, error) {
	// TODO: 实现SM3WITHSM2签名
	// 需要使用商户SM2私钥进行签名
	// 由于Go标准库不支持SM2，可能需要引入第三方库
	// 这里暂时返回空字符串，实际使用时需要实现
	privateKey := operation_setting.GetHelipaySM2PrivateKey()
	if privateKey == "" {
		return "", fmt.Errorf("SM2私钥未配置")
	}
	// 实现签名逻辑...
	return "", nil
}

// VerifySign 验证签名
func VerifySign(data, sign string) bool {
	// TODO: 实现SM3WITHSM2验签
	publicKey := operation_setting.GetHelipaySM2PublicKey()
	if publicKey == "" {
		return false
	}
	// 实现验签逻辑...
	return true
}

// AssemblyRequestMap 组装请求参数
func AssemblyRequestMap(data interface{}) (map[string]interface{}, error) {
	dataBytes, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}
	var dataMap map[string]interface{}
	err = json.Unmarshal(dataBytes, &dataMap)
	if err != nil {
		return nil, err
	}
	return dataMap, nil
}

// PreOrder 预下单接口
func PreOrder(request PreOrderRequest) (*PreOrderResponse, error) {
	setting := operation_setting.GetHelipaySetting()
	if setting.CustomerNumber == "" {
		return nil, fmt.Errorf("商户号未配置")
	}

	request.OrderId = GenerateOrderId()
	request.OrderNo = request.OrderId + "NO"

	dataMap, err := AssemblyRequestMap(request)
	if err != nil {
		return nil, err
	}

	// 生成签名
	dataStr, err := json.Marshal(dataMap)
	if err != nil {
		return nil, err
	}
	sign, err := GenerateSign(string(dataStr))
	if err != nil {
		return nil, err
	}

	helipayRequest := HelipayRequest{
		CustomerNumber: setting.CustomerNumber,
		RequestId:      GenerateRequestId(),
		RequestTime:    GetCurrentTime(),
		Sign:           sign,
		Data:           dataMap,
	}

	url := setting.TrxURL + "/universalcashier/unifiedorder"
	response, err := httpRequest(url, helipayRequest)
	if err != nil {
		return nil, err
	}

	if response.Code != "0000" {
		return nil, fmt.Errorf("预下单失败: %s", response.Message)
	}

	// 验证签名
	dataJson, err := json.Marshal(response.Data)
	if err != nil {
		return nil, err
	}
	if !VerifySign(string(dataJson), response.Sign) {
		return nil, fmt.Errorf("响应签名验证失败")
	}

	var result PreOrderResponse
	err = mapToStruct(response.Data, &result)
	if err != nil {
		return nil, err
	}

	return &result, nil
}

// QueryOrder 查询订单
func QueryOrder(orderId, orderNo string) (*QueryOrderResponse, error) {
	setting := operation_setting.GetHelipaySetting()
	if setting.CustomerNumber == "" {
		return nil, fmt.Errorf("商户号未配置")
	}

	request := QueryOrderRequest{
		OrderId: orderId,
		OrderNo: orderNo,
	}

	dataMap, err := AssemblyRequestMap(request)
	if err != nil {
		return nil, err
	}

	dataStr, err := json.Marshal(dataMap)
	if err != nil {
		return nil, err
	}
	sign, err := GenerateSign(string(dataStr))
	if err != nil {
		return nil, err
	}

	helipayRequest := HelipayRequest{
		CustomerNumber: setting.CustomerNumber,
		RequestId:      GenerateRequestId(),
		RequestTime:    GetCurrentTime(),
		Sign:           sign,
		Data:           dataMap,
	}

	url := setting.TrxURL + "/universalcashier/query"
	response, err := httpRequest(url, helipayRequest)
	if err != nil {
		return nil, err
	}

	if response.Code != "0000" {
		return nil, fmt.Errorf("查询失败: %s", response.Message)
	}

	dataJson, err := json.Marshal(response.Data)
	if err != nil {
		return nil, err
	}
	if !VerifySign(string(dataJson), response.Sign) {
		return nil, fmt.Errorf("响应签名验证失败")
	}

	var result QueryOrderResponse
	err = mapToStruct(response.Data, &result)
	if err != nil {
		return nil, err
	}

	return &result, nil
}

// CancelOrder 取消订单
func CancelOrder(orderId, orderNo string) (*CancelOrderResponse, error) {
	setting := operation_setting.GetHelipaySetting()
	if setting.CustomerNumber == "" {
		return nil, fmt.Errorf("商户号未配置")
	}

	request := CancelOrderRequest{
		OrderId: orderId,
		OrderNo: orderNo,
	}

	dataMap, err := AssemblyRequestMap(request)
	if err != nil {
		return nil, err
	}

	dataStr, err := json.Marshal(dataMap)
	if err != nil {
		return nil, err
	}
	sign, err := GenerateSign(string(dataStr))
	if err != nil {
		return nil, err
	}

	helipayRequest := HelipayRequest{
		CustomerNumber: setting.CustomerNumber,
		RequestId:      GenerateRequestId(),
		RequestTime:    GetCurrentTime(),
		Sign:           sign,
		Data:           dataMap,
	}

	url := setting.TrxURL + "/universalcashier/cancel"
	response, err := httpRequest(url, helipayRequest)
	if err != nil {
		return nil, err
	}

	if response.Code != "0000" {
		return nil, fmt.Errorf("取消失败: %s", response.Message)
	}

	dataJson, err := json.Marshal(response.Data)
	if err != nil {
		return nil, err
	}
	if !VerifySign(string(dataJson), response.Sign) {
		return nil, fmt.Errorf("响应签名验证失败")
	}

	var result CancelOrderResponse
	err = mapToStruct(response.Data, &result)
	if err != nil {
		return nil, err
	}

	return &result, nil
}

// Refund 退款
func Refund(orderId, orderNo, refundAmount, refundDesc string) (*RefundResponse, error) {
	setting := operation_setting.GetHelipaySetting()
	if setting.CustomerNumber == "" {
		return nil, fmt.Errorf("商户号未配置")
	}

	request := RefundRequest{
		OrderId:      orderId,
		OrderNo:      orderNo,
		RefundAmount: refundAmount,
		RefundDesc:   refundDesc,
	}

	dataMap, err := AssemblyRequestMap(request)
	if err != nil {
		return nil, err
	}

	dataStr, err := json.Marshal(dataMap)
	if err != nil {
		return nil, err
	}
	sign, err := GenerateSign(string(dataStr))
	if err != nil {
		return nil, err
	}

	helipayRequest := HelipayRequest{
		CustomerNumber: setting.CustomerNumber,
		RequestId:      GenerateRequestId(),
		RequestTime:    GetCurrentTime(),
		Sign:           sign,
		Data:           dataMap,
	}

	url := setting.TrxURL + "/universalcashier/refund"
	response, err := httpRequest(url, helipayRequest)
	if err != nil {
		return nil, err
	}

	if response.Code != "0000" {
		return nil, fmt.Errorf("退款失败: %s", response.Message)
	}

	dataJson, err := json.Marshal(response.Data)
	if err != nil {
		return nil, err
	}
	if !VerifySign(string(dataJson), response.Sign) {
		return nil, fmt.Errorf("响应签名验证失败")
	}

	var result RefundResponse
	err = mapToStruct(response.Data, &result)
	if err != nil {
		return nil, err
	}

	return &result, nil
}

// httpRequest 发送HTTP请求
func httpRequest(url string, request HelipayRequest) (*HelipayResponse, error) {
	jsonData, err := json.Marshal(request)
	if err != nil {
		return nil, err
	}

	client := &http.Client{
		Timeout: 30 * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: true,
			},
		},
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var response HelipayResponse
	err = json.Unmarshal(body, &response)
	if err != nil {
		return nil, err
	}

	return &response, nil
}

// mapToStruct 将map转换为结构体
func mapToStruct(data map[string]interface{}, result interface{}) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}
	return json.Unmarshal(jsonData, result)
}

// GetRandomInt 生成随机整数
func GetRandomInt(min, max int) int {
	return min + int(time.Now().UnixNano())%(max-min+1)
}

// GetCallbackAddress 获取回调地址
func GetHelipayCallbackAddress() string {
	notifyPath := operation_setting.GetHelipayNotifyPath()
	if notifyPath == "" {
		notifyPath = "/api/user/helipay/notify"
	}
	serverAddress := GetCallbackAddress()
	return strings.TrimSuffix(serverAddress, "/") + notifyPath
}