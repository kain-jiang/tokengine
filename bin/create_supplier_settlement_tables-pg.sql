-- ============================================
-- 供应商结算体系数据库迁移脚本 (PostgreSQL版本)
-- 创建时间: 2026-07-07
-- 说明: 创建供应商结算体系所需的数据库表
-- ============================================

-- ============================================
-- 1. 供应商费率配置表 (supplier_pricing)
-- ============================================
CREATE TABLE IF NOT EXISTS supplier_pricing (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER NOT NULL DEFAULT 0,
    vendor_name VARCHAR(200) NOT NULL DEFAULT '',
    model_id INTEGER NOT NULL DEFAULT 0,
    model_name VARCHAR(200) NOT NULL DEFAULT '',
    token_range VARCHAR(100) NOT NULL DEFAULT '',
    pricing_method VARCHAR(50) NOT NULL DEFAULT '',
    official_input_price DECIMAL(10,6) NOT NULL DEFAULT 0.000000,
    official_output_price DECIMAL(10,6) NOT NULL DEFAULT 0.000000,
    discount_rate DECIMAL(5,4) NOT NULL DEFAULT 1.0000,
    actual_input_price DECIMAL(10,6) NOT NULL DEFAULT 0.000000,
    actual_output_price DECIMAL(10,6) NOT NULL DEFAULT 0.000000,
    per_call_price DECIMAL(10,6) NOT NULL DEFAULT 0.000000,
    per_second_price DECIMAL(10,6) NOT NULL DEFAULT 0.000000,
    per_image_price DECIMAL(10,6) NOT NULL DEFAULT 0.000000,
    cache_price DECIMAL(10,6) NOT NULL DEFAULT 0.000000,
    cache_rate DECIMAL(5,4) NOT NULL DEFAULT 1.0000,
    tpm INTEGER NOT NULL DEFAULT 0,
    rpm INTEGER NOT NULL DEFAULT 0,
    region VARCHAR(100) NOT NULL DEFAULT '',
    currency VARCHAR(20) NOT NULL DEFAULT 'CNY',
    contract_entity VARCHAR(200) NOT NULL DEFAULT '',
    service_duration VARCHAR(50) NOT NULL DEFAULT '',
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    valid_from BIGINT NOT NULL DEFAULT 0,
    valid_to BIGINT NOT NULL DEFAULT 0,
    create_time BIGINT NOT NULL DEFAULT 0,
    update_time BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_supplier_pricing_vendor ON supplier_pricing(vendor_id);
CREATE INDEX IF NOT EXISTS idx_supplier_pricing_model ON supplier_pricing(model_id);
CREATE INDEX IF NOT EXISTS idx_supplier_pricing_status ON supplier_pricing(status);
CREATE INDEX IF NOT EXISTS idx_supplier_pricing_valid ON supplier_pricing(valid_from, valid_to);

-- ============================================
-- 2. 供应商结算单表 (supplier_settlement)
-- ============================================
CREATE TABLE IF NOT EXISTS supplier_settlement (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER NOT NULL DEFAULT 0,
    vendor_name VARCHAR(200) NOT NULL DEFAULT '',
    period VARCHAR(20) NOT NULL DEFAULT '',
    period_type VARCHAR(10) NOT NULL DEFAULT '',
    start_time BIGINT NOT NULL DEFAULT 0,
    end_time BIGINT NOT NULL DEFAULT 0,
    total_input_tokens BIGINT NOT NULL DEFAULT 0,
    total_output_tokens BIGINT NOT NULL DEFAULT 0,
    total_calls INTEGER NOT NULL DEFAULT 0,
    total_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    pending_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    remark VARCHAR(500) NOT NULL DEFAULT '',
    create_time BIGINT NOT NULL DEFAULT 0,
    update_time BIGINT NOT NULL DEFAULT 0,
    confirmed_by INTEGER NOT NULL DEFAULT 0,
    confirmed_at BIGINT NOT NULL DEFAULT 0,
    paid_by INTEGER NOT NULL DEFAULT 0,
    paid_at BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_supplier_settlement_vendor ON supplier_settlement(vendor_id);
CREATE INDEX IF NOT EXISTS idx_supplier_settlement_period ON supplier_settlement(period);
CREATE INDEX IF NOT EXISTS idx_supplier_settlement_status ON supplier_settlement(status);
CREATE INDEX IF NOT EXISTS idx_supplier_settlement_create_time ON supplier_settlement(create_time);

-- ============================================
-- 3. 供应商结算明细表 (supplier_settlement_detail)
-- ============================================
CREATE TABLE IF NOT EXISTS supplier_settlement_detail (
    id SERIAL PRIMARY KEY,
    settlement_id INTEGER NOT NULL,
    vendor_id INTEGER NOT NULL DEFAULT 0,
    model_id INTEGER NOT NULL DEFAULT 0,
    model_name VARCHAR(200) NOT NULL DEFAULT '',
    token_range VARCHAR(100) NOT NULL DEFAULT '',
    pricing_method VARCHAR(50) NOT NULL DEFAULT '',
    input_tokens BIGINT NOT NULL DEFAULT 0,
    output_tokens BIGINT NOT NULL DEFAULT 0,
    input_cost DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    output_cost DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    call_count INTEGER NOT NULL DEFAULT 0,
    call_cost DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    image_count INTEGER NOT NULL DEFAULT 0,
    image_cost DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    total_cost DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    create_time BIGINT NOT NULL DEFAULT 0,
    FOREIGN KEY (settlement_id) REFERENCES supplier_settlement(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_supplier_settlement_detail_settlement ON supplier_settlement_detail(settlement_id);
CREATE INDEX IF NOT EXISTS idx_supplier_settlement_detail_vendor ON supplier_settlement_detail(vendor_id);
CREATE INDEX IF NOT EXISTS idx_supplier_settlement_detail_model ON supplier_settlement_detail(model_id);

-- ============================================
-- 4. 供应商账户表 (supplier_account)
-- ============================================
CREATE TABLE IF NOT EXISTS supplier_account (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER NOT NULL UNIQUE,
    vendor_name VARCHAR(200) NOT NULL DEFAULT '',
    total_recharge DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_consumption DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(20) NOT NULL DEFAULT 'CNY',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    create_time BIGINT NOT NULL DEFAULT 0,
    update_time BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_supplier_account_vendor ON supplier_account(vendor_id);
CREATE INDEX IF NOT EXISTS idx_supplier_account_status ON supplier_account(status);

-- ============================================
-- 5. 供应商充值记录表 (supplier_recharge)
-- ============================================
CREATE TABLE IF NOT EXISTS supplier_recharge (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER NOT NULL DEFAULT 0,
    vendor_name VARCHAR(200) NOT NULL DEFAULT '',
    amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    method VARCHAR(50) NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    remark VARCHAR(500) NOT NULL DEFAULT '',
    operator_id INTEGER NOT NULL DEFAULT 0,
    create_time BIGINT NOT NULL DEFAULT 0,
    complete_time BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_supplier_recharge_vendor ON supplier_recharge(vendor_id);
CREATE INDEX IF NOT EXISTS idx_supplier_recharge_status ON supplier_recharge(status);
CREATE INDEX IF NOT EXISTS idx_supplier_recharge_create_time ON supplier_recharge(create_time);

-- ============================================
-- 6. 供应商返点记录表 (supplier_rebate)
-- ============================================
CREATE TABLE IF NOT EXISTS supplier_rebate (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER NOT NULL DEFAULT 0,
    vendor_name VARCHAR(200) NOT NULL DEFAULT '',
    period VARCHAR(20) NOT NULL DEFAULT '',
    rebate_type VARCHAR(50) NOT NULL DEFAULT '',
    rebate_amount DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    rebate_tokens BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    source VARCHAR(50) NOT NULL DEFAULT 'manual',
    remark VARCHAR(500) NOT NULL DEFAULT '',
    create_time BIGINT NOT NULL DEFAULT 0,
    update_time BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_supplier_rebate_vendor ON supplier_rebate(vendor_id);
CREATE INDEX IF NOT EXISTS idx_supplier_rebate_period ON supplier_rebate(period);
CREATE INDEX IF NOT EXISTS idx_supplier_rebate_status ON supplier_rebate(status);
CREATE INDEX IF NOT EXISTS idx_supplier_rebate_create_time ON supplier_rebate(create_time);

-- ============================================
-- 7. 供应商返点接口配置表 (supplier_rebate_config)
-- ============================================
CREATE TABLE IF NOT EXISTS supplier_rebate_config (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER NOT NULL UNIQUE,
    vendor_name VARCHAR(200) NOT NULL DEFAULT '',
    api_url VARCHAR(500) NOT NULL DEFAULT '',
    api_key VARCHAR(200) NOT NULL DEFAULT '',
    api_secret VARCHAR(200) NOT NULL DEFAULT '',
    sync_enabled INTEGER NOT NULL DEFAULT 0,
    sync_cron VARCHAR(50) NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    create_time BIGINT NOT NULL DEFAULT 0,
    update_time BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_supplier_rebate_config_vendor ON supplier_rebate_config(vendor_id);
CREATE INDEX IF NOT EXISTS idx_supplier_rebate_config_status ON supplier_rebate_config(status);
