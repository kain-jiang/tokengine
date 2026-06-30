-- ========================================
-- 财务模块测试数据插入脚本
-- ========================================
-- 使用说明：
-- 1. 确保数据库中已有 user 表且存在 id=1 的用户
-- 2. 根据实际需要修改 user_id、money、amount 等字段值
-- 3. 在命令行执行：mysql -u root -p new_api < insert_test_topup_data.sql
--    或 postgresql: psql -U postgres -d new_api -f insert_test_topup_data.sql
-- ========================================

-- 删除已有的测试数据（可选）
DELETE FROM top_ups WHERE trade_no LIKE 'TEST%';

-- 插入测试充值记录
-- 注意：create_time 和 complete_time 使用 Unix 时间戳
-- 当前时间戳约为 1751000000（2025-06-27 左右）

-- 测试记录 1：今天的成功充值
INSERT INTO top_ups (user_id, amount, money, trade_no, payment_method, create_time, complete_time, status) VALUES
(1, 50000000, 100.00, 'TEST001_20250625', 'alipay', UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), 'success');

-- 测试记录 2：昨天的成功充值
INSERT INTO top_ups (user_id, amount, money, trade_no, payment_method, create_time, complete_time, status) VALUES
(1, 100000000, 200.00, 'TEST002_20250624', 'wechat', UNIX_TIMESTAMP() - 86400, UNIX_TIMESTAMP() - 86400 + 300, 'success');

-- 测试记录 3：7 天前的成功充值
INSERT INTO top_ups (user_id, amount, money, trade_no, payment_method, create_time, complete_time, status) VALUES
(1, 250000000, 500.00, 'TEST003_20250618', 'stripe', UNIX_TIMESTAMP() - 7*86400, UNIX_TIMESTAMP() - 7*86400 + 600, 'success');

-- 测试记录 4：待处理的充值
INSERT INTO top_ups (user_id, amount, money, trade_no, payment_method, create_time, complete_time, status) VALUES
(1, 50000000, 100.00, 'TEST004_20250625', 'alipay', UNIX_TIMESTAMP() - 60, 0, 'pending');

-- 测试记录 5：已取消的充值
INSERT INTO top_ups (user_id, amount, money, trade_no, payment_method, create_time, complete_time, status) VALUES
(1, 30000000, 60.00, 'TEST005_20250620', 'wechat', UNIX_TIMESTAMP() - 5*86400, UNIX_TIMESTAMP() - 5*86400 + 120, 'cancelled');

-- 测试记录 6：失败的交易
INSERT INTO top_ups (user_id, amount, money, trade_no, payment_method, create_time, complete_time, status) VALUES
(1, 20000000, 40.00, 'TEST006_20250622', 'stripe', UNIX_TIMESTAMP() - 3*86400, 0, 'failed');

-- 验证插入结果
SELECT * FROM top_ups WHERE trade_no LIKE 'TEST%' ORDER BY create_time DESC;

-- 如果使用的是 PostgreSQL，请使用以下替代语句：
-- ========================================
-- PostgreSQL 版本：
-- ========================================
-- DELETE FROM top_ups WHERE trade_no LIKE 'TEST%';
-- 
-- INSERT INTO top_ups (user_id, amount, money, trade_no, payment_method, create_time, complete_time, status) VALUES
-- (1, 50000000, 100.00, 'TEST001_20250625', 'alipay', EXTRACT(EPOCH FROM NOW()), EXTRACT(EPOCH FROM NOW()), 'success'),
-- (1, 100000000, 200.00, 'TEST002_20250624', 'wechat', EXTRACT(EPOCH FROM NOW()) - 86400, EXTRACT(EPOCH FROM NOW()) - 86400 + 300, 'success'),
-- (1, 250000000, 500.00, 'TEST003_20250618', 'stripe', EXTRACT(EPOCH FROM NOW()) - 7*86400, EXTRACT(EPOCH FROM NOW()) - 7*86400 + 600, 'success'),
-- (1, 50000000, 100.00, 'TEST004_20250625', 'alipay', EXTRACT(EPOCH FROM NOW()) - 60, 0, 'pending'),
-- (1, 30000000, 60.00, 'TEST005_20250620', 'wechat', EXTRACT(EPOCH FROM NOW()) - 5*86400, EXTRACT(EPOCH FROM NOW()) - 5*86400 + 120, 'cancelled'),
-- (1, 20000000, 40.00, 'TEST006_20250622', 'stripe', EXTRACT(EPOCH FROM NOW()) - 3*86400, 0, 'failed');
-- 
-- SELECT * FROM top_ups WHERE trade_no LIKE 'TEST%' ORDER BY create_time DESC;
