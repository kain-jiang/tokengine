-- 更新财务管理员角色为 admin/root
-- 执行前请先备份数据库
-- 查询当前用户信息：SELECT id, username, display_name, role FROM "user" WHERE display_name LIKE '%籽琪%' OR username LIKE '%籽琪%';

-- 更新显示名或用户名为"张籽琪"的用户的 role 为 100 (RoleRootUser)
-- 如果只需要 admin 级别，将 100 改为 10 (RoleAdminUser)
UPDATE "user" 
SET role = 100 
WHERE display_name = '张籽琪' OR username = '张籽琪';

-- 验证更新结果
-- SELECT id, username, display_name, role FROM "user" WHERE display_name = '张籽琪' OR username = '张籽琪';
