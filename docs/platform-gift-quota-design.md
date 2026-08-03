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
- **活动模式管理**：赠送套餐即活动，创建/启用即生效，删除/禁用即取消，无需额外系统配置

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
  ├── GiftTrigger       — 赠送活动触发场景 (新增)
  └── Enabled           — 是否启用

UserSubscription (用户订阅实例)
  ├── AmountTotal/AmountUsed — 额度总量/已用量
  ├── StartTime/EndTime      — 有效期
  ├── Status                 — active/expired/cancelled
  ├── Source                 — order/admin/gift (新增 gift)
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

## 3. 设计方案 — 活动模式

### 3.1 核心思路

赠送套餐即活动。`SubscriptionPlan` 新增 `GiftTrigger` 字段标识触发场景：

- 管理员创建套餐并设置 `GiftTrigger = "real_name_auth"` → **活动生效**
- 管理员禁用或删除该套餐 → **活动取消**
- 代码触发时按 `GiftTrigger` 查询启用的套餐 → 有就送，没有就跳过

**无需系统配置项**，完全由套餐的创建/启用/禁用驱动。

### 3.2 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    管理后台                               │
│  ┌───────────────────────────────────────────────────┐  │
│  │ 订阅管理页面创建/编辑赠送套餐                       │  │
│  │  • PriceAmount = 0 (免费)                         │  │
│  │  • VisibleToUser = false (不在商店展示)            │  │
│  │  • ApplicableModels = 限制可用模型                 │  │
│  │  • MaxPurchasePerUser = 1 (防重复)                 │  │
│  │  • DurationUnit/Value = 有效期                     │  │
│  │  • GiftTrigger = "real_name_auth" (赠送活动)       │  │
│  │  • Enabled = true (启用=活动生效)                  │  │
│  └───────────────────────────────────────────────────┘  │
│        创建/启用 → 活动生效                                │
│        禁用/删除 → 活动取消                                │
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
│    BindGiftSubscriptionByTrigger(userId, trigger)        │
│      → GetGiftPlanByTrigger(trigger)                     │
│      → 查询 gift_trigger=? AND enabled=true 的套餐       │
│      → 有套餐 → BindGiftSubscription(userId, planId)     │
│      → 无套餐 → 返回 nil (无活动，跳过)                   │
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

**GiftTrigger 常量定义**：

```go
// Gift trigger scenarios
const (
    GiftTriggerRealNameAuth = "real_name_auth"
    GiftTriggerCheckin       = "checkin"
    GiftTriggerInvite        = "invite"
    GiftTriggerRegister      = "register"
)
```

**SubscriptionPlan 新增 `GiftTrigger` 字段**：

```go
// GiftTrigger 标识赠送套餐的触发场景（空字符串=非赠送套餐）
// 使用上述常量赋值，便于全局搜索排查
GiftTrigger string `json:"gift_trigger" gorm:"type:varchar(64);default:''"`
```

**新增查询和绑定函数**：

```go
// GetGiftPlanByTrigger 查询指定触发场景的启用中赠送套餐。
// 返回第一个匹配的套餐，如果没有返回 nil, nil。
func GetGiftPlanByTrigger(trigger string) (*SubscriptionPlan, error) {
    if trigger == "" {
        return nil, nil
    }
    var plan SubscriptionPlan
    err := DB.Where("gift_trigger = ? AND enabled = ?", trigger, true).First(&plan).Error
    if err != nil {
        if errors.Is(err, gorm.ErrRecordNotFound) {
            return nil, nil
        }
        return nil, err
    }
    return &plan, nil
}

// BindGiftSubscriptionByTrigger 按触发场景查找赠送套餐并绑定给用户。
// 如果没有对应活动套餐，返回 nil, nil（不报错，调用方应视为"无活动"而非失败）。
func BindGiftSubscriptionByTrigger(userId int, trigger string) (*UserSubscription, error) {
    plan, err := GetGiftPlanByTrigger(trigger)
    if err != nil {
        return nil, err
    }
    if plan == nil {
        return nil, nil
    }
    return BindGiftSubscription(userId, plan.Id)
}

// BindGiftSubscription 为用户绑定赠送订阅（无需支付）。
// source 标记为 "gift"，用于区分平台赠送与付费订阅。
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

#### 3.3.2 Model 层 — `model/real_name_auth.go`

**改造 `ToAuth` 函数的赠送逻辑**：

改造前：
```go
// 直接 IncreaseUserQuota，额度混入 user.quota
if err = IncreaseUserQuota(auth.UserId, quotaToAdd, true); err != nil { ... }
```

改造后：
```go
// 通过赠送活动套餐发放额度（额度与充值隔离，可限制模型、可过期）
// 管理员创建 GiftTrigger=GiftTriggerRealNameAuth 的套餐即激活活动，删除/禁用即取消
sub, bindErr := BindGiftSubscriptionByTrigger(auth.UserId, GiftTriggerRealNameAuth)
if bindErr != nil {
    common.SysLog("实名认证赠送订阅失败: " + bindErr.Error())
} else if sub != nil {
    common.SysLog(fmt.Sprintf("实名认证成功，赠送用户【%d】订阅套餐", auth.UserId))
    RecordLog(auth.UserId, LogTypeManage,
        fmt.Sprintf("实名认证成功，系统赠送订阅套餐（额度 %s）",
            logger.LogQuota(int(sub.AmountTotal))))
    return
}

// 无赠送活动或赠送失败时，使用旧的 IncreaseUserQuota 逻辑（向后兼容）
```

**兼容性**：无赠送活动套餐时，自动回退到原有 `IncreaseUserQuota` 逻辑，不影响现有行为。

#### 3.3.3 Controller 层 — `controller/subscription.go`

更新套餐的 `updateMap` 中新增 `gift_trigger` 字段：

```go
"gift_trigger": req.Plan.GiftTrigger,
```

创建套餐时直接使用 `req.Plan` 整体写入，`GiftTrigger` 自动包含。

#### 3.3.4 Service 层 — 零改动

`BillingSession`、`FundingSource`、`SubscriptionFunding`、`PreConsumeUserSubscription` 等全部复用，无需任何修改。

#### 3.3.5 前端

| 文件 | 改动 | 说明 |
|------|------|------|
| `AddEditSubscriptionModal.jsx` | 新增「赠送活动」下拉选择 | 管理员创建/编辑套餐时选择触发场景 |
| `UserSubscriptionsModal.jsx` | `source="gift"` 显示「赠送」标签 | 增强可读性 |

**无需系统设置页面改动**，赠送活动完全在订阅管理页面配置。

### 3.4 赠送套餐配置示例

管理后台在订阅管理页面创建 `SubscriptionPlan`：

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
| `GiftTrigger` | `"real_name_auth"` | **赠送活动：实名认证** |
| `Enabled` | `true` | 启用=活动生效 |

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

`SubscriptionPlan` 新增 `GiftTrigger` 字段，GORM `AutoMigrate` 自动添加列：

```sql
ALTER TABLE subscription_plans ADD COLUMN gift_trigger VARCHAR(64) DEFAULT '';
```

`UserSubscription.Source` 字段已存在，类型为 `varchar(32)`，`"gift"` 值无需修改 Schema。

### 4.3 无需数据初始化

活动模式不依赖 `options` 配置表，无需插入配置项。

---

## 5. 改动文件清单

| 文件 | 改动类型 | 改动内容 |
|------|---------|---------|
| `model/subscription.go` | 新增常量 | `GiftTriggerRealNameAuth`、`GiftTriggerCheckin`、`GiftTriggerInvite`、`GiftTriggerRegister` |
| `model/subscription.go` | 新增字段 | `SubscriptionPlan.GiftTrigger` |
| `model/subscription.go` | 新增函数 | `GetGiftPlanByTrigger`、`BindGiftSubscriptionByTrigger`、`BindGiftSubscription` |
| `model/real_name_auth.go` | 修改 | `ToAuth` 中赠送逻辑改用 `BindGiftSubscriptionByTrigger`，兼容旧逻辑 |
| `controller/subscription.go` | 修改 | updateMap 新增 `gift_trigger` 字段 |
| `web/src/components/table/subscriptions/modals/AddEditSubscriptionModal.jsx` | 新增 | 「赠送活动」下拉选择 |
| `web/src/components/table/users/modals/UserSubscriptionsModal.jsx` | 微调 | `source="gift"` 显示赠送标签 |

**Service 层、计费链路：零改动。**

---

## 6. 扩展性

### 6.1 签到赠送改造

`model/checkin.go:104` 当前也直接操作 `user.quota`，后续可用同样方式改造：

```go
// 改造前
tx.Model(&User{}).Where("id = ?", userId).
    Update("quota", gorm.Expr("quota + ?", quotaAwarded))

// 改造后
sub, err := BindGiftSubscriptionByTrigger(userId, GiftTriggerCheckin)
if err != nil {
    common.SysLog("签到赠送订阅失败: " + err.Error())
} else if sub != nil {
    // 赠送成功
}
```

管理员只需在订阅管理页面创建 `GiftTrigger = GiftTriggerCheckin` 的套餐即可激活签到赠送活动。

### 6.2 其他赠送场景

| 场景 | 常量 | GiftTrigger 值 | 实现方式 |
|------|------|----------------|---------|
| 实名认证赠送 | `GiftTriggerRealNameAuth` | `real_name_auth` | 已实现，`ToAuth` 中调用 |
| 签到赠送 | `GiftTriggerCheckin` | `checkin` | `UserCheckin` 中调用 `BindGiftSubscriptionByTrigger` |
| 邀请赠送 | `GiftTriggerInvite` | `invite` | `inviteUser` 中调用 |
| 新用户注册赠送 | `GiftTriggerRegister` | `register` | `Insert` 中调用 |
| 运营活动赠送 | — | 手动操作 | 管理员通过 `AdminBindSubscription` 手动绑定 |
| 补偿赠送 | — | 无 trigger | 管理员通过用户订阅管理界面手动绑定 |

新增赠送场景只需：
1. 在 `model/subscription.go` 常量组中新增 `GiftTriggerXxx = "xxx"`
2. 代码中调用 `BindGiftSubscriptionByTrigger(userId, GiftTriggerXxx)`
3. 前端 `AddEditSubscriptionModal.jsx` 的下拉选项中添加对应选项

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

- `model/real_name_auth.go`：恢复 `IncreaseUserQuota` 调用（旧逻辑仍保留在代码中）
- `model/subscription.go`：删除 `GiftTrigger` 字段和相关函数
- `controller/subscription.go`：删除 updateMap 中的 `gift_trigger`
- 前端：删除「赠送活动」下拉选择

### 7.2 数据回滚

- 赠送套餐 Plan 记录可保留或删除（不影响已有订阅）
- 已创建的 `UserSubscription` 记录 `source="gift"` 可通过 SQL 批量清理：
  ```sql
  DELETE FROM user_subscriptions WHERE source = 'gift';
  ```
- `gift_trigger` 列可保留（不影响功能）或通过数据库命令删除

### 7.3 活动取消

- 管理员在订阅管理页面**禁用**或**删除**对应赠送套餐 → 活动立即取消
- 无需修改代码或系统配置

---

## 8. 验收标准

- [ ] 管理后台订阅管理页面可创建赠送套餐，「赠送活动」下拉可选「实名认证」
- [ ] 赠送套餐 `VisibleToUser=false` 时不在用户端订阅商店展示
- [ ] 实名认证成功后，自动查找 `gift_trigger="real_name_auth" AND enabled=true` 的套餐
- [ ] 找到赠送套餐时，自动创建 `source="gift"` 的 `UserSubscription`
- [ ] 未找到赠送套餐时，回退到原有 `IncreaseUserQuota` 逻辑（向后兼容）
- [ ] 赠送额度在 `UserSubscription` 表中独立记录，不叠加到 `user.quota`
- [ ] 请求时赠送额度按 `ApplicableModels` 限制消费
- [ ] 赠送额度用完后，自动回退到钱包额度或付费订阅
- [ ] 重复实名认证不会重复赠送（`MaxPurchasePerUser=1` 拦截）
- [ ] 前端用户订阅列表展示赠送记录，`source` 显示为「赠送」标签
- [ ] 管理员禁用赠送套餐后，新用户实名认证不再赠送（回退旧逻辑）
