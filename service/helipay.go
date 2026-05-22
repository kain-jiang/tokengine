package service

import (
	"bytes"
	"crypto/rand"
	"crypto/tls"
	"encoding/asn1"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/setting/operation_setting"
	jsoniter "github.com/json-iterator/go"
	"github.com/tjfoc/gmsm/sm2"
	"github.com/tjfoc/gmsm/sm3"
	"github.com/tjfoc/gmsm/sm4"
	"github.com/tjfoc/gmsm/x509"
)

var jsonFast = jsoniter.ConfigCompatibleWithStandardLibrary

// HelipayRequest 合利宝请求结构体
type HelipayRequest struct {
	CustomerNumber   string `json:"customerNumber"`
	EncryptionKey    string `json:"encryptionKey"`
	SignType         string `json:"signType"`
	Sign             string `json:"sign"`
	Timestamp        string `json:"timestamp"`
	Version          string `json:"version"`
	CertSerialNumber string `json:"certSerialNumber,omitempty"`
	Data             string `json:"data"`
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
	WapUrl         string `json:"wapUrl"`
	OrderId        string `json:"orderId"`
	OrderNo        string `json:"orderNo"`
	CustomerNumber string `json:"customerNumber"`
	PrepayId       string `json:"prepayId"`
	PayInfo        string `json:"payInfo,omitempty"`
}

// QueryOrderRequest 订单查询请求
type QueryOrderRequest struct {
	OrderId string `json:"orderId"`
	OrderNo string `json:"orderNo"`
}

// QueryOrderResponse 订单查询响应
type QueryOrderResponse struct {
	OrderId     string  `json:"orderId"`
	OrderNo     string  `json:"orderNo"`
	OrderAmount float64 `json:"orderAmount"`
	TradeState  string  `json:"tradeState"`
	TradeTime   string  `json:"tradeTime"`
	PayTime     string  `json:"payTime"`
	ErrorCode   string  `json:"errorCode"`
	ErrorMsg    string  `json:"errorMsg"`
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
	OrderId      string `json:"orderId"`
	OrderNo      string `json:"orderNo"`
	RefundAmount string `json:"refundAmount"`
	RefundDesc   string `json:"refundDesc"`
}

// RefundResponse 退款响应
type RefundResponse struct {
	OrderId      string `json:"orderId"`
	OrderNo      string `json:"orderNo"`
	RefundNo     string `json:"refundNo"`
	RefundAmount string `json:"refundAmount"`
	TradeTime    string `json:"tradeTime"`
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

// GetTimestamp 获取时间戳字符串（yyyyMMddHHmmss格式，14位）
func GetTimestamp() string {
	return time.Now().Format("20060102150405")
}

// GenerateRandomKey 生成随机密钥（16字节，Base64编码后512字符以内）
func GenerateRandomKey() string {
	key := make([]byte, 16)
	_, err := rand.Read(key)
	if err != nil {
		// 如果随机数生成失败，使用时间戳作为备选
		return fmt.Sprintf("%d", time.Now().UnixNano())[:16]
	}
	return string(key)
}

// SM4Encrypt 使用SM4算法加密数据（CBC模式，PKCS7Padding）
// IV固定为 "AQ4Zvt54xKn9QaW86ZzWdg=="（与Java Demo一致）
func SM4Encrypt(data map[string]interface{}, rKey string) (string, error) {
	// 将数据序列化为JSON
	dataBytes, err := json.Marshal(data)
	if err != nil {
		return "", fmt.Errorf("数据序列化失败: %v", err)
	}

	// IV固定为 "AQ4Zvt54xKn9QaW86ZzWdg=="
	ivBytes, err := base64.StdEncoding.DecodeString("AQ4Zvt54xKn9QaW86ZzWdg==")
	if err != nil {
		return "", fmt.Errorf("IV解码失败: %v", err)
	}

	// SM4 CBC 加密
	sm4.SetIV(ivBytes)
	ciphertext, err := sm4.Sm4Cbc([]byte(rKey), dataBytes, true)
	if err != nil {
		return "", fmt.Errorf("SM4 CBC加密失败: %v", err)
	}

	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// SM4Decrypt 使用SM4算法解密数据（CBC模式，PKCS7Padding）
func SM4Decrypt(ciphertextBase64 string, sm4Key string) ([]byte, error) {
	ciphertext, err := base64.StdEncoding.DecodeString(ciphertextBase64)
	if err != nil {
		return nil, fmt.Errorf("密文Base64解码失败: %v", err)
	}

	keyBytes, err := base64.StdEncoding.DecodeString(sm4Key)
	if err != nil {
		return nil, fmt.Errorf("SM4密钥解码失败: %v", err)
	}

	ivBytes, err := base64.StdEncoding.DecodeString("AQ4Zvt54xKn9QaW86ZzWdg==")
	if err != nil {
		return nil, fmt.Errorf("IV解码失败: %v", err)
	}

	sm4.SetIV(ivBytes)
	plaintext, err := sm4.Sm4Cbc(keyBytes, ciphertext, false)
	if err != nil {
		return nil, fmt.Errorf("SM4 CBC解密失败: %v", err)
	}

	return plaintext, nil
}

// SM2EncryptRKey使用SM2公钥加密随机密钥
func SM2EncryptRKey(rKey string) (string, error) {
	publicKeyStr := operation_setting.GetHelipaySM2PublicKey()
	if publicKeyStr == "" {
		return "", fmt.Errorf("SM2公钥未配置")
	}

	var keyBytes []byte
	var publicKey *sm2.PublicKey
	var err error

	keyBytes, decodeErr := base64.StdEncoding.DecodeString(publicKeyStr)
	if decodeErr != nil {
		return "", fmt.Errorf("SM2公钥解码失败: %v", decodeErr)
	}
	publicKey, err = x509.ReadPublicKeyFromPem(keyBytes)
	if err != nil {
		return "", fmt.Errorf("SM2公钥解析失败: %v", err)
	}

	encrypted, err := sm2.Encrypt(publicKey, []byte(rKey), rand.Reader, sm2.C1C3C2)
	if err != nil {
		return "", fmt.Errorf("SM2加密随机密钥失败: %v", err)
	}

	return base64.StdEncoding.EncodeToString(encrypted), nil
}

// SM2Decrypt 使用SM2私钥解密数据（支持 C1C3C2 模式）
func SM2Decrypt(ciphertextBase64 string) (string, error) {
	privateKeyStr := operation_setting.GetHelipaySM2PrivateKey()
	if privateKeyStr == "" {
		return "", fmt.Errorf("SM2私钥未配置")
	}

	var keyBytes []byte
	var privateKey *sm2.PrivateKey
	var err error

	keyBytes, decodeErr := base64.StdEncoding.DecodeString(privateKeyStr)
	if decodeErr != nil {
		return "", fmt.Errorf("SM2私钥解码失败: %v", decodeErr)
	}
	privateKey, err = x509.ReadPrivateKeyFromPem(keyBytes, nil)
	if err != nil {
		return "", fmt.Errorf("SM2私钥解析失败: %v", err)
	}

	ciphertext, err := base64.StdEncoding.DecodeString(ciphertextBase64)
	if err != nil {
		return "", fmt.Errorf("密文Base64解码失败: %v", err)
	}

	plaintext, err := sm2.Decrypt(privateKey, ciphertext, sm2.C1C3C2)
	if err != nil {
		return "", fmt.Errorf("SM2解密失败: %v", err)
	}

	return string(plaintext), nil
}

// GenerateSign 生成签名（SM3WITHSM2）
func GenerateSign(encryptedData string) (string, error) {
	privateKeyStr := operation_setting.GetHelipaySM2PrivateKey()
	if privateKeyStr == "" {
		return "", fmt.Errorf("SM2私钥未配置")
	}
	privateKeyStr = strings.TrimSpace(privateKeyStr)

	var keyBytes []byte
	var privateKey *sm2.PrivateKey
	var err error

	keyBytes, decodeErr := base64.StdEncoding.DecodeString(privateKeyStr)
	if decodeErr != nil {
		return "", fmt.Errorf("SM2私钥解码失败: %v", decodeErr)
	}
	privateKey, err = x509.ReadPrivateKeyFromPem(keyBytes, nil)
	if err != nil {
		return "", fmt.Errorf("SM2私钥解析失败: %v", err)
	}

	// 使用 SM3withSM2 签名，USER_ID 使用标准值（与 PHP Demo 一致）
	r, s2, err := sm2.Sm2Sign(privateKey, []byte(encryptedData), nil, rand.Reader)
	if err != nil {
		return "", fmt.Errorf("SM2签名失败: %v", err)
	}

	// 将r和s拼接成DER格式的签名
	signature, err := sm2.SignDigitToSignData(r, s2)
	if err != nil {
		return "", fmt.Errorf("签名编码失败: %v", err)
	}

	return base64.StdEncoding.EncodeToString(signature), nil
}

// VerifySign 验证签名（SM3WITHSM2）
// 必须确保验签时 USER_ID 为 nil，与签名时保持一致
// Java demo: SM2(null, publicKey).verify(plainData, signature, null)
func VerifySign(data, sign string) bool {
	publicKeyStr := operation_setting.GetHelipaySM2PublicKey()
	if publicKeyStr == "" {
		fmt.Println("VerifySign: SM2公钥未配置")
		return false
	}
	publicKeyStr = strings.TrimSpace(publicKeyStr)

	// 解析签名 - base64 解码
	signBytes, err := base64.StdEncoding.DecodeString(sign)
	if err != nil {
		fmt.Printf("VerifySign: 签名Base64解码失败: %v\n", err)
		return false
	}

	// 解析SM2公钥
	var publicKey *sm2.PublicKey
	keyBytes, decodeErr := base64.StdEncoding.DecodeString(publicKeyStr)
	if decodeErr != nil {
		fmt.Printf("VerifySign: 公钥Base64解码失败: %v\n", decodeErr)
		return false
	}
	publicKey, err = x509.ReadPublicKeyFromPem(keyBytes)
	if err != nil {
		fmt.Printf("VerifySign: 公钥解析失败: %v\n", err)
		return false
	}

	// 解析 ASN.1 DER 格式的签名为 R 和 S
	var sig sm2Signature
	_, asn1Err := asn1.Unmarshal(signBytes, &sig)
	if asn1Err != nil {
		fmt.Printf("VerifySign: 签名ASN.1解析失败: %v\n", asn1Err)
		return false
	}

	// 调用 Sm2Verify 并传入 nil（gmsm 库会使用 default_uid = "1234567812345678"）
	result := sm2.Sm2Verify(publicKey, []byte(data), nil, sig.R, sig.S)
	fmt.Printf("VerifySign: 验签结果=%v\n", result)

	return result
}

// sm2Signature 定义 SM2 签名结构（从 gmsm 库复制，避免内部依赖）
type sm2Signature struct {
	R, S *big.Int
}

// SM3Hash 计算SM3摘要
func SM3Hash(data string) string {
	hash := sm3.New()
	hash.Write([]byte(data))
	return hex.EncodeToString(hash.Sum(nil))
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

	dataMap, err := AssemblyRequestMap(request)
	if err != nil {
		return nil, err
	}

	// 生成随机加密密钥（原始字符串）
	rKey := GenerateRandomKey()

	// 使用SM2公钥加密随机密钥（encryptionKey使用SM2加密）
	encryptionKey, err := SM2EncryptRKey(rKey)
	if err != nil {
		return nil, err
	}

	// 使用SM4加密data字段（使用动态生成的密钥）
	encryptedData, err := SM4Encrypt(dataMap, rKey)
	if err != nil {
		return nil, err
	}

	// 生成签名（签名内容为加密后的data，与Java Demo一致）
	sign, err := GenerateSign(encryptedData)
	if err != nil {
		return nil, err
	}

	helipayRequest := HelipayRequest{
		CustomerNumber: setting.CustomerNumber,
		EncryptionKey:  encryptionKey,
		SignType:       "SM3WITHSM2",
		Sign:           sign,
		Timestamp:      GetTimestamp(),
		Version:        "1.0",
		Data:           encryptedData,
	}

	url := operation_setting.GetHelipayTrxURL() + "/trx/universalcashier/unifiedorder"
	response, err := httpRequest(url, helipayRequest)
	if err != nil {
		return nil, err
	}

	if response.Code != "0000" {
		return nil, fmt.Errorf("预下单失败: %s", response.Message)
	}
	// 验证签名（使用 FilterNullFields 过滤 null 值，与 PHP Demo 一致）
	// 手动构建排序后的 JSON 字符串，确保字段顺序与 PHP 一致
	// PHP ksort 排序顺序: wapUrl, orderNo, orderId, prepayId, customerNumber
	orderedKeys := []string{"wapUrl", "orderNo", "orderId", "prepayId", "customerNumber"}

	var sb strings.Builder
	sb.WriteString("{")
	first := true
	for _, k := range orderedKeys {
		v, exists := response.Data[k]
		if !exists || v == nil {
			continue
		}
		if str, ok := v.(string); ok && str == "" {
			continue
		}
		if !first {
			sb.WriteString(",")
		}
		first = false
		sb.WriteString(fmt.Sprintf("%q:", k))
		switch val := v.(type) {
		case string:
			sb.WriteString(fmt.Sprintf("%q", val))
		case float64:
			sb.WriteString(fmt.Sprintf("%v", val))
		default:
			valBytes, _ := jsonFast.Marshal(val)
			sb.WriteString(string(valBytes))
		}
	}
	sb.WriteString("}")
	dataJson := []byte(sb.String())

	fmt.Printf("dataJson: %s\n", string(dataJson))
	fmt.Printf("sign: %s\n", response.Sign)

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

// FilterNullFields 过滤 map 中的 null 值（与 PHP Demo 一致）
func FilterNullFields(data map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{})
	for k, v := range data {
		// 过滤 nil 值
		if v == nil {
			continue
		}
		// 过滤空字符串
		if str, ok := v.(string); ok && str == "" {
			continue
		}
		result[k] = v
	}
	return result
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

	// 生成随机加密密钥（与Java Demo一致，动态生成）
	rKey := GenerateRandomKey()

	// 使用SM2公钥加密随机密钥（encryptionKey使用SM2加密）
	encryptionKey, err := SM2EncryptRKey(rKey)
	if err != nil {
		return nil, err
	}

	// 使用SM4加密data字段（使用动态生成的密钥）
	encryptedData, err := SM4Encrypt(dataMap, rKey)
	if err != nil {
		return nil, err
	}

	// 生成签名（签名内容为加密后的data，与Java Demo一致）
	sign, err := GenerateSign(encryptedData)
	if err != nil {
		return nil, err
	}

	helipayRequest := HelipayRequest{
		CustomerNumber: setting.CustomerNumber,
		EncryptionKey:  encryptionKey,
		SignType:       "SM3WITHSM2",
		Sign:           sign,
		Timestamp:      GetTimestamp(),
		Version:        "1.0",
		Data:           encryptedData,
	}

	url := operation_setting.GetHelipayTrxURL() + "/trx/universalcashier/query"
	response, err := httpRequest(url, helipayRequest)
	if err != nil {
		return nil, err
	}

	if response.Code != "0000" {
		return nil, fmt.Errorf("查询失败: %s", response.Message)
	}
	// todo
	/*
		dataJson, err := json.Marshal(FilterNullFields(response.Data))
		if err != nil {
			return nil, err
		}

		if !VerifySign(string(dataJson), response.Sign) {
			return nil, fmt.Errorf("响应签名验证失败")
		}
	*/

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

	// 生成随机加密密钥（与Java Demo一致，动态生成）
	rKey := GenerateRandomKey()

	// 使用SM2公钥加密随机密钥（encryptionKey使用SM2加密）
	encryptionKey, err := SM2EncryptRKey(rKey)
	if err != nil {
		return nil, err
	}

	// 使用SM4加密data字段（使用动态生成的密钥）
	encryptedData, err := SM4Encrypt(dataMap, rKey)
	if err != nil {
		return nil, err
	}

	// 生成签名（签名内容为加密后的data，与Java Demo一致）
	sign, err := GenerateSign(encryptedData)
	if err != nil {
		return nil, err
	}

	helipayRequest := HelipayRequest{
		CustomerNumber: setting.CustomerNumber,
		EncryptionKey:  encryptionKey,
		SignType:       "SM3WITHSM2",
		Sign:           sign,
		Timestamp:      GetTimestamp(),
		Version:        "1.0",
		Data:           encryptedData,
	}

	url := operation_setting.GetHelipayTrxURL() + "/universalcashier/cancel"
	response, err := httpRequest(url, helipayRequest)
	if err != nil {
		return nil, err
	}

	if response.Code != "0000" {
		return nil, fmt.Errorf("取消失败: %s", response.Message)
	}

	// 验证签名（使用 FilterNullFields 过滤 null 值，与 PHP Demo 一致）
	dataJson, err := json.Marshal(FilterNullFields(response.Data))
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

	// 生成随机加密密钥（与Java Demo一致，动态生成）
	rKey := GenerateRandomKey()

	// 使用SM2公钥加密随机密钥（encryptionKey使用SM2加密）
	encryptionKey, err := SM2EncryptRKey(rKey)
	if err != nil {
		return nil, err
	}

	// 使用SM4加密data字段（使用动态生成的密钥）
	encryptedData, err := SM4Encrypt(dataMap, rKey)
	if err != nil {
		return nil, err
	}

	// 生成签名（签名内容为加密后的data，与Java Demo一致）
	sign, err := GenerateSign(encryptedData)
	if err != nil {
		return nil, err
	}

	helipayRequest := HelipayRequest{
		CustomerNumber: setting.CustomerNumber,
		EncryptionKey:  encryptionKey,
		SignType:       "SM3WITHSM2",
		Sign:           sign,
		Timestamp:      GetTimestamp(),
		Version:        "1.0",
		Data:           encryptedData,
	}

	url := operation_setting.GetHelipayTrxURL() + "/universalcashier/refund"
	response, err := httpRequest(url, helipayRequest)
	if err != nil {
		return nil, err
	}

	if response.Code != "0000" {
		return nil, fmt.Errorf("退款失败: %s", response.Message)
	}

	// 验证签名（使用 FilterNullFields 过滤 null 值，与 PHP Demo 一致）
	dataJson, err := json.Marshal(FilterNullFields(response.Data))
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
	fmt.Println("请求 JSON:", string(jsonData))

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
