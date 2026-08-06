# 大屏图表数据接口性能优化方案

## 概述

本文档记录 `/api/dashboard/board/chart-data` 接口响应慢的根因分析与优化方案。

## 背景

大屏数据接口在消费趋势展示中响应缓慢。该接口由 `GetDashboardBoardChartData`
（`controller/dashboard_board.go`）串联调用 6 个 `model` 层的聚合函数，
其中 3 个存在严重的性能问题。

## 第一轮优化：聚合下推 SQL

（详见下方各小节，该轮已完成并合入。）

## 第二轮优化：响应缓存 + 并行化（已完成）

第一轮把聚合下推到 SQL 后，瓶颈转移到两个层面：

1. **每次请求仍要顺序执行 6 条全窗口聚合 SQL**，总耗时约为 6 条查询耗时之和。
2. **前端每 30s 轮询一次**，每次都重新扫描整个 7 天窗口，重复做相同聚合，
   数据库压力与响应延迟居高不下。

### 优化一：接口响应缓存（LRU + TTL + 单飞）

- 在 `GetDashboardBoardChartData` 层使用 `samber/hot` 内存缓存
  （`hot.LRU`，容量 256，TTL 60s），缓存 key 为序列化后的完整响应体。
- **缓存 key 按分钟取整**：`(start/end 秒级时间戳 - 取整到 60s 桶)`。
  前端轮询时 `now` 每秒都在变，若不取整则每次轮询都生成新 key、永远无法命中；
  取整后同一分钟内所有轮询共享同一缓存桶。
- 命中缓存时直接 `c.Data` 返回，DB 完全不打；未命中时才触发聚合。
- 使用 hot cache 的 `GetWithLoaders`（内部单飞）合并同一缓存桶的并发请求，
  避免缓存刚过期时大量轮询同时回源打爆 DB。

**效果**：每 60s 桶内只执行 1 次聚合（首请求），其余请求毫秒级返回。

### 优化二：聚合查询并行化

- 缓存未命中回源时，用 `sync.WaitGroup` 并行执行 6 条相互独立的聚合查询，
  总耗时从「6 条耗时之和」降为「最慢单条耗时」。
- 6 条查询分别写入 `DashboardChartData` 的不同字段，无数据竞争。

### 语义等价性

- 缓存返回的数据与未缓存一致（同窗口、同聚合逻辑），仅时间戳按分钟取整，
  对 7 天/30 天量级的趋势图无感知影响。
- 数据最多滞后 60s（TTL），与前端 30s 轮询节奏匹配，属于可接受的近实时。

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

### 根因（第一轮）

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

### 根因（第二轮）

1. **无缓存**：前端 30s 轮询 + 每次全量聚合，DB 被重复打满。
2. **串行执行**：6 条聚合 SQL 顺序执行，总延迟 = 各查询耗时之和。

## 优化方案

### 核心思路

把聚合下推到 SQL：`GROUP BY` + `COUNT()/SUM()`，让跨出数据库的行数从
「整个窗口的日志（百万级）」降到「聚合结果（几十到几百行）」。
同时消除 `GetUserQuotaTrend` 对 `GetUserQuotaRank` 的重复调用。

第二轮在此基础上增加：接口响应缓存（按分钟桶 + TTL）+ 聚合查询并行化。

### 跨数据库兼容性（重要）

分桶统一使用 `created_at`（int64 unix 时间戳）的**纯整数运算**，并叠加本地时区偏移
`tzOffset`（`localZoneOffset` 计算，东八区为 28800），使桶与本地自然日/小时对齐，
避免天级/小时级数据相对旧版内存分组语义偏移一个时差：

- 小时桶：`(created_at + tzOffset) / 3600`
- 天桶：`(created_at + tzOffset) / 86400`

该写法在 SQLite / MySQL / PostgreSQL 三库行为一致，避免使用
`strftime`、`DATE_FORMAT`、`to_char` 等各库不一致的日期函数（符合项目 Rule 2）。
时区偏移固定取窗口起点时刻的值；若跨夏令时边界会略有偏差，属可接受的边缘场景。

桶的起始时间再由 Go 侧换算回时间字符串：
`time.Unix(dayBucket*86400-tzOffset, 0).Format("2006-01-02")`。

## 后续可选优化

1. **索引**：`logs` 表已有 `idx_created_at_type`（`created_at, type`），
   正好覆盖上述查询的 `created_at + type` 过滤，无需新增索引。
   若想进一步减少回表，可评估 `(type, created_at, model_name, quota)` 等覆盖索引，
   但 logs 表写入量大，需权衡写放大。
2. **历史归档**：若日志量持续增长，可对 `logs` 表按月/按日分区或定期归档，
   减少单表扫描基数。
3. **Redis 级缓存**：当前为单机内存缓存（`hot`），多实例部署时每个实例各持一份。
   若需跨实例共享，可改用 `pkg/cachex.HybridCache`（Redis + 内存降级）。
4. **预热**：可用后台任务在整分钟边界前预热下一个缓存桶，进一步降低回源毛刺。
