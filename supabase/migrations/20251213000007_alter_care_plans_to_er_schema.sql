-- care_plans を ER 図の設計に合わせる
-- 目標: columns = id, user_id(FK), title, goal, tasks, status, level, created_at

-- テーブルが存在しない場合は作成（リモートDBで000006が実行されていない場合への対応）
CREATE TABLE IF NOT EXISTS care_plans (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 追加カラム
ALTER TABLE care_plans
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS goal TEXT,
  ADD COLUMN IF NOT EXISTS tasks JSONB,
  ADD COLUMN IF NOT EXISTS level TEXT;

-- 不要カラムの削除（存在する場合）
ALTER TABLE care_plans
  DROP COLUMN IF EXISTS summary,
  DROP COLUMN IF EXISTS goals,
  DROP COLUMN IF EXISTS notes;

-- インデックス（存在しなければ作成）
CREATE INDEX IF NOT EXISTS idx_care_plans_user_id ON care_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_care_plans_status ON care_plans(status);
CREATE INDEX IF NOT EXISTS idx_care_plans_level ON care_plans(level);

-- コメント
COMMENT ON TABLE care_plans IS '介護計画（AI生成）: title/goal/tasks(level,status) を保持';
COMMENT ON COLUMN care_plans.tasks IS '推奨行動の配列(JSONB)。例: ["服薬タイマー設定","チェックシート導入"]';
COMMENT ON COLUMN care_plans.level IS '重要度レベル（例: alert/warning）';

