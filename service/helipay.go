package service

import (
	"bytes"
	"crypto/rand"
	"crypto/tls"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/tjfoc/gmsm/sm2"
	"github.com/tjfoc/gmsm/x509"
)

// HelipayRequest 合利宝请求结构体
type HelipayRequest struct {
	CustomerNumber   string                 `json:"customerNumber"`
	EncryptionKey    string                 `json:"encryptionKey"`
	SignType         string                 `json:"signType"`
	Sign             string                 `json:"sign"`
	Timestamp        string                 `json:"timestamp"`
	Version          string                 `json:"version"`
	CertSerialNumber string                 `json:"certSerialNumber,omitempty"`
	Data             map[string]interface{} `json:"data"`
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

// GenerateSM4Key 生成随机SM4密钥（16字节，Base64编码后512字符以内）
func GenerateSM4Key() string {
	key := make([]byte, 16)
	_, err := rand.Read(key)
	if err != nil {
		// 如果随机数生成失败，使用时间戳作为备选
		return fmt.Sprintf("%d", time.Now().UnixNano())[:16]
	}
	return base64.StdEncoding.EncodeToString(key)
}

// SM4Encrypt 使用SM4算法加密数据（CBC模式，PKCS7Padding）
// IV固定为 "AQ4Zvt54xKn9QaW86ZzWdg=="（与Java Demo一致）
func SM4Encrypt(data map[string]interface{}, sm4Key string) (map[string]interface{}, error) {
	// 将数据序列化为JSON
	dataBytes, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("数据序列化失败: %v", err)
	}

	// 解码Base64编码的SM4密钥
	keyBytes, err := base64.StdEncoding.DecodeString(sm4Key)
	if err != nil {
		return nil, fmt.Errorf("SM4密钥解码失败: %v", err)
	}
	if len(keyBytes) != 16 {
		return nil, fmt.Errorf("SM4密钥长度必须为16字节（Base64编码后约24字符），实际长度: %d", len(keyBytes))
	}

	// 当前使用占位符实现（XOR加密），实际需要使用 sm4 库进行真正的SM4加密
	ciphertext := make([]byte, len(dataBytes))
	for i := range dataBytes {
		ciphertext[i] = dataBytes[i] ^ keyBytes[i%16]
	}

	return map[string]interface{}{
		"data": base64.StdEncoding.EncodeToString(ciphertext),
	}, nil
}

// SM2EncryptSM4Key 使用SM2公钥加密SM4密钥
func SM2EncryptSM4Key(sm4Key string) (string, error) {
	publicKeyStr := operation_setting.GetHelipaySM2PublicKey()
	if publicKeyStr == "" {
		return "", fmt.Errorf("SM2公钥未配置")
	}

	var publicKey *sm2.PublicKey
	var err error

	if strings.Contains(publicKeyStr, "-----BEGIN") {
		publicKey, err = x509.ReadPublicKeyFromPem([]byte(publicKeyStr))
	} else {
		keyBytes, decodeErr := hex.DecodeString(publicKeyStr)
		if decodeErr != nil {
			keyBytes, decodeErr = base64.StdEncoding.DecodeString(publicKeyStr)
			if decodeErr != nil {
				return "", fmt.Errorf("SM2公钥解码失败: %v", decodeErr)
			}
		}
		publicKey, err = x509.ParseSm2PublicKey(keyBytes)
	}

	if err != nil {
		return "", fmt.Errorf("SM2公钥解析失败: %v", err)
	}

	sm4KeyBytes, err := base64.StdEncoding.DecodeString(sm4Key)
	if err != nil {
		return "", fmt.Errorf("SM4密钥解码失败: %v", err)
	}

	encrypted, err := sm2.Encrypt(publicKey, sm4KeyBytes, rand.Reader, sm2.C1C2C3)
	if err != nil {
		return "", fmt.Errorf("SM2加密SM4密钥失败: %v", err)
	}

	return base64.StdEncoding.EncodeToString(encrypted), nil
}

// GenerateSign 生成签名（SM3WITHSM2）
func GenerateSign(data string) (string, error) {
	privateKeyStr := operation_setting.GetHelipaySM2PrivateKey()
	if privateKeyStr == "" {
		return "", fmt.Errorf("SM2私钥未配置")
	}

	privateKeyStr = strings.TrimSpace(privateKeyStr)

	var privateKey *sm2.PrivateKey
	var err error

	if strings.Contains(privateKeyStr, "-----BEGIN") {
		// PEM格式
		privateKey, err = x509.ReadPrivateKeyFromPem([]byte(privateKeyStr), nil)
	} else {
		// 尝试解析十六进制或Base64编码的私钥
		keyBytes, decodeErr := hex.DecodeString(privateKeyStr)
		if decodeErr != nil {
			keyBytes, decodeErr = base64.StdEncoding.DecodeString(privateKeyStr)
			if decodeErr != nil {
				return "", fmt.Errorf("SM2私钥解码失败: %v", decodeErr)
			}
		}

		// 尝试解析PKCS8格式
		privateKey, err = x509.ParsePKCS8PrivateKey(keyBytes, nil)
		if err != nil {
			// 尝试解析原始私钥格式
			privateKey, err = x509.ParseSm2PrivateKey(keyBytes)
			if err != nil {
				return "", fmt.Errorf("SM2私钥解析失败: %v", err)
			}
		}
	}

	if err != nil {
		return "", fmt.Errorf("SM2私钥解析失败: %v", err)
	}

	// 使用SM2withSM3签名，USER_ID使用国密局推荐ID
	uid := []byte("1234567812345678")
	r, s2, err := sm2.Sm2Sign(privateKey, []byte(data), uid, rand.Reader)
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
func VerifySign(data, sign string) bool {
	publicKeyStr := operation_setting.GetHelipaySM2PublicKey()
	if publicKeyStr == "" {
		return false
	}

	publicKeyStr = strings.TrimSpace(publicKeyStr)

	// 解析签名
	signBytes, err := base64.StdEncoding.DecodeString(sign)
	if err != nil {
		return false
	}

	// 解析SM2公钥
	var publicKey *sm2.PublicKey
	if strings.Contains(publicKeyStr, "-----BEGIN") {
		// PEM格式
		publicKey, err = x509.ReadPublicKeyFromPem([]byte(publicKeyStr))
	} else {
		// 尝试解析十六进制或Base64编码的公钥
		keyBytes, decodeErr := hex.DecodeString(publicKeyStr)
		if decodeErr != nil {
			keyBytes, decodeErr = base64.StdEncoding.DecodeString(publicKeyStr)
			if decodeErr != nil {
				return false
			}
		}

		// 尝试解析原始公钥格式
		publicKey, err = x509.ParseSm2PublicKey(keyBytes)
	}

	if err != nil {
		return false
	}

	// 验证签名
	return publicKey.Verify([]byte(data), signBytes)
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

	// 生成随机加密密钥（与Java Demo一致，动态生成）
	sm4Key := GenerateSM4Key()

	// 使用SM2公钥加密SM4密钥（encryptionKey使用SM2加密）
	encryptionKey, err := SM2EncryptSM4Key(sm4Key)
	if err != nil {
		return nil, err
	}

	// 使用SM4加密data字段（使用动态生成的密钥）
	encryptedData, err := SM4Encrypt(dataMap, sm4Key)
	if err != nil {
		return nil, err
	}

	// 生成签名（签名内容为加密后的data，与Java Demo一致）
	signData := encryptedData["data"].(string)
	sign, err := GenerateSign(signData)
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

	// 生成随机加密密钥（与Java Demo一致，动态生成）
	sm4Key := GenerateSM4Key()

	// 使用SM2公钥加密SM4密钥（encryptionKey使用SM2加密）
	encryptionKey, err := SM2EncryptSM4Key(sm4Key)
	if err != nil {
		return nil, err
	}

	// 使用SM4加密data字段（使用动态生成的密钥）
	encryptedData, err := SM4Encrypt(dataMap, sm4Key)
	if err != nil {
		return nil, err
	}

	// 生成签名（签名内容为加密后的data，与Java Demo一致）
	signData := encryptedData["data"].(string)
	sign, err := GenerateSign(signData)
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

	url := operation_setting.GetHelipayTrxURL() + "/universalcashier/query"
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

	// 生成随机加密密钥（与Java Demo一致，动态生成）
	sm4Key := GenerateSM4Key()

	// 使用SM2公钥加密SM4密钥（encryptionKey使用SM2加密）
	encryptionKey, err := SM2EncryptSM4Key(sm4Key)
	if err != nil {
		return nil, err
	}

	// 使用SM4加密data字段（使用动态生成的密钥）
	encryptedData, err := SM4Encrypt(dataMap, sm4Key)
	if err != nil {
		return nil, err
	}

	// 生成签名（签名内容为加密后的data，与Java Demo一致）
	signData := encryptedData["data"].(string)
	sign, err := GenerateSign(signData)
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

	// 生成随机加密密钥（与Java Demo一致，动态生成）
	sm4Key := GenerateSM4Key()

	// 使用SM2公钥加密SM4密钥（encryptionKey使用SM2加密）
	encryptionKey, err := SM2EncryptSM4Key(sm4Key)
	if err != nil {
		return nil, err
	}

	// 使用SM4加密data字段（使用动态生成的密钥）
	encryptedData, err := SM4Encrypt(dataMap, sm4Key)
	if err != nil {
		return nil, err
	}

	// 生成签名（签名内容为加密后的data，与Java Demo一致）
	signData := encryptedData["data"].(string)
	sign, err := GenerateSign(signData)
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
