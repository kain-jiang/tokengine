-- ========================================
-- PostgreSQL 财务模块表创建脚本
-- ========================================
-- 使用说明：
-- psql -U postgres -d your_database_name -f create_finance_tables.sql
-- ========================================

-- 创建 reconciliations 表（对账记录）
CREATE TABLE IF NOT EXISTS reconciliations (
    id SERIAL PRIMARY KEY,
    type VARCHAR(20),                    -- downstream, upstream
    period VARCHAR(20),                  -- 2026-06
    channel_id INTEGER DEFAULT 0,        -- 渠道ID（上游对账时）
    channel_name VARCHAR(100),
    total_amount DECIMAL(12,2),          -- 总金额
    total_quota INTEGER DEFAULT 0,       -- 总额度
    transaction_count INTEGER DEFAULT 0, -- 交易笔数
    reconciled_amount DECIMAL(12,2),     -- 对账金额
    discrepancy DECIMAL(12,2),           -- 差异金额
    status VARCHAR(20) DEFAULT 'pending',-- pending, reconciled, discrepancy
    data JSONB,                          -- 详细数据
    remark VARCHAR(500),                 -- 备注
    create_time BIGINT,
    update_time BIGINT
);

-- 创建 reconciliations 表的索引
CREATE INDEX IF NOT EXISTS idx_reconciliations_type ON reconciliations(type);
CREATE INDEX IF NOT EXISTS idx_reconciliations_period ON reconciliations(period);
CREATE INDEX IF NOT EXISTS idx_reconciliations_status ON reconciliations(status);
CREATE INDEX IF NOT EXISTS idx_reconciliations_create_time ON reconciliations(create_time);

-- 创建 revenue_reports 表（营收报表）
CREATE TABLE IF NOT EXISTS revenue_reports (
    id SERIAL PRIMARY KEY,
    report_type VARCHAR(20),             -- daily, monthly, yearly
    period VARCHAR(20) UNIQUE,           -- 2026-06-20 / 2026-06 / 2026
    total_revenue DECIMAL(12,2),         -- 总营收
    total_topup DECIMAL(12,2),           -- 总充值
    total_subscription DECIMAL(12,2),    -- 订阅收入
    total_consumption DECIMAL(12,2),     -- 总消费
    net_revenue DECIMAL(12,2),           -- 净营收
    order_count INTEGER DEFAULT 0,       -- 订单数
    user_count INTEGER DEFAULT 0,        -- 用户数
    request_count INTEGER DEFAULT 0,     -- 请求数
    data JSONB,                          -- 详细数据
    create_time BIGINT,
    update_time BIGINT
);

-- 创建 revenue_reports 表的索引
CREATE INDEX IF NOT EXISTS idx_revenue_reports_period ON revenue_reports(period);
CREATE INDEX IF NOT EXISTS idx_revenue_reports_report_type ON revenue_reports(report_type);

-- 验证表是否创建成功
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('reconciliations', 'revenue_reports')
ORDER BY table_name;
