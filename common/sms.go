package common

import (
	"fmt"
	"os"

	openapi "github.com/alibabacloud-go/darabonba-openapi/v2/client"
	dysmsapi20170525 "github.com/alibabacloud-go/dysmsapi-20170525/v5/client"
	util "github.com/alibabacloud-go/tea-utils/v2/service"
	"github.com/alibabacloud-go/tea/tea"
	credential "github.com/aliyun/credentials-go/credentials"
)

var (
	SMSProvider        string
	SMSAccessKeyId     string
	SMSAccessKeySecret string
	SMSSignName        string
	SMSTemplateCode    string
	SMSRegionId        string
	SMSEndpoint        string
)

func initSMSConfig() {
	SMSProvider = GetEnvOrDefaultString("SMS_PROVIDER", "aliyun")
	SMSAccessKeyId = os.Getenv("SMS_ACCESS_KEY_ID")
	SMSAccessKeySecret = os.Getenv("SMS_ACCESS_KEY_SECRET")
	SMSSignName = GetEnvOrDefaultString("SMS_SIGN_NAME", "")
	SMSTemplateCode = GetEnvOrDefaultString("SMS_TEMPLATE_CODE", "")
	SMSRegionId = GetEnvOrDefaultString("SMS_REGION_ID", "cn-hangzhou")
	SMSEndpoint = GetEnvOrDefaultString("SMS_ENDPOINT", "dysmsapi.aliyuncs.com")
}

func createAliyunSMSClient() (*dysmsapi20170525.Client, error) {
	if SMSAccessKeyId == "" || SMSAccessKeySecret == "" {
		return nil, fmt.Errorf("阿里云短信凭证未配置")
	}

	credentialsConfig := &credential.Config{
		Type:            tea.String("access_key"),
		AccessKeyId:     tea.String(SMSAccessKeyId),
		AccessKeySecret: tea.String(SMSAccessKeySecret),
	}

	akCredential, err := credential.NewCredential(credentialsConfig)
	if err != nil {
		return nil, fmt.Errorf("创建凭据失败: %w", err)
	}

	config := &openapi.Config{
		Credential: akCredential,
		RegionId:   tea.String(SMSRegionId),
		Endpoint:   tea.String(SMSEndpoint),
	}

	client, err := dysmsapi20170525.NewClient(config)
	if err != nil {
		return nil, fmt.Errorf("创建短信客户端失败: %w", err)
	}

	return client, nil
}

func sendAliyunSMS(phoneNumber string, code string) error {
	client, err := createAliyunSMSClient()
	if err != nil {
		return err
	}

	if SMSSignName == "" {
		return fmt.Errorf("短信签名未配置")
	}

	if SMSTemplateCode == "" {
		return fmt.Errorf("短信模板未配置")
	}

	templateParam := fmt.Sprintf(`{"code":"%s"}`, code)

	sendSmsRequest := &dysmsapi20170525.SendSmsRequest{
		PhoneNumbers:  tea.String(phoneNumber),
		SignName:      tea.String(SMSSignName),
		TemplateCode:  tea.String(SMSTemplateCode),
		TemplateParam: tea.String(templateParam),
	}

	resp, err := client.SendSmsWithOptions(sendSmsRequest, &util.RuntimeOptions{})
	if err != nil {
		SysLog(fmt.Sprintf("发送短信失败: %v, resp == nil: %v", err, resp == nil))
		return fmt.Errorf("发送短信失败: %w", err)
	}

	if resp == nil {
		SysLog("发送短信失败: 响应对象为空")
		return fmt.Errorf("发送短信失败: 响应对象为空")
	}

	bytes, marshalErr := Marshal(resp.Body)
	SysLog(phoneNumber + ":" + string(bytes))
	if marshalErr != nil {
		SysLog(fmt.Sprintf("序列化响应体失败: %v", marshalErr))
	}

	if resp.Body == nil {
		SysLog("发送短信失败: 响应体为空")
		return fmt.Errorf("发送短信失败: 响应体为空")
	}

	if resp.Body.Code == nil || *resp.Body.Code != "OK" {
		errorMsg := "未知错误"
		if resp.Body.Message != nil {
			errorMsg = *resp.Body.Message
		}
		codeStr := "nil"
		if resp.Body.Code != nil {
			codeStr = *resp.Body.Code
		}
		SysLog(fmt.Sprintf("短信发送失败: Code=%s, Message=%s", codeStr, errorMsg))
		return fmt.Errorf("短信发送失败 [%s]: %s", codeStr, errorMsg)
	}

	SysLog(fmt.Sprintf("短信发送成功: 手机号=%s, BizId=%s", phoneNumber, *resp.Body.BizId))
	return nil
}

func SendSMS(phoneNumber string, code string) error {
	if phoneNumber == "" {
		return fmt.Errorf("手机号不能为空")
	}

	if code == "" {
		return fmt.Errorf("验证码不能为空")
	}

	switch SMSProvider {
	case "aliyun":
		return sendAliyunSMS(phoneNumber, code)
	default:
		return fmt.Errorf("不支持的短信服务商: %s", SMSProvider)
	}
}

func IsSMSEnabled() bool {
	initSMSConfig()
	return SMSAccessKeyId != "" && SMSAccessKeySecret != "" && SMSSignName != "" && SMSTemplateCode != ""
}
