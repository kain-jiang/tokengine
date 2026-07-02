-- ============================================
-- 供应商结算体系数据库迁移脚本
-- 创建时间: 2026-06-30
-- 说明: 创建供应商结算体系所需的数据库表
-- ============================================

-- ============================================
-- 1. 供应商费率配置表 (supplier_pricing)
-- 存储每个供应商对每个模型的费率配置
-- ============================================
CREATE TABLE IF NOT EXISTS supplier_pricing (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id INTEGER NOT NULL,
    vendor_name VARCHAR(200),
    model_id INTEGER NOT NULL,
    model_name VARCHAR(200),
    token_range VARCHAR(100),
    pricing_method VARCHAR(50),
    official_input_price DECIMAL(10,6),
    official_output_price DECIMAL(10,6),
    discount_rate DECIMAL(5,4),
    actual_input_price DECIMAL(10,6),
    actual_output_price DECIMAL(10,6),
    per_call_price DECIMAL(10,6),
    per_second_price DECIMAL(10,6),
    per_image_price DECIMAL(10,6),
    cache_price DECIMAL(10,6),
    cache_rate DECIMAL(5,4),
    tpm INTEGER DEFAULT 0,
    rpm INTEGER DEFAULT 0,
    region VARCHAR(100),
    currency VARCHAR(20) DEFAULT 'CNY',
    contract_entity VARCHAR(200),
    service_duration VARCHAR(50),
    notes TEXT,
    status VARCHAR(20) DEFAULT 'active',
    valid_from BIGINT,
    valid_to BIGINT,
    create_time BIGINT,
    update_time BIGINT
);

CREATE INDEX IF NOT EXISTS idx_supplier_pricing_vendor ON supplier_pricing(vendor_id);
CREATE INDEX IF NOT EXISTS idx_supplier_pricing_model ON supplier_pricing(model_id);
CREATE INDEX IF NOT EXISTS idx_supplier_pricing_status ON supplier_pricing(status);
CREATE INDEX IF NOT EXISTS idx_supplier_pricing_valid ON supplier_pricing(valid_from, valid_to);

-- ============================================
-- 2. 供应商结算单表 (supplier_settlement)
-- 存储每个结算周期的结算单
-- ============================================
CREATE TABLE IF NOT EXISTS supplier_settlement (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id INTEGER NOT NULL,
    vendor_name VARCHAR(200),
    period VARCHAR(20),
    period_type VARCHAR(10),
    start_time BIGINT,
    end_time BIGINT,
    total_input_tokens BIGINT DEFAULT 0,
    total_output_tokens BIGINT DEFAULT 0,
    total_calls INTEGER DEFAULT 0,
    total_cost DECIMAL(12,2),
    paid_amount DECIMAL(12,2) DEFAULT 0,
    pending_amount DECIMAL(12,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    remark VARCHAR(500),
    create_time BIGINT,
    update_time BIGINT,
    confirmed_by INTEGER DEFAULT 0,
    confirmed_at BIGINT,
    paid_by INTEGER DEFAULT 0,
    paid_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_supplier_settlement_vendor ON supplier_settlement(vendor_id);
CREATE INDEX IF NOT EXISTS idx_supplier_settlement_period ON supplier_settlement(period);
CREATE INDEX IF NOT EXISTS idx_supplier_settlement_status ON supplier_settlement(status);
CREATE INDEX IF NOT EXISTS idx_supplier_settlement_create_time ON supplier_settlement(create_time);

-- ============================================
-- 3. 供应商结算明细表 (supplier_settlement_detail)
-- 存储结算单中的每条明细（每个模型一条）
-- ============================================
CREATE TABLE IF NOT EXISTS supplier_settlement_detail (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    settlement_id INTEGER NOT NULL,
    vendor_id INTEGER,
    model_id INTEGER,
    model_name VARCHAR(200),
    token_range VARCHAR(100),
    pricing_method VARCHAR(50),
    input_tokens BIGINT DEFAULT 0,
    output_tokens BIGINT DEFAULT 0,
    input_cost DECIMAL(12,4),
    output_cost DECIMAL(12,4),
    call_count INTEGER DEFAULT 0,
    call_cost DECIMAL(12,4),
    image_count INTEGER DEFAULT 0,
    image_cost DECIMAL(12,4),
    total_cost DECIMAL(12,4),
    create_time BIGINT,
    FOREIGN KEY (settlement_id) REFERENCES supplier_settlement(id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_settlement_detail_settlement ON supplier_settlement_detail(settlement_id);
CREATE INDEX IF NOT EXISTS idx_supplier_settlement_detail_vendor ON supplier_settlement_detail(vendor_id);
CREATE INDEX IF NOT EXISTS idx_supplier_settlement_detail_model ON supplier_settlement_detail(model_id);

-- ============================================
-- 4. 供应商账户表 (supplier_account)
-- 跟踪每个供应商的充值金额、消耗金额和剩余金额
-- ============================================
CREATE TABLE IF NOT EXISTS supplier_account (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id INTEGER NOT NULL UNIQUE,
    vendor_name VARCHAR(200),
    total_recharge DECIMAL(12,2) DEFAULT 0,
    total_consumption DECIMAL(12,2) DEFAULT 0,
    balance DECIMAL(12,2) DEFAULT 0,
    currency VARCHAR(20) DEFAULT 'CNY',
    status VARCHAR(20) DEFAULT 'active',
    create_time BIGINT,
    update_time BIGINT
);

CREATE INDEX IF NOT EXISTS idx_supplier_account_vendor ON supplier_account(vendor_id);
CREATE INDEX IF NOT EXISTS idx_supplier_account_status ON supplier_account(status);

-- ============================================
-- 5. 供应商充值记录表 (supplier_recharge)
-- 记录每次充值操作
-- ============================================
CREATE TABLE IF NOT EXISTS supplier_recharge (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id INTEGER NOT NULL,
    vendor_name VARCHAR(200),
    amount DECIMAL(12,2),
    method VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending',
    remark VARCHAR(500),
    operator_id INTEGER,
    create_time BIGINT,
    complete_time BIGINT,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_recharge_vendor ON supplier_recharge(vendor_id);
CREATE INDEX IF NOT EXISTS idx_supplier_recharge_status ON supplier_recharge(status);
CREATE INDEX IF NOT EXISTS idx_supplier_recharge_create_time ON supplier_recharge(create_time);

-- ============================================
-- PostgreSQL 版本（如果使用 PostgreSQL）
-- ============================================
-- 以下语句仅在 PostgreSQL 环境下执行：
--
-- CREATE TABLE IF NOT EXISTS supplier_pricing (
--     id SERIAL PRIMARY KEY,
--     vendor_id INTEGER NOT NULL,
--     vendor_name VARCHAR(200),
--     model_id INTEGER NOT NULL,
--     model_name VARCHAR(200),
--     token_range VARCHAR(100),
--     pricing_method VARCHAR(50),
--     official_input_price DECIMAL(10,6),
--     official_output_price DECIMAL(10,6),
--     discount_rate DECIMAL(5,4),
--     actual_input_price DECIMAL(10,6),
--     actual_output_price DECIMAL(10,6),
--     per_call_price DECIMAL(10,6),
--     per_second_price DECIMAL(10,6),
--     per_image_price DECIMAL(10,6),
--     cache_price DECIMAL(10,6),
--     cache_rate DECIMAL(5,4),
--     tpm INTEGER DEFAULT 0,
--     rpm INTEGER DEFAULT 0,
--     region VARCHAR(100),
--     currency VARCHAR(20) DEFAULT 'CNY',
--     contract_entity VARCHAR(200),
--     service_duration VARCHAR(50),
--     notes TEXT,
--     status VARCHAR(20) DEFAULT 'active',
--     valid_from BIGINT,
--     valid_to BIGINT,
--     create_time BIGINT,
--     update_time BIGINT
-- );
--
-- CREATE INDEX IF NOT EXISTS idx_supplier_pricing_vendor ON supplier_pricing(vendor_id);
-- CREATE INDEX IF NOT EXISTS idx_supplier_pricing_model ON supplier_pricing(model_id);
-- CREATE INDEX IF NOT EXISTS idx_supplier_pricing_status ON supplier_pricing(status);
-- CREATE INDEX IF NOT EXISTS idx_supplier_pricing_valid ON supplier_pricing(valid_from, valid_to);
--
-- -- 其他表的 PostgreSQL 版本类似调整...
