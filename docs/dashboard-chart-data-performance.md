# 大屏图表数据接口性能优化方案

## 概述

本文档记录 `/api/dashboard/board/chart-data` 接口响应慢的根因分析与优化方案。

## 背景

大屏数据接口在消费趋势展示中响应缓慢。该接口由 `GetDashboardBoardChartData`
（`controller/dashboard_board.go`）串联调用 6 个 `model` 层的聚合函数，
其中 3 个存在严重的性能问题。

## 问题分析

### 接口调用链路

`GetDashboardBoardChartData` 依次调用：

| 函数 | 聚合维度 | 是否有性能问题 |
|---|---|---|
| `GetQuotaDistribution` | 小时 × 模型 | ✅ 有（全量加载） |
| `GetCallTrend` | 天 × 模型 | ✅ 有（全量加载） |
| `GetCallDistribution` | 模型（饼图） | ❌ 无（SQL 聚合） |
| `GetCallRank` | 模型排行 | ❌ 无（SQL 聚合） |
| `GetUserQuotaRank` | 用户排行 | ❌ 无（SQL 聚合） |
| `GetUserQuotaTrend` | 天 × 用户 | ✅ 有（全量加载 + 重复聚合） |

### 根因

三个慢函数使用相同的问题写法：

```go
LOG_DB.Model(&Log{}).
    Where("created_at >= ? AND created_at <= ? AND type = ?", start, end, LogTypeConsume).
    Order("created_at ASC").
    Find(&logs) // ← 把整个时间窗口的日志全量加载进内存，且无 LIMIT
```

然后才在 Go 代码里用 map 做分组、求和、计数。

**主要代价：**

1. **DB 扫描与传输**：默认查询近 7 天数据，对一个繁忙网关而言窗口内日志可达
   几十万到上百万行，全部通过网络从数据库拉到应用内存。
2. **内存与 GC 压力**：`Find(&logs)` 一次性分配并填充整个 `[]Log` 切片，
   产生大量临时对象，触发频繁 GC。
3. **无谓字段读取**：`Find` 会把 `Log` 全字段（含 `Content`、`Other` 等大字段）
   一并读取，进一步放大 I/O 与内存。
4. **重复聚合**：`GetUserQuotaTrend` 内部又调用了一次 `GetUserQuotaRank`，
   同一次请求中把「用户总消耗排行」完整查询跑了两遍。

对比之下，`GetCallDistribution` / `GetCallRank` / `GetUserQuotaRank` 已经把聚合下推
到 SQL（`GROUP BY` + `COUNT()/SUM()`），是高效实现。
`GetHourlyTrend` / `GetDailyTrend` 采用「按桶逐次查询」的方式，同样偏低效。

## 优化方案

### 核心思路

把聚合下推到 SQL：`GROUP BY` + `COUNT()/SUM()`，让跨出数据库的行数从
「整个窗口的日志（百万级）」降到「聚合结果（几十到几百行）」。
同时消除 `GetUserQuotaTrend` 对 `GetUserQuotaRank` 的重复调用。

### 跨数据库兼容性（重要）

分桶统一使用 `created_at`（int64 unix 时间戳）的**纯整数运算**：

- 小时桶：`created_at / 3600`
- 天桶：`created_at / 86400`

该写法在 SQLite / MySQL / PostgreSQL 三库行为一致，避免使用
`strftime`、`DATE_FORMAT`、`to_char` 等各库不一致的日期函数（符合项目 Rule 2）。

桶的起始时间再由 Go 侧换算回时间字符串：
`time.Unix(dayBucket*86400, 0).Format("2006-01-02")`。

### 逐函数修改

#### 1. `GetQuotaDistribution`（按小时 × 模型聚合消耗）

由「全量加载 + Go 分组」改为「SQL 按小时桶 + 模型分组求和」：

```go
func GetQuotaDistribution(startTime, endTime int64) []QuotaDistributionData {
	var rows []struct {
		HourBucket int64
		ModelName  string
		Quota      int64
	}
	LOG_DB.Model(&Log{}).
		Select("created_at / 3600 AS hour_bucket, model_name, SUM(quota) AS quota").
		Where("created_at >= ? AND created_at <= ? AND type = ?", startTime, endTime, LogTypeConsume).
		Where("quota > 0").
		Group("created_at / 3600, model_name").
		Scan(&rows)

	hourSumMap := make(map[int64]int64)
	for _, r := range rows {
		hourSumMap[r.HourBucket] += r.Quota
	}

	results := make([]QuotaDistributionData, 0, len(rows))
	for _, r := range rows {
		model := r.ModelName
		if model == "" {
			model = "unknown"
		}
		results = append(results, QuotaDistributionData{
			Time:     time.Unix(r.HourBucket*3600, 0).Format("2006-01-02 15:00"),
			Model:    model,
			Quota:    r.Quota / 500000,
			RawQuota: r.Quota,
			TimeSum:  hourSumMap[r.HourBucket],
		})
	}
	return results
}
```

#### 2. `GetCallTrend`（按天 × 模型统计调用次数）

```go
func GetCallTrend(startTime, endTime int64) []CallTrendData {
	var rows []struct {
		DayBucket int64
		ModelName string
		Count     int64
	}
	LOG_DB.Model(&Log{}).
		Select("created_at / 86400 AS day_bucket, model_name, COUNT(*) AS count").
		Where("created_at >= ? AND created_at <= ? AND type = ?", startTime, endTime, LogTypeConsume).
		Group("created_at / 86400, model_name").
		Scan(&rows)

	results := make([]CallTrendData, 0, len(rows))
	for _, r := range rows {
		model := r.ModelName
		if model == "" {
			model = "unknown"
		}
		results = append(results, CallTrendData{
			Time:  time.Unix(r.DayBucket*86400, 0).Format("2006-01-02"),
			Model: model,
			Count: r.Count,
		})
	}
	return results
}
```

#### 3. `GetUserQuotaTrend`（按天 × 用户聚合消耗，仅保留 Top5）

将「全量加载 + 重复调用 `GetUserQuotaRank`」改为「两次 SQL 聚合」：

```go
func GetUserQuotaTrend(startTime, endTime int64) []UserQuotaTrendData {
	var topUserRows []struct {
		Username string
		Quota    int64
	}
	LOG_DB.Model(&Log{}).
		Select("username, SUM(quota) AS quota").
		Where("created_at >= ? AND created_at <= ? AND type = ?", startTime, endTime, LogTypeConsume).
		Where("quota > 0").
		Group("username").
		Order("quota DESC").
		Limit(5).
		Scan(&topUserRows)

	topUsers := make(map[string]bool)
	for _, u := range topUserRows {
		user := u.Username
		if user == "" {
			user = "unknown"
		}
		topUsers[user] = true
	}

	var rows []struct {
		DayBucket int64
		Username  string
		Quota     int64
	}
	LOG_DB.Model(&Log{}).
		Select("created_at / 86400 AS day_bucket, username, SUM(quota) AS quota").
		Where("created_at >= ? AND created_at <= ? AND type = ?", startTime, endTime, LogTypeConsume).
		Where("quota > 0").
		Group("created_at / 86400, username").
		Scan(&rows)

	results := make([]UserQuotaTrendData, 0, len(rows))
	for _, r := range rows {
		user := r.Username
		if user == "" {
			user = "unknown"
		}
		if !topUsers[user] {
			continue
		}
		results = append(results, UserQuotaTrendData{
			Time:     time.Unix(r.DayBucket*86400, 0).Format("2006-01-02"),
			User:     user,
			Quota:    r.Quota / 500000,
			RawQuota: r.Quota,
		})
	}
	return results
}
```

## 语义等价性核对

| 函数 | 原逻辑 | 优化后 | 语义一致 |
|---|---|---|---|
| `GetQuotaDistribution` | 按小时截断字符串 `"2006-01-02 15:00"` 分组求和，`TimeSum` 为该小时总和 | 按 `created_at/3600` 分桶求和，桶起算时间换算小时字符串 | ✅ |
| `GetCallTrend` | 按天字符串分组计数（含 quota=0 的记录） | 按 `created_at/86400` 分桶计数（无 quota 过滤） | ✅ |
| `GetUserQuotaTrend` | 按天字符串分组求和，只保留总消耗 Top5 用户 | 先聚合总消耗取 Top5，再按天分桶求和过滤 | ✅ |

注：`GetCallTrend` 原实现未过滤 `quota > 0`（对所有消费日志计数），优化后保持一致，未添加该过滤条件。

## 后续可选优化

1. **索引**：`logs` 表已有 `idx_created_at_type`（`created_at, type`），
   正好覆盖上述查询的 `created_at + type` 过滤，无需新增索引。
2. **接口缓存**：图表数据变动不频繁，可在 controller 层对大屏接口加短期缓存
   （如 60s），进一步降低 DB 压力。
3. **历史归档**：若日志量持续增长，可对 `logs` 表按月/按日分区或定期归档，
   减少单表扫描基数。
