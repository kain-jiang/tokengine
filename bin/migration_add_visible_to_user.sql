-- Migration: Add visible_to_user column to subscription_plans table
-- Execute this SQL to add the missing column

-- For PostgreSQL:
ALTER TABLE subscription_plans ADD COLUMN visible_to_user BOOLEAN NOT NULL DEFAULT FALSE;

-- For MySQL (uncomment if using MySQL):
-- ALTER TABLE subscription_plans ADD COLUMN visible_to_user TINYINT(1) NOT NULL DEFAULT 0;

-- For SQLite (uncomment if using SQLite):
-- ALTER TABLE subscription_plans ADD COLUMN visible_to_user BOOLEAN NOT NULL DEFAULT 0;
