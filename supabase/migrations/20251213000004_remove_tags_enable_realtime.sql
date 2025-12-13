-- 不要なカラムとインデックスを削除
DROP INDEX IF EXISTS idx_logs_tags;
DROP INDEX IF EXISTS idx_logs_date;
DROP INDEX IF EXISTS idx_logs_user_date;
ALTER TABLE logs DROP COLUMN IF EXISTS tags;
ALTER TABLE logs DROP COLUMN IF EXISTS date;
ALTER TABLE logs DROP COLUMN IF EXISTS time;

-- Supabase Realtimeを有効化
ALTER PUBLICATION supabase_realtime ADD TABLE logs;
