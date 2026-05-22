package operation_setting

import (
	"os"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

// HelipaySetting 合利宝支付配置
type HelipaySetting struct {
	// 敏感配置（从环境变量读取）
	CustomerNumber string `json:"customer_number"`
	SM2PrivateKey  string `json:"sm2_private_key"`
	SM2PrivatePwd  string `json:"sm2_private_pwd"`
	SM2PublicKey   string `json:"sm2_public_key"`

	// 非敏感配置（从数据库读取，可编辑）
	Enabled      bool   `json:"enabled"`
	TrxURL       string `json:"trx_url"`
	NotifyPath   string `json:"notify_path"`
	PayValidTime string `json:"pay_valid_time"`
}

// 默认配置
var helipaySetting = HelipaySetting{
	Enabled:        false,
	CustomerNumber: "",
	SM2PrivateKey:  "",
	SM2PrivatePwd:  "",
	SM2PublicKey:   "",
	TrxURL:         "https://lyyonlinetrx.frp.yyyyyy.top/trx",
	NotifyPath:     "/api/user/helipay/notify",
	PayValidTime:   "1800",
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("helipay", &helipaySetting)
}

// LoadHelipayFromEnv 从环境变量加载合利宝支付配置
func LoadHelipayFromEnv() {
	if customerNumber := os.Getenv("HELIPAY_CUSTOMER_NUMBER"); customerNumber != "" {
		helipaySetting.CustomerNumber = customerNumber
	}
	if sm2PrivateKey := os.Getenv("HELIPAY_SM2_PRIVATE_KEY"); sm2PrivateKey != "" {
		helipaySetting.SM2PrivateKey = sm2PrivateKey
	}
	if sm2PrivatePwd := os.Getenv("HELIPAY_SM2_PRIVATE_PWD"); sm2PrivatePwd != "" {
		helipaySetting.SM2PrivatePwd = sm2PrivatePwd
	}
	if sm2PublicKey := os.Getenv("HELIPAY_SM2_PUBLIC_KEY"); sm2PublicKey != "" {
		helipaySetting.SM2PublicKey = sm2PublicKey
	}
}

// GetHelipaySetting 获取合利宝支付配置
func GetHelipaySetting() *HelipaySetting {
	return &helipaySetting
}

// IsHelipayEnabled 检查合利宝支付是否启用
func IsHelipayEnabled() bool {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	if val, ok := common.OptionMap["helipay.Enabled"]; ok && val != "" {
		return val == "true"
	}
	return helipaySetting.Enabled
}

// GetHelipayCustomerNumber 获取商户号
func GetHelipayCustomerNumber() string {
	return helipaySetting.CustomerNumber
}

// GetHelipaySM2PrivateKey 获取SM2私钥， 已经是base64 编码的状态
func GetHelipaySM2PrivateKey() string {
	return helipaySetting.SM2PrivateKey
}

// GetHelipaySM2PrivatePwd 获取SM2私钥密码
func GetHelipaySM2PrivatePwd() string {
	return helipaySetting.SM2PrivatePwd
}

// GetHelipaySM2PublicKey 获取SM2公钥, 已经是base64 编码的状态
func GetHelipaySM2PublicKey() string {
	return helipaySetting.SM2PublicKey
}

// GetHelipayTrxURL 获取交易API地址
func GetHelipayTrxURL() string {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	if val, ok := common.OptionMap["helipay.TrxURL"]; ok && val != "" {
		return val
	}
	return helipaySetting.TrxURL
}

// GetHelipayNotifyPath 获取回调路径
func GetHelipayNotifyPath() string {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	if val, ok := common.OptionMap["helipay.NotifyPath"]; ok && val != "" {
		return val
	}
	return helipaySetting.NotifyPath
}

// GetHelipayPayValidTime 获取支付有效期
func GetHelipayPayValidTime() string {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	if val, ok := common.OptionMap["helipay.PayValidTime"]; ok && val != "" {
		return val
	}
	return helipaySetting.PayValidTime
}

// UpdateHelipayEnabled 更新启用状态
func UpdateHelipayEnabled(enabled bool) {
	helipaySetting.Enabled = enabled
}

// HelipayOption 配置项（供前端显示用）
type HelipayOption struct {
	Key   string
	Value string
}

// GetHelipayOptions 获取合利宝支付配置，供前端显示用
func GetHelipayOptions() []HelipayOption {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()

	getOptionValue := func(key string, defaultValue string) string {
		if val, ok := common.OptionMap[key]; ok && val != "" {
			return val
		}
		return defaultValue
	}

	return []HelipayOption{
		{Key: "helipay.Enabled", Value: getOptionValue("helipay.Enabled", strconv.FormatBool(helipaySetting.Enabled))},
		{Key: "helipay.CustomerNumber", Value: helipaySetting.CustomerNumber},
		{Key: "helipay.TrxURL", Value: getOptionValue("helipay.TrxURL", helipaySetting.TrxURL)},
		{Key: "helipay.NotifyPath", Value: getOptionValue("helipay.NotifyPath", helipaySetting.NotifyPath)},
		{Key: "helipay.PayValidTime", Value: getOptionValue("helipay.PayValidTime", helipaySetting.PayValidTime)},
	}
}
