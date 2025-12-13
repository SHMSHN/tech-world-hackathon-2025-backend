-- アラート（要注意点）テーブル
CREATE TABLE alerts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_id INTEGER REFERENCES logs(id) ON DELETE SET NULL,
  level TEXT NOT NULL,            -- red/yellow
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',  -- pending/done
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_alerts_user_id ON alerts(user_id);
CREATE INDEX idx_alerts_log_id ON alerts(log_id);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_level ON alerts(level);
CREATE INDEX idx_alerts_user_status ON alerts(user_id, status);

-- チェック制約
ALTER TABLE alerts ADD CONSTRAINT chk_alerts_level
  CHECK (level IN ('red', 'yellow'));
ALTER TABLE alerts ADD CONSTRAINT chk_alerts_status
  CHECK (status IN ('pending', 'done'));

COMMENT ON TABLE alerts IS 'アラート（要注意点）';
COMMENT ON COLUMN alerts.level IS 'アラートレベル: red(緊急), yellow(注意)';
COMMENT ON COLUMN alerts.status IS 'ステータス: pending(未解決), done(解決済み)';
