# 平台赠送额度设计方案

## 1. 背景与问题

### 1.1 当前问题

当前实名认证赠送额度的实现（`model/real_name_auth.go:126-143`）：

```go
// 直接将赠送额度叠加到 user.quota
if err = IncreaseUserQuota(auth.UserId, quotaToAdd, true); err != nil {
    common.SysLog("实名认证成功，但赠送用户额度失败: " + err.Error())
    return
}
```

存在以下问题：

- **额度混淆**：赠送额度与用户充值额度混在 `user.quota` 字段中，无法区分
- **无法限制使用范围**：赠送额度可被用于所有模型，无法限制为仅可用某些模型
- **无法独立过期**：赠送额度永不过期，无法设置有效期
- **无法审计**：无法追溯赠送记录、赠送来源、赠送时间
- **同类问题**：签到赠送（`model/checkin.go:104`）、邀请赠送等也存在相同问题

### 1.2 设计目标

- 赠送额度与充值额度**完全隔离**
- 赠送额度可**限制适用模型**
- 赠送额度可**设置有效期**
- 赠送额度可**防重复发放**
- **最大化复用**现有订阅系统的计费链路，零新增表
- **系统设置管理**：赠送套餐配置入口在【系统设置 → 运营设置 → 额度设置】卡片，管理员通过「下发方式」下拉框选择赠送模式

---

## 2. 现有系统分析

### 2.1 订阅系统核心结构

```
SubscriptionPlan (套餐定义)
  ├── TotalAmount       — 额度总量
  ├── ApplicableModels  — 适用模型限制
  ├── DurationUnit/Value — 有效期
  ├── QuotaResetPeriod  — 额度重置周期
  ├── MaxPurchasePerUser — 每用户限购次数
  ├── PlanType          — "quota" 或 "tokens"
  ├── VisibleToUser     — 是否对用户可见
  └── Enabled           — 是否启用

UserSubscription (用户订阅实例)
  ├── AmountTotal/AmountUsed — 额度总量/已用量
  ├── StartTime/EndTime      — 有效期
  ├── Status                 — active/expired/cancelled
  ├── Source                 — order/admin/gift (gift 用于平台赠送)
  ├── TokensUsed/TokensLimit — tokens型套餐字段
  └── ApplicableModels       — 适用模型快照
```

### 2.2 计费链路

```
请求进入
  → NewBillingSession (billing_session.go:322)
    → 根据 BillingPreference 选择 subscription_first / wallet_first
    → trySubscription()
      → PreConsumeUserSubscription (subscription.go:996)
        → 遍历所有 active 订阅，按 end_time asc 排序
        → 检查 ApplicableModels 是否匹配当前模型
        → 检查额度是否充足
        → 创建 PreConsumeRecord（幂等）
        → 扣减 AmountUsed
      → 或 PreConsumeUserSubscriptionTokens (tokens型)
    → tryWallet() (回退)
      → DecreaseUserQuota
  → 请求完成
    → SettleBilling (billing.go:34)
      → PostConsumeUserSubscriptionDelta (调整差额)
    → 或 Refund (失败时退还)
```

### 2.3 关键发现

| 能力 | 是否已支持 | 说明 |
|------|-----------|------|
| 额度隔离 | ✅ | 订阅额度在 `UserSubscription` 表，与 `user.quota` 分离 |
| 模型限制 | ✅ | `ApplicableModels` 字段，逗号分隔模型名 |
| 有效期 | ✅ | `DurationUnit/DurationValue` 控制过期 |
| 防重复 | ✅ | `MaxPurchasePerUser` 限制 |
| 管理员绑定 | ✅ | `AdminBindSubscription` (source="admin") |
| 计费链路 | ✅ | `BillingSession` 自动处理订阅消费 |
| 前端展示 | ✅ | `UserSubscriptionsModal` 展示订阅列表 |
| 隐藏套餐 | ✅ | `VisibleToUser=false` 不在商店展示 |

**结论：现有订阅系统已具备「平台赠送」所需的全部能力，只需最小改动。**

---

## 3. 设计方案 — 系统设置模式

### 3.1 核心思路

赠送套餐配置入口在【系统设置 → 运营设置 → 额度设置】卡片。管理员通过「下发方式」下拉框选择赠送模式：

- **新用户初始额度**：原有逻辑，注册时直接发 Token 到 `user.quota`（`QuotaForNewUser` 配置项）
- **订阅套餐**：实名认证成功后绑定指定订阅套餐（`RealNameAuthGiftPlanId` 配置项），额度与充值隔离

管理员在订阅管理页面创建普通套餐（无需 `GiftTrigger` 字段），然后在系统设置中选择该套餐作为实名认证赠送套餐。

### 3.2 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    管理后台                               │
│  ┌───────────────────────────────────────────────────┐  │
│  │ 系统设置 → 运营设置 → 额度设置                       │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │ 下发方式下拉框                                │  │  │
│  │  │  • 新用户初始额度 → 显示 QuotaForNewUser 输入框│  │  │
│  │  │  • 订阅套餐      → 显示套餐选择下拉框          │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  │  套餐选择下拉框内容来自 /api/subscription/plans    │  │
│  │  保存的套餐 ID 写入 RealNameAuthGiftPlanId 配置项  │  │
│  └───────────────────────────────────────────────────┘  │
│        选择套餐并保存 → 赠送活动生效                       │
│        选择「不赠送」或切回「新用户初始额度」→ 取消         │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                    触发事件                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ 实名认证成功 │  │ 签到成功    │  │ 活动赠送    │     │
│  │ real_name_  │  │ checkin.go  │  │ (未来扩展)  │     │
│  │ auth.go     │  │             │  │             │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
│         │                │                │             │
│         └────────────────┼────────────────┘             │
│                          ↓                               │
│    BindGiftSubscription(userId, common.RealNameAuthGiftPlanId)│
│      → 读取 RealNameAuthGiftPlanId 配置项                │
│      → >0 → 绑定对应套餐                                 │
│      → =0 → 不赠送                                      │
│              source = "gift"                             │
│                          ↓                               │
│           CreateUserSubscriptionFromPlanTx               │
│              (已有函数，零改动)                           │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                    计费消费                               │
│  ┌───────────────────────────────────────────────────┐  │
│  │ NewBillingSession (subscription_first 默认)       │  │
│  │  → 遍历所有活跃订阅 (含赠送订阅)                    │  │
│  │  → ApplicableModels 过滤                           │  │
│  │  → 按 end_time asc 消费                            │  │
│  │  → 赠送订阅额度不足 → 回退到钱包                    │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 3.3 改动清单

#### 3.3.1 Model 层 — `model/subscription.go`

**保留 `BindGiftSubscription` 函数**（source 标记为 "gift"）：

```go
// BindGiftSubscription 为用户绑定赠送订阅（无需支付）。
// source 标记为 "gift"，用于区分平台赠送与付费订阅。
// 复用 CreateUserSubscriptionFromPlanTx，MaxPurchasePerUser 限制自动生效。
func BindGiftSubscription(userId int, planId int) (*UserSubscription, error) {
    if userId <= 0 || planId <= 0 {
        return nil, errors.New("invalid userId or planId")
    }
    plan, err := GetSubscriptionPlanById(planId)
    if err != nil {
        return nil, err
    }
    if !plan.Enabled {
        return nil, errors.New("gift plan is disabled")
    }
    var sub *UserSubscription
    err = DB.Transaction(func(tx *gorm.DB) error {
        sub, err = CreateUserSubscriptionFromPlanTx(tx, userId, "", plan, "gift")
        return err
    })
    if err != nil {
        return nil, err
    }
    return sub, nil
}
```

> `CreateUserSubscriptionFromPlanTx` 内部已处理 `MaxPurchasePerUser` 限制，重复赠送会被自动拦截。

**已删除**（v2 重构）：
- `GiftTrigger*` 常量组（`GiftTriggerRealNameAuth`、`GiftTriggerCheckin`、`GiftTriggerInvite`、`GiftTriggerRegister`）
- `SubscriptionPlan.GiftTrigger` 字段
- `GetGiftPlanByTrigger` 函数
- `BindGiftSubscriptionByTrigger` 函数

#### 3.3.2 Model 层 — `model/real_name_auth.go`

**改造 `ToAuth` 函数的赠送逻辑**：

改造前：
```go
// 直接 IncreaseUserQuota，额度混入 user.quota
if err = IncreaseUserQuota(auth.UserId, quotaToAdd, true); err != nil { ... }
```

改造后：
```go
// 实名认证成功后，根据系统设置绑定的赠送订阅套餐发放额度
// 配置入口：系统设置 → 运营设置 → 额度设置 → 下发方式 → 订阅套餐 → 选择套餐
// 套餐 source 标记为 "gift"，额度与充值隔离，可限制模型、可过期
if common.RealNameAuthGiftPlanId > 0 {
    sub, bindErr := BindGiftSubscription(auth.UserId, common.RealNameAuthGiftPlanId)
    if bindErr != nil {
        common.SysLog("实名认证赠送订阅失败: " + bindErr.Error())
    } else if sub != nil {
        common.SysLog(fmt.Sprintf("实名认证成功，赠送用户【%d】订阅套餐", auth.UserId))
        RecordLog(auth.UserId, LogTypeManage,
            fmt.Sprintf("实名认证成功，系统赠送订阅套餐（额度 %s）", logger.LogQuota(int(sub.AmountTotal))))
    }
}
```

**已移除**：原有 2 美元 `IncreaseUserQuota` 硬编码逻辑及 `decimal`、`operation_setting` import。

#### 3.3.3 配置项 — `common/constants.go` + `model/option.go`

新增 `RealNameAuthGiftPlanId` 配置项：

```go
// common/constants.go
// RealNameAuthGiftPlanId 实名认证成功后绑定的赠送订阅套餐 ID（0 = 不赠送）
var RealNameAuthGiftPlanId = 0
```

```go
// model/option.go — OptionMap 初始化
common.OptionMap["RealNameAuthGiftPlanId"] = strconv.Itoa(common.RealNameAuthGiftPlanId)

// model/option.go — updateOptionValue switch
case "RealNameAuthGiftPlanId":
    common.RealNameAuthGiftPlanId, _ = strconv.Atoi(value)
```

#### 3.3.4 Controller 层 — `controller/subscription.go`

**已删除**：updateMap 中的 `gift_trigger` 字段（v2 重构移除）。

#### 3.3.5 Service 层 — 零改动

`BillingSession`、`FundingSource`、`SubscriptionFunding`、`PreConsumeUserSubscription` 等全部复用，无需任何修改。

#### 3.3.6 前端

| 文件 | 改动 | 说明 |
|------|------|------|
| `AddEditSubscriptionModal.jsx` | 删除「赠送活动」下拉框 | v2 重构移除 gift_trigger 字段及相关 UI |
| `UserSubscriptionsModal.jsx` | 不变 | source='gift' 仍显示「赠送」标签 |
| `OperationSetting.jsx` | 新增 | inputs state 添加 `RealNameAuthGiftPlanId` |
| `SettingsCreditLimit.jsx` | 新增 | 「下发方式」下拉框 + 条件渲染「新用户初始额度」输入框或「实名认证赠送套餐」下拉框 |

**额度设置卡片 UI 结构**：

```
┌───────────────────────────────────────────────────┐
│ 额度设置                                           │
│                                                    │
│ 下发方式：[新用户初始额度 ▼]                        │
│           选择「新用户初始额度」时下方输入框配置     │
│           注册赠送 Token；选择「订阅套餐」时下方     │
│           下拉框配置实名认证成功后赠送的订阅套餐     │
│                                                    │
│ ┌─ 新用户初始额度模式 ──────────────────────────┐  │
│ │ 新用户初始额度：[____0____] Token              │  │
│ └───────────────────────────────────────────────┘  │
│ ┌─ 订阅套餐模式 ────────────────────────────────┐  │
│ │ 实名认证赠送套餐：[不赠送 ▼]                   │  │
│ │ 用户实名认证成功后自动绑定该订阅套餐            │  │
│ └───────────────────────────────────────────────┘  │
│                                                    │
│ 请求预扣费额度：[____500____] Token                │
│ 邀请新用户奖励额度：[____2000___] Token             │
│ 新用户使用邀请码奖励额度：[___1000___] Token         │
│ 对免费模型启用预消耗：[开关]                        │
│                                                    │
│ [保存额度设置]                                      │
└───────────────────────────────────────────────────┘
```

**前端实现要点**：
- `giftMode` 为本地 UI state（`'new_user'` | `'real_name_auth'`），不持久化，仅控制展示哪个设置项
- 「下发方式」下拉框使用独立 `Select` 组件（不在 Form 管理内），避免 Form `values` 覆盖默认值
- 刷新页面时根据 `RealNameAuthGiftPlanId > 0` 推断 `giftMode` 回显
- 套餐下拉框 `optionList` 的 value 使用字符串类型，与后端返回的字符串值匹配
- `QuotaForNewUser` 和 `RealNameAuthGiftPlanId` 独立保存在 options 表，互不影响

### 3.4 赠送套餐配置示例

管理后台配置流程：

1. **订阅管理页面**创建普通套餐（无需设置 GiftTrigger）：

| 字段 | 值 | 说明 |
|------|-----|------|
| `Title` | `"实名认证赠送"` | 标识 |
| `Subtitle` | `"实名认证成功后自动发放"` | 描述 |
| `PriceAmount` | `0` | 免费套餐 |
| `Currency` | `"USD"` | — |
| `PlanType` | `"quota"` | 额度型 |
| `TotalAmount` | `2 * QuotaPerUnit` | 2美元对应quota值 |
| `ApplicableModels` | `"gpt-4o,gpt-4o-mini,claude-3-5-sonnet"` | **限制可用模型** |
| `DurationUnit` | `"year"` | — |
| `DurationValue` | `1` | 1年有效 |
| `QuotaResetPeriod` | `"never"` | 一次性，不重置 |
| `MaxPurchasePerUser` | `1` | 每用户仅限1次 |
| `VisibleToUser` | `false` | **不在订阅商店展示** |
| `Enabled` | `true` | 启用 |

2. **系统设置 → 运营设置 → 额度设置**：
   - 「下发方式」下拉框选择「订阅套餐」
   - 「实名认证赠送套餐」下拉框选择刚创建的「实名认证赠送」套餐
   - 点击「保存额度设置」

### 3.5 计费消费流程（复用现有）

```
用户请求 (model=gpt-4o)
  → NewBillingSession (subscription_first)
    → HasActiveUserSubscription? YES
    → trySubscription()
      → PreConsumeUserSubscription
        → 查询所有 active 订阅，按 end_time asc 排序
        → 遍历订阅:
          [1] 实名认证赠送订阅 (end_time=2027-08-03)
              ├── ApplicableModels 包含 "gpt-4o"? YES
              ├── AmountTotal - AmountUsed >= 需要额度? YES
              ├── 创建 PreConsumeRecord
              └── 扣减 AmountUsed → 返回成功
          [2] 付费订阅 (end_time=2026-12-31) — 未到达
    → 返回 BillingSession (funding=SubscriptionFunding)
  → 请求处理...
  → SettleBilling
    → PostConsumeUserSubscriptionDelta (调整差额)
  → 完成

用户请求 (model=gpt-4o, 赠送额度已用完)
  → PreConsumeUserSubscription
    → [1] 实名认证赠送订阅: AmountTotal - AmountUsed < 需要 → skip
    → [2] 付费订阅: ApplicableModels 为空(不限模型) → 匹配
    → 使用付费订阅额度

用户请求 (model=dall-e-3, 赠送订阅不包含此模型)
  → PreConsumeUserSubscription
    → [1] 实名认证赠送订阅: ApplicableModels 不含 "dall-e-3" → skip
    → [2] 付费订阅: 匹配 → 使用付费订阅
```

### 3.6 消费优先级说明

`PreConsumeUserSubscription` 按 `end_time asc` 排序消费，即**先到期的先消费**。

| 场景 | 行为 |
|------|------|
| 赠送套餐有效期 < 付费订阅 | 赠送额度优先消费 ✅ |
| 赠送套餐有效期 > 付费订阅 | 付费订阅优先消费 |
| 赠送套餐有效期 = 付费订阅 | 按 `id asc` 消费 |

**建议**：如果希望赠送额度**总是优先消费**，设置赠送套餐有效期略短于付费订阅，或在未来增加 `priority` 字段。

---

## 4. 数据库变更

### 4.1 无新增表

完全复用 `subscription_plans` 和 `user_subscriptions` 表。

### 4.2 Schema 变更

**v2 重构移除**：`SubscriptionPlan.GiftTrigger` 字段已从 Go 结构体中删除。

> 注意：`subscription_plans` 表中的 `gift_trigger` 列不会被 GORM AutoMigrate 自动删除（GORM 只加不删，SQLite 不支持 DROP COLUMN）。该列残留无害，GORM 读写时会忽略未映射的列。如需清理可在 MySQL/PostgreSQL 上手动执行 `ALTER TABLE subscription_plans DROP COLUMN gift_trigger;`。

`UserSubscription.Source` 字段已存在，类型为 `varchar(32)`，`"gift"` 值无需修改 Schema。

### 4.3 配置项

`RealNameAuthGiftPlanId` 存储在 `options` 表中，GORM AutoMigrate 无需额外 Schema 变更。

---

## 5. 改动文件清单

| 文件 | 改动类型 | 改动内容 |
|------|---------|---------|
| `model/subscription.go` | 删除 | GiftTrigger 常量组、SubscriptionPlan.GiftTrigger 字段、GetGiftPlanByTrigger、BindGiftSubscriptionByTrigger |
| `model/subscription.go` | 保留 | BindGiftSubscription 函数（source='gift'） |
| `model/real_name_auth.go` | 修改 | 移除 2 美元 Token 硬编码逻辑，改用 BindGiftSubscription 绑定配置套餐 |
| `model/option.go` | 新增 | RealNameAuthGiftPlanId 配置项初始化和更新 |
| `common/constants.go` | 新增 | RealNameAuthGiftPlanId 变量 |
| `controller/subscription.go` | 删除 | updateMap 中的 gift_trigger |
| `web/src/components/table/subscriptions/modals/AddEditSubscriptionModal.jsx` | 删除 | gift_trigger 相关表单字段和 UI |
| `web/src/components/table/users/modals/UserSubscriptionsModal.jsx` | 不变 | 保留 source='gift' 的赠送标签展示 |
| `web/src/components/settings/OperationSetting.jsx` | 新增 | inputs state 添加 RealNameAuthGiftPlanId |
| `web/src/pages/Setting/Operation/SettingsCreditLimit.jsx` | 新增 | 「下发方式」下拉框 + 条件渲染「新用户初始额度」输入框或「实名认证赠送套餐」下拉框 |

**Service 层、计费链路：零改动。**

---

## 6. 扩展性

### 6.1 签到赠送改造

`model/checkin.go:104` 当前也直接操作 `user.quota`，后续可用同样方式改造：

```go
// 改造前
tx.Model(&User{}).Where("id = ?", userId).
    Update("quota", gorm.Expr("quota + ?", quotaAwarded))

// 改造后（需新增 CheckinGiftPlanId 配置项）
if common.CheckinGiftPlanId > 0 {
    sub, err := BindGiftSubscription(userId, common.CheckinGiftPlanId)
    if err != nil {
        common.SysLog("签到赠送订阅失败: " + err.Error())
    } else if sub != nil {
        // 赠送成功
    }
}
```

管理员只需在系统设置中配置签到赠送套餐即可激活签到赠送活动。

### 6.2 其他赠送场景

| 场景 | 配置项 | 实现方式 |
|------|--------|---------|
| 实名认证赠送 | `RealNameAuthGiftPlanId` | 已实现，`ToAuth` 中调用 `BindGiftSubscription` |
| 签到赠送 | `CheckinGiftPlanId`（未来） | `UserCheckin` 中调用 `BindGiftSubscription` |
| 邀请赠送 | `InviteGiftPlanId`（未来） | `inviteUser` 中调用 `BindGiftSubscription` |
| 新用户注册赠送 | `QuotaForNewUser`（已有） | 注册时直接发 Token 到 `user.quota` |
| 运营活动赠送 | — | 管理员通过 `AdminBindSubscription` 手动绑定 |
| 补偿赠送 | — | 管理员通过用户订阅管理界面手动绑定 |

新增赠送场景只需：
1. 在 `common/constants.go` + `model/option.go` 新增对应配置项
2. 代码中调用 `BindGiftSubscription(userId, common.XxxGiftPlanId)`
3. 前端额度设置卡片新增对应配置 UI

### 6.3 赠送额度审计

通过查询 `user_subscriptions` 表 `WHERE source = 'gift'` 即可获取所有赠送记录，包含：

- 赠送套餐（`PlanId` → `SubscriptionPlan.Title`）
- 赠送额度（`AmountTotal`）
- 已用额度（`AmountUsed`）
- 赠送时间（`StartTime`）
- 过期时间（`EndTime`）
- 状态（`Status`）

---

## 7. 回滚方案

### 7.1 代码回滚

- `model/real_name_auth.go`：恢复 `IncreaseUserQuota` 调用（需恢复 `decimal`、`operation_setting` import）
- `model/subscription.go`：恢复 `GiftTrigger` 字段和相关函数（如需活动模式）
- `controller/subscription.go`：恢复 updateMap 中的 `gift_trigger`
- 前端：恢复 `AddEditSubscriptionModal.jsx` 的「赠送活动」下拉框，移除 `SettingsCreditLimit.jsx` 的「下发方式」下拉框

### 7.2 数据回滚

- 赠送套餐 Plan 记录可保留或删除（不影响已有订阅）
- 已创建的 `UserSubscription` 记录 `source="gift"` 可通过 SQL 批量清理：
  ```sql
  DELETE FROM user_subscriptions WHERE source = 'gift';
  ```
- `gift_trigger` 列可保留（不影响功能）或通过数据库命令删除
- `RealNameAuthGiftPlanId` 配置项可保留（值为 0 即不赠送）

### 7.3 活动取消

- 管理员在【系统设置 → 运营设置 → 额度设置】中将「下发方式」切回「新用户初始额度」
- 或将「实名认证赠送套餐」下拉框选择「不赠送」（value=0）并保存
- 无需修改代码或禁用套餐

---

## 8. 验收标准

- [x] 订阅管理页面不再显示「赠送活动」下拉框
- [x] 用户订阅列表仍展示 source='gift' 的「赠送」标签（与之前一致）
- [x] 系统设置 → 运营设置 → 额度设置卡片显示「下发方式」下拉框
- [x] 选择「新用户初始额度」时显示 Token 输入框，保存后注册新用户获得对应 Token
- [x] 选择「订阅套餐」时显示订阅套餐下拉框，选择套餐并保存后，实名认证成功时自动绑定该套餐
- [x] 未选择套餐（值为 0）时，实名认证成功不赠送任何额度
- [x] 刷新页面后「下发方式」和「实名认证赠送套餐」正确回显已保存的配置
- [x] 赠送额度在 `UserSubscription` 表中独立记录，不叠加到 `user.quota`
- [x] 请求时赠送额度按 `ApplicableModels` 限制消费
- [x] 赠送额度用完后，自动回退到钱包额度或付费订阅
- [x] 重复实名认证不会重复赠送（`MaxPurchasePerUser=1` 拦截）

---

## 9. 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-08-03 | 活动模式：SubscriptionPlan 新增 GiftTrigger 字段，订阅管理页面配置赠送活动 |
| v2.0 | 2026-08-03 | 系统设置模式：移除 GiftTrigger 字段，配置入口迁移至【系统设置 → 运营设置 → 额度设置】卡片，新增 RealNameAuthGiftPlanId 配置项，移除 2 美元 Token 硬编码逻辑 |
