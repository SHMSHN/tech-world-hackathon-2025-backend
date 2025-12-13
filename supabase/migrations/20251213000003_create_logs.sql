-- 介護記録テーブル
CREATE TABLE logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  caregiver_id INTEGER REFERENCES caregivers(id),
  date DATE NOT NULL,
  time TIME NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[],                    -- PostgreSQL配列 ["食事", "服薬"]
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_logs_user_id ON logs(user_id);
CREATE INDEX idx_logs_caregiver_id ON logs(caregiver_id);
CREATE INDEX idx_logs_date ON logs(date DESC);
CREATE INDEX idx_logs_user_date ON logs(user_id, date DESC);
CREATE INDEX idx_logs_tags ON logs USING GIN(tags);

COMMENT ON TABLE logs IS '介護記録';
COMMENT ON COLUMN logs.tags IS 'タグ配列: 食事, 服薬, 入浴, 排泄, 体調, 行動, 通院等';
