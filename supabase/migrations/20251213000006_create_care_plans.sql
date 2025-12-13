-- 介護計画テーブル
CREATE TABLE care_plans (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  summary TEXT,                    -- 計画概要
  goals JSONB,                     -- 目標(JSON)
  notes TEXT,                      -- 備考
  status TEXT DEFAULT 'pending',   -- pending/done
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_care_plans_user_id ON care_plans(user_id);
CREATE INDEX idx_care_plans_status ON care_plans(status);

-- チェック制約
ALTER TABLE care_plans ADD CONSTRAINT chk_care_plans_status
  CHECK (status IN ('pending', 'done'));

-- コメント
COMMENT ON TABLE care_plans IS '介護計画（AI生成）';
COMMENT ON COLUMN care_plans.goals IS '目標(JSON)。例: [{\"category\":\"服薬管理\",\"shortTerm\":\"1ヶ月以内に服薬漏れゼロ\",\"longTerm\":\"3ヶ月で自立した服薬習慣\",\"actions\":[\"アラーム設定\",\"チェックシート導入\"]}]';
COMMENT ON COLUMN care_plans.status IS 'ステータス: pending(未実施), done(実施)';

