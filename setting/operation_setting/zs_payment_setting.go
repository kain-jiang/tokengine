package operation_setting

import (
	"os"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

// ZSPaymentSetting 招商银行聚合支付配置
type ZSPaymentSetting struct {
	Enabled      bool   `json:"enabled"`
	MerID        string `json:"mer_id"`
	AppID        string `json:"app_id"`
	AppSecret    string `json:"app_secret"`
	PrivateKey   string `json:"private_key"`
	PublicKey    string `json:"public_key"`
	BaseURL      string `json:"base_url"`
	NotifyPath   string `json:"notify_path"`
	PayValidTime string `json:"pay_valid_time"`
}

// 默认配置
var zsPaymentSetting = ZSPaymentSetting{
	Enabled:      false, // 默认不启用，需要管理员手动配置
	MerID:        "",
	AppID:        "",
	AppSecret:    "",
	PrivateKey:   "",
	PublicKey:    "",
	BaseURL:      "https://api.cmburl.cn:8065", // 内置默认 A
	NotifyPath:   "/api/user/zs_pay/notify",
	PayValidTime: "1800",
}

func init() {
	// 注册到全局配置管理器（仅用于 Enabled 开关，其他配置从环境变量读取）
	config.GlobalConfig.Register("zs_payment", &zsPaymentSetting)
}

// LoadZSPayFromEnv 从环境变量加载招行支付配置
// 在 main() 中 godotenv.Load(".env") 之后调用
func LoadZSPayFromEnv() {
	// 商户号
	if merID := os.Getenv("ZS_PAYMENT_MER_ID"); merID != "" {
		zsPaymentSetting.MerID = merID
	}
	// AppID
	if appID := os.Getenv("ZS_PAYMENT_APP_ID"); appID != "" {
		zsPaymentSetting.AppID = appID
	}
	// AppSecret
	if appSecret := os.Getenv("ZS_PAYMENT_APP_SECRET"); appSecret != "" {
		zsPaymentSetting.AppSecret = appSecret
	}
	// 私钥
	if privateKey := os.Getenv("ZS_PAYMENT_PRIVATE_KEY"); privateKey != "" {
		zsPaymentSetting.PrivateKey = privateKey
	}
	// 公钥
	if publicKey := os.Getenv("ZS_PAYMENT_PUBLIC_KEY"); publicKey != "" {
		zsPaymentSetting.PublicKey = publicKey
	}
}

// GetZSPaymentSetting 获取招商银行聚合支付配置
func GetZSPaymentSetting() *ZSPaymentSetting {
	return &zsPaymentSetting
}

// IsZSPayEnabled 检查招商银行聚合支付是否启用
func IsZSPayEnabled() bool {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	if val, ok := common.OptionMap["zs_payment.Enabled"]; ok && val != "" {
		return val == "true"
	}
	return zsPaymentSetting.Enabled
}

// GetZSPayMerID 获取商户号
func GetZSPayMerID() string {
	return zsPaymentSetting.MerID
}

// GetZSPayAppID 获取AppID
func GetZSPayAppID() string {
	return zsPaymentSetting.AppID
}

// GetZSPayAppSecret 获取AppSecret
func GetZSPayAppSecret() string {
	return zsPaymentSetting.AppSecret
}

// GetZSPayPrivateKey 获取私钥
func GetZSPayPrivateKey() string {
	return zsPaymentSetting.PrivateKey
}

// GetZSPayPublicKey 获取公钥
func GetZSPayPublicKey() string {
	return zsPaymentSetting.PublicKey
}

// GetZSPayBaseURL 获取API地址
// 首先从数据库读取用户修改的值，不存在则使用内置默认值
func GetZSPayBaseURL() string {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	if val, ok := common.OptionMap["zs_payment.BaseURL"]; ok && val != "" {
		return val
	}
	return zsPaymentSetting.BaseURL
}

// GetZSPayNotifyPath 获取回调路径
// 首先从数据库读取用户修改的值，不存在则使用内置默认值
func GetZSPayNotifyPath() string {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	if val, ok := common.OptionMap["zs_payment.NotifyPath"]; ok && val != "" {
		return val
	}
	return zsPaymentSetting.NotifyPath
}

// GetZSPayPayValidTime 获取支付有效期
// 首先从数据库读取用户修改的值，不存在则使用内置默认值
func GetZSPayPayValidTime() string {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	if val, ok := common.OptionMap["zs_payment.PayValidTime"]; ok && val != "" {
		return val
	}
	return zsPaymentSetting.PayValidTime
}

// UpdateZSPayEnabled 更新启用状态（供前端开关使用）
func UpdateZSPayEnabled(enabled bool) {
	zsPaymentSetting.Enabled = enabled
}

// UpdateZSPayNotifyPath 更新回调路径（供前端配置使用）
func UpdateZSPayNotifyPath(path string) {
	zsPaymentSetting.NotifyPath = path
}

// UpdateZSPayPayValidTime 更新支付有效期（供前端配置使用）
func UpdateZSPayPayValidTime(time string) {
	zsPaymentSetting.PayValidTime = time
}

// ParseBool 安全地解析布尔值
func ParseBool(s string) bool {
	b, _ := strconv.ParseBool(s)
	return b
}

// ZSEnvOption 环境变量配置项（避免循环导入）
type ZSPayOption struct {
	Key   string
	Value string
}

// GetZSPayOptions 获取招行支付配置，供前端显示用
// 首先从 OptionMap（数据库）读取用户修改的值，不存在则使用内置默认值
func GetZSPayOptions() []ZSPayOption {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()

	// 从数据库读取用户修改的值，不存在则使用默认值
	getOptionValue := func(key string, defaultValue string) string {
		if val, ok := common.OptionMap[key]; ok && val != "" {
			return val
		}
		return defaultValue
	}

	return []ZSPayOption{
		{Key: "zs_payment.Enabled", Value: getOptionValue("zs_payment.Enabled", strconv.FormatBool(zsPaymentSetting.Enabled))},
		{Key: "zs_payment.MerID", Value: zsPaymentSetting.MerID}, // 商户号从环境变量读取
		{Key: "zs_payment.BaseURL", Value: getOptionValue("zs_payment.BaseURL", zsPaymentSetting.BaseURL)},
		{Key: "zs_payment.NotifyPath", Value: getOptionValue("zs_payment.NotifyPath", zsPaymentSetting.NotifyPath)},
		{Key: "zs_payment.PayValidTime", Value: getOptionValue("zs_payment.PayValidTime", zsPaymentSetting.PayValidTime)},
	}
}
