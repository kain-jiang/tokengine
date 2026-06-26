-- ========================================
-- 为现有用户填充 created_at 字段
-- 请根据您的数据库类型选择执行对应的语句
-- ========================================

-- PostgreSQL 用户执行：
UPDATE users SET created_at = EXTRACT(EPOCH FROM NOW())::BIGINT 
WHERE created_at = 0 OR created_at IS NULL;

-- ========================================
-- 以下为其他数据库类型的参考：
-- ========================================

-- SQLite 用户执行：
-- UPDATE users SET created_at = strftime('%s', 'now') WHERE created_at = 0 OR created_at IS NULL;

-- MySQL 用户执行：
-- UPDATE users SET created_at = UNIX_TIMESTAMP() WHERE created_at = 0 OR created_at IS NULL;
