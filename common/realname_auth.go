package common

import (
	"fmt"
	"os"

	cloudauth20190307 "github.com/alibabacloud-go/cloudauth-20190307/v4/client"
	cloudauth20221125 "github.com/alibabacloud-go/cloudauth-20221125/client"
	openapi "github.com/alibabacloud-go/darabonba-openapi/v2/client"
	util "github.com/alibabacloud-go/tea-utils/v2/service"
	"github.com/alibabacloud-go/tea/tea"
	credential "github.com/aliyun/credentials-go/credentials"
)

var (
	RealNameAuthAccessKeyId     string
	RealNameAuthAccessKeySecret string
	RealNameAuthRegionId        string
	RealNameAuthEndpoint        string
)

func initRealNameAuthConfig() {
	RealNameAuthAccessKeyId = os.Getenv("ACCESS_KEY_ID")
	RealNameAuthAccessKeySecret = os.Getenv("ACCESS_KEY_SECRET")
	RealNameAuthRegionId = GetEnvOrDefaultString("REGION_ID", "cn-hangzhou")
	RealNameAuthEndpoint = GetEnvOrDefaultString("xxx", "cloudauth.aliyuncs.com")
}

func createRealNameAuthClient() (*cloudauth20190307.Client, error) {
	if RealNameAuthAccessKeyId == "" || RealNameAuthAccessKeySecret == "" {
		return nil, fmt.Errorf("阿里云实名认证凭证未配置")
	}

	credentialsConfig := &credential.Config{
		Type:            tea.String("access_key"),
		AccessKeyId:     tea.String(RealNameAuthAccessKeyId),
		AccessKeySecret: tea.String(RealNameAuthAccessKeySecret),
	}

	akCredential, err := credential.NewCredential(credentialsConfig)
	if err != nil {
		return nil, fmt.Errorf("创建凭据失败: %w", err)
	}

	config := &openapi.Config{
		Credential: akCredential,
		RegionId:   tea.String(RealNameAuthRegionId),
		Endpoint:   tea.String(RealNameAuthEndpoint),
	}

	client, err := cloudauth20190307.NewClient(config)
	if err != nil {
		return nil, fmt.Errorf("创建实名认证客户端失败: %w", err)
	}

	return client, nil
}

func createRealNameAuthClient20221125() (*cloudauth20221125.Client, error) {
	if RealNameAuthAccessKeyId == "" || RealNameAuthAccessKeySecret == "" {
		return nil, fmt.Errorf("阿里云实名认证凭证未配置")
	}

	credentialsConfig := &credential.Config{
		Type:            tea.String("access_key"),
		AccessKeyId:     tea.String(RealNameAuthAccessKeyId),
		AccessKeySecret: tea.String(RealNameAuthAccessKeySecret),
	}
	akCredential, err := credential.NewCredential(credentialsConfig)
	if err != nil {
		return nil, fmt.Errorf("创建凭据失败: %w", err)
	}

	config := &openapi.Config{
		Credential: akCredential,
		RegionId:   tea.String(RealNameAuthRegionId),
		Endpoint:   tea.String(RealNameAuthEndpoint),
	}

	client, err := cloudauth20221125.NewClient(config)
	if err != nil {
		return nil, fmt.Errorf("创建实名认证客户端失败: %w", err)
	}

	return client, nil
}

// VerifyIdentityCard 验证身份证二要素（姓名+身份证号）
func VerifyIdentityCard(name, idCard string) (bool, error) {
	initRealNameAuthConfig()

	if RealNameAuthAccessKeyId == "" || RealNameAuthAccessKeySecret == "" {
		return false, fmt.Errorf("阿里云实名认证凭证未配置")
	}

	client, err := createRealNameAuthClient()
	if err != nil {
		return false, fmt.Errorf("创建客户端失败: %v", err)
	}

	id2MetaVerifyRequest := &cloudauth20190307.Id2MetaVerifyRequest{
		ParamType:   tea.String("normal"),
		IdentifyNum: tea.String(idCard),
		UserName:    tea.String(name),
	}

	runtime := &util.RuntimeOptions{}

	resp, _err := client.Id2MetaVerifyWithOptions(id2MetaVerifyRequest, runtime)
	SysLog(fmt.Sprintf("username[%s] auth result-->%s", name, resp.String()))
	if _err != nil {
		return false, _err
	}
	if tea.StringValue(resp.Body.GetCode()) != "200" {
		return false, fmt.Errorf("username[%s],验证失败: %s", name, tea.StringValue(resp.Body.GetMessage()))
	}

	obj := resp.Body.GetResultObject()
	// 身份核验结果：
	//1：校验⼀致
	//2：校验不⼀致
	if *obj.BizCode != "1" {
		return false, fmt.Errorf("username[%s] 用户认证身份不一致", name)
	}

	return true, nil
}

// VerifyCompany 验证企业二要素（企业名称+统一社会信用代码/营业执照号）
/*
sceneCode 自定义场景code
merchantBizId 商户侧自定义的业务唯一标识
merchantUserId 商户侧用户ID
userAuthorization 是否获得用户授权 1：获得授权 0：未获得授权
infoVerifyType ENT_2META：二要素 企业名称 + 企业统一社会信用代码
licenseNo 统一社会信用代码
companyName 企业名称
*/
func VerifyCompany(sceneCode, merchantBizId, merchantUserId, userAuthorization, infoVerifyType, companyName, licenseNo string) (bool, error) {
	initRealNameAuthConfig()

	if RealNameAuthAccessKeyId == "" || RealNameAuthAccessKeySecret == "" {
		return false, fmt.Errorf("阿里云实名认证凭证未配置")
	}
	if userAuthorization == "" {
		userAuthorization = "1"
	}
	if infoVerifyType == "" {
		infoVerifyType = "ENT_2META"
	}

	client, err := createRealNameAuthClient20221125()
	if err != nil {
		return false, fmt.Errorf("创建客户端失败: %v", err)
	}

	entElementVerifyRequest := &cloudauth20221125.EntElementVerifyRequest{
		SceneCode:         tea.String(sceneCode),
		MerchantBizId:     tea.String(merchantBizId),
		MerchantUserId:    tea.String(merchantUserId),
		UserAuthorization: tea.String(userAuthorization),
		InfoVerifyType:    tea.String(infoVerifyType),
		LicenseNo:         tea.String(licenseNo),
		EntName:           tea.String(companyName),
	}
	runtime := &util.RuntimeOptions{}
	resp, _err := client.EntElementVerifyWithOptions(entElementVerifyRequest, runtime)
	SysLog(fmt.Sprintf("company[%s] auth result-->%s", companyName, resp.String()))
	if err != nil {
		return false, _err
	}
	if tea.StringValue(resp.Body.GetCode()) != "Success" {
		return false, fmt.Errorf("company[%s],验证失败: %s", companyName, tea.StringValue(resp.Body.GetMessage()))
	}

	obj := resp.Body.GetResult()
	// 身份核验结果：
	//1：校验⼀致
	//2：校验不⼀致
	//3: 未查得
	if *obj.BizCode != "1" {
		return false, fmt.Errorf("company[%s] 用户认证身份不一致", companyName)
	}
	return true, nil
}
