package common

import (
	"fmt"
	"math/rand"
	"sync"
	"time"
)

const (
	SMSCodeLength       = 6
	SMSCodeValidMinutes = 5
)

var (
	smsCodeMap   = make(map[string]smsCodeValue)
	smsCodeMutex sync.RWMutex
)

type smsCodeValue struct {
	code      string
	createdAt time.Time
}

func GenerateSMSCode() string {
	// 用当前时间做种子，保证每次运行不同
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	// Intn(900000) 生成 0~899999，加上 100000 就是 100000~999999
	code := rng.Intn(900000) + 100000
	return fmt.Sprintf("%06d", code) // 补0到6位，确保 000001 这种也能正确输出
}

func RegisterSMSCodeWithKey(phoneNumber string, code string) {
	if RedisEnabled {
		registerSMSCodeRedis(phoneNumber, code)
	} else {
		registerSMSCodeMemory(phoneNumber, code)
	}
}

func registerSMSCodeRedis(phoneNumber string, code string) {
	key := fmt.Sprintf("sms:code:%s", phoneNumber)
	SysLog(fmt.Sprintf("sms info -> key:%s code: %s", key, code))
	expiration := time.Duration(SMSCodeValidMinutes) * time.Minute

	err := RedisSet(key, code, expiration)
	if err != nil {
		SysError(fmt.Sprintf("保存短信验证码到Redis失败: %v，降级使用内存存储", err))
		registerSMSCodeMemory(phoneNumber, code)
		return
	}

	if DebugEnabled {
		SysLog(fmt.Sprintf("短信验证码已保存到Redis: 手机号=%s, 有效期=%d分钟", phoneNumber, SMSCodeValidMinutes))
	}
}

func registerSMSCodeMemory(phoneNumber string, code string) {
	smsCodeMutex.Lock()
	defer smsCodeMutex.Unlock()

	smsCodeMap[phoneNumber] = smsCodeValue{
		code:      code,
		createdAt: time.Now(),
	}

	cleanupExpiredSMSCodes()

	if DebugEnabled {
		SysLog(fmt.Sprintf("短信验证码已保存到内存: 手机号=%s", phoneNumber))
	}
}

func VerifySMSCodeWithKey(phoneNumber string, code string) bool {
	if RedisEnabled {
		return verifySMSCodeRedis(phoneNumber, code)
	}
	return verifySMSCodeMemory(phoneNumber, code)
}

func GetSMSCode(phoneNumber string) string {
	if RedisEnabled {
		return getSMSCodeRedis(phoneNumber)
	}
	return getSMSCodeMemory(phoneNumber)
}

func getSMSCodeRedis(phoneNumber string) string {
	key := fmt.Sprintf("sms:code:%s", phoneNumber)

	code, err := RedisGet(key)
	if err != nil {
		SysError(fmt.Sprintf("从Redis获取短信验证码失败: %v，降级使用内存存储", err))
		return getSMSCodeMemory(phoneNumber)
	}
	return code
}

func getSMSCodeMemory(phoneNumber string) string {
	smsCodeMutex.RLock()
	defer smsCodeMutex.RUnlock()

	value, exists := smsCodeMap[phoneNumber]
	if !exists {
		return ""
	}

	now := time.Now()
	if int(now.Sub(value.createdAt).Seconds()) >= SMSCodeValidMinutes*60 {
		return ""
	}

	return value.code
}

func verifySMSCodeRedis(phoneNumber string, code string) bool {
	key := fmt.Sprintf("sms:code:%s", phoneNumber)

	storedCode, err := RedisGet(key)
	if err != nil {
		if DebugEnabled {
			SysLog(fmt.Sprintf("从Redis获取短信验证码失败: %v，尝试内存存储", err))
		}
		return verifySMSCodeMemory(phoneNumber, code)
	}

	match := storedCode == code
	if match && DebugEnabled {
		SysLog(fmt.Sprintf("短信验证码验证成功: 手机号=%s", phoneNumber))
	}

	return match
}

func verifySMSCodeMemory(phoneNumber string, code string) bool {
	smsCodeMutex.RLock()
	defer smsCodeMutex.RUnlock()

	value, exists := smsCodeMap[phoneNumber]
	if !exists {
		return false
	}

	now := time.Now()
	if int(now.Sub(value.createdAt).Seconds()) >= SMSCodeValidMinutes*60 {
		return false
	}

	return value.code == code
}

func DeleteSMSCode(phoneNumber string) {
	if RedisEnabled {
		deleteSMSCodeRedis(phoneNumber)
	} else {
		deleteSMSCodeMemory(phoneNumber)
	}
}

func deleteSMSCodeRedis(phoneNumber string) {
	key := fmt.Sprintf("sms:code:%s", phoneNumber)

	err := RedisDel(key)
	if err != nil {
		SysError(fmt.Sprintf("删除Redis中的短信验证码失败: %v", err))
	}

	if DebugEnabled {
		SysLog(fmt.Sprintf("已从Redis删除短信验证码: 手机号=%s", phoneNumber))
	}
}

func deleteSMSCodeMemory(phoneNumber string) {
	smsCodeMutex.Lock()
	defer smsCodeMutex.Unlock()

	delete(smsCodeMap, phoneNumber)

	if DebugEnabled {
		SysLog(fmt.Sprintf("已从内存删除短信验证码: 手机号=%s", phoneNumber))
	}
}

func cleanupExpiredSMSCodes() {
	now := time.Now()
	for phoneNumber, value := range smsCodeMap {
		if int(now.Sub(value.createdAt).Seconds()) >= SMSCodeValidMinutes*60 {
			delete(smsCodeMap, phoneNumber)
		}
	}
}
