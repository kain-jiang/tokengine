# 按量付费与订阅消费的财务数据分离规则

## 概述

本文件记录按量付费（Pay-As-You-Go）和订阅套餐（Subscription）两种消费方式的财务数据分离规则，防止重复统计。

## 背景

系统支持两种消费方式：
1. **按量付费**：用户从钱包余额扣费，`billing_source = 'wallet'`
2. **订阅套餐**：用户通过订阅/兑换券获得额度，消费时 `billing_source = 'subscription'`

## 问题

在财务统计中，`logs` 表包含所有消费记录（无论付费方式）。如果不对订阅抵扣的记录进行过滤，会导致同一笔消费同时出现在：
- 按量付费报表（错误）
- 订阅套餐报表（正确）

造成财务数据重复计算。

## 解决方案

### 核心规则

**按量付费统计只选择 `billing_source = 'wallet'` 的记录。**

- `billing_source = 'wallet'` → 按量付费 ✅
- `billing_source = 'subscription'` → 订阅抵扣 ❌ 排除
- `billing_source` 不存在（`other` 为空或 `NULL`）→ 排除 ❌

### 实现

在 [`service/finance_dashboard.go`](../service/finance_dashboard.go) 中定义统一的过滤函数：

```go
// getPayAsYouGoFilter 生成"按量付费"的 WHERE 条件
// 只选择 billing_source = 'wallet' 的记录，其他所有情况都不计入
func getPayAsYouGoFilter() string {
    if common.UsingPostgreSQL {
        return "AND ((l.other)::jsonb->>'billing_source') = 'wallet'"
    } else if common.UsingSQLite {
        return "AND json_extract(l.other, '$.billing_source') = 'wallet'"
    } else {
        return "AND (l.other->>'$.billing_source') = 'wallet'"
    }
}
```

### 跨数据库兼容说明

| 数据库 | JSON 操作符 | 返回值类型 | 说明 |
|--------|------------|-----------|------|
| PostgreSQL | `(l.other)::jsonb->>'billing_source'` | 字符串 | TEXT 需先转为 jsonb |
| SQLite | `json_extract(l.other, '$.billing_source')` | 字符串 | 自动解包 JSON |
| MySQL | `l.other->>'$.billing_source'` | 字符串 | ->> 操作符自动解包 |

**注意**：MySQL 必须使用 `->>` 而非 `JSON_EXTRACT()`，因为 `JSON_EXTRACT()` 返回带双引号的 JSON 值（`"wallet"`），无法与 `'wallet'` 直接比较。

### 应用位置

以下函数必须应用 `getPayAsYouGoFilter()`：

1. [`GetPayAsYouGoByUser()`](../service/finance_dashboard.go) — 按量付费表格查询
2. [`GetRevenueManagementStats()`](../service/finance_dashboard.go) — 营收管理统计卡片
3. [`GetDashboardRevenueTrend()`](../service/finance_dashboard.go) — Dashboard 营收趋势图

### 数据流

```
用户发起 AI 请求
    ↓
系统检测付费方式
    ↓
┌──────────────────────────────────────────┐
│ billing_source = 'wallet'    → 钱包扣费  │
│ billing_source = 'subscription' → 订阅扣费│
└──────────────────────────────────────────┘
    ↓
写入 logs 表，other 字段包含 billing_source
    ↓
财务统计查询
    ↓
┌──────────────────────────────────────────┐
│ 按量付费报表：WHERE billing_source = 'wallet'  │
│ 订阅套餐报表：从 subscription_orders 表查询     │
└──────────────────────────────────────────┘
```

### 日志记录格式

**按量付费**：
```json
{
  "admin_info": {...},
  "billing_source": "wallet",
  "wallet_quota_deducted": 5760000
}
```

**订阅抵扣**：
```json
{
  "billing_source": "subscription",
  "subscription_id": 123,
  "subscription_pre_consumed": 2880000,
  "subscription_post_delta": 2880000,
  "wallet_quota_deducted": 0
}
```

## SQL 调试指南

如果按量付费金额为 0，请在数据库中执行以下 SQL 验证过滤条件是否正确：

### PostgreSQL

```sql
-- 1. 检查有 billing_source 字段的记录数量
SELECT COUNT(*) FROM logs WHERE type = 2 AND other LIKE '%billing_source%';

-- 2. 检查 billing_source = 'wallet' 的记录数量
SELECT COUNT(*) FROM logs WHERE type = 2 AND ((other)::jsonb->>'billing_source') = 'wallet';

-- 3. 检查 billing_source = 'subscription' 的记录数量
SELECT COUNT(*) FROM logs WHERE type = 2 AND ((other)::jsonb->>'billing_source') = 'subscription';

-- 4. 检查 other 字段为空的记录数量
SELECT COUNT(*) FROM logs WHERE type = 2 AND (other = '' OR other IS NULL);

-- 5. 查看一条有 billing_source 的记录样例
SELECT id, user_id, username, quota, other
FROM logs
WHERE type = 2 AND other LIKE '%billing_source%'
LIMIT 1;
```

### 预期结果

- 步骤 2 的结果应该 > 0（有按量付费记录）
- 步骤 3 的结果应该 > 0（有订阅抵扣记录）
- 步骤 5 的 `other` 字段应该包含 `"billing_source":"wallet"`

### 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 步骤 2 结果为 0 | `other` 字段是 TEXT 类型，无法用 `::jsonb` 转换 | 确认 `common.UsingPostgreSQL` 值是否正确 |
| 步骤 5 的 other 是空字符串 | 老记录没有 `billing_source` 字段 | 这些记录不会被计入，符合预期 |
| 步骤 2 结果 > 0 但报表为 0 | 过滤函数未被应用 | 检查代码是否重新编译部署 |

## 历史

- 2026-07-25: 发现按量付费报表包含订阅抵扣记录，修复 `getPayAsYouGoFilter()` 函数
- 2026-07-25: 从负向过滤（`!= 'subscription'`）改为正向过滤（`= 'wallet'`），语义更清晰
- 2026-07-25: 修复 MySQL JSON_EXTRACT 返回值带引号的问题，改用 `->>` 操作符
- 2026-07-25: 明确 `other` 为空或 `NULL` 的记录不计入按量付费
- 2026-07-25: 添加 SQL 调试指南
