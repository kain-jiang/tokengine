-- ============================================
-- 供应商结算增强功能 - 数据库迁移脚本
-- ============================================
-- 版本: 1.0
-- 日期: 2026-07-07
-- 描述: 创建供应商返点记录和返点接口配置表
-- ============================================

-- ============================================
-- 1. 创建供应商返点记录表 (supplier_rebate)
-- ============================================

CREATE TABLE IF NOT EXISTS `supplier_rebate` (
    `id` INTEGER PRIMARY KEY AUTOINCREMENT,
    `vendor_id` INTEGER NOT NULL DEFAULT 0,
    `vendor_name` VARCHAR(200) NOT NULL DEFAULT '',
    `period` VARCHAR(20) NOT NULL DEFAULT '',
    `rebate_type` VARCHAR(50) NOT NULL DEFAULT '',
    `rebate_amount` DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    `rebate_tokens` BIGINT NOT NULL DEFAULT 0,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `source` VARCHAR(50) NOT NULL DEFAULT 'manual',
    `remark` VARCHAR(500) NOT NULL DEFAULT '',
    `create_time` BIGINT NOT NULL DEFAULT 0,
    `update_time` BIGINT NOT NULL DEFAULT 0,
    UNIQUE(vendor_id, period)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_supplier_rebate_vendor_id ON supplier_rebate(vendor_id);
CREATE INDEX IF NOT EXISTS idx_supplier_rebate_period ON supplier_rebate(period);
CREATE INDEX IF NOT EXISTS idx_supplier_rebate_status ON supplier_rebate(status);
CREATE INDEX IF NOT EXISTS idx_supplier_rebate_create_time ON supplier_rebate(create_time);

-- 添加字段注释（MySQL）
-- ALTER TABLE `supplier_rebate` COMMENT '供应商返点记录表';
-- ALTER TABLE `supplier_rebate` MODIFY COLUMN `vendor_id` INTEGER NOT NULL DEFAULT 0 COMMENT '供应商ID';
-- ALTER TABLE `supplier_rebate` MODIFY COLUMN `vendor_name` VARCHAR(200) NOT NULL DEFAULT '' COMMENT '供应商名称';
-- ALTER TABLE `supplier_rebate` MODIFY COLUMN `period` VARCHAR(20) NOT NULL DEFAULT '' COMMENT '结算周期';
-- ALTER TABLE `supplier_rebate` MODIFY COLUMN `rebate_type` VARCHAR(50) NOT NULL DEFAULT '' COMMENT '返点类型: token, amount';
-- ALTER TABLE `supplier_rebate` MODIFY COLUMN `rebate_amount` DECIMAL(12,4) NOT NULL DEFAULT 0.0000 COMMENT '返点金额';
-- ALTER TABLE `supplier_rebate` MODIFY COLUMN `rebate_tokens` BIGINT NOT NULL DEFAULT 0 COMMENT '返点token数量';
-- ALTER TABLE `supplier_rebate` MODIFY COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT '状态: pending, synced, failed, confirmed';
-- ALTER TABLE `supplier_rebate` MODIFY COLUMN `source` VARCHAR(50) NOT NULL DEFAULT 'manual' COMMENT '来源: manual, auto';
-- ALTER TABLE `supplier_rebate` MODIFY COLUMN `remark` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '备注';

-- ============================================
-- 2. 创建供应商返点接口配置表 (supplier_rebate_config)
-- ============================================

CREATE TABLE IF NOT EXISTS `supplier_rebate_config` (
    `id` INTEGER PRIMARY KEY AUTOINCREMENT,
    `vendor_id` INTEGER NOT NULL DEFAULT 0,
    `vendor_name` VARCHAR(200) NOT NULL DEFAULT '',
    `api_url` VARCHAR(500) NOT NULL DEFAULT '',
    `api_key` VARCHAR(200) NOT NULL DEFAULT '',
    `api_secret` VARCHAR(200) NOT NULL DEFAULT '',
    `sync_enabled` INTEGER NOT NULL DEFAULT 0,
    `sync_cron` VARCHAR(50) NOT NULL DEFAULT '',
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `create_time` BIGINT NOT NULL DEFAULT 0,
    `update_time` BIGINT NOT NULL DEFAULT 0,
    UNIQUE(vendor_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_supplier_rebate_config_vendor_id ON supplier_rebate_config(vendor_id);
CREATE INDEX IF NOT EXISTS idx_supplier_rebate_config_status ON supplier_rebate_config(status);
CREATE INDEX IF NOT EXISTS idx_supplier_rebate_config_create_time ON supplier_rebate_config(create_time);

-- 添加字段注释（MySQL）
-- ALTER TABLE `supplier_rebate_config` COMMENT '供应商返点接口配置表';
-- ALTER TABLE `supplier_rebate_config` MODIFY COLUMN `vendor_id` INTEGER NOT NULL DEFAULT 0 COMMENT '供应商ID';
-- ALTER TABLE `supplier_rebate_config` MODIFY COLUMN `vendor_name` VARCHAR(200) NOT NULL DEFAULT '' COMMENT '供应商名称';
-- ALTER TABLE `supplier_rebate_config` MODIFY COLUMN `api_url` VARCHAR(500) NOT NULL DEFAULT '' COMMENT 'API地址';
-- ALTER TABLE `supplier_rebate_config` MODIFY COLUMN `api_key` VARCHAR(200) NOT NULL DEFAULT '' COMMENT 'API密钥';
-- ALTER TABLE `supplier_rebate_config` MODIFY COLUMN `api_secret` VARCHAR(200) NOT NULL DEFAULT '' COMMENT 'API密钥';
-- ALTER TABLE `supplier_rebate_config` MODIFY COLUMN `sync_enabled` INTEGER NOT NULL DEFAULT 0 COMMENT '是否启用同步: 0=禁用, 1=启用';
-- ALTER TABLE `supplier_rebate_config` MODIFY COLUMN `sync_cron` VARCHAR(50) NOT NULL DEFAULT '' COMMENT '同步定时任务cron表达式';
-- ALTER TABLE `supplier_rebate_config` MODIFY COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'active' COMMENT '状态: active, inactive';

-- ============================================
-- 3. 初始化数据（可选）
-- ============================================

-- 插入默认配置（示例）
-- INSERT INTO `supplier_rebate_config` (`vendor_id`, `vendor_name`, `api_url`, `api_key`, `sync_enabled`, `status`) 
-- VALUES (1, '示例供应商', 'https://api.example.com/rebate', 'default_key', 0, 'active');

-- ============================================
-- 完成
-- ============================================
