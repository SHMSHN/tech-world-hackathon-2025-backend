-- care_plans に UUID カラムを追加（クライアント生成のUUIDを保存）
ALTER TABLE care_plans
  ADD COLUMN IF NOT EXISTS plan_uuid uuid;

-- 参照性を高めるためのインデックス
CREATE INDEX IF NOT EXISTS idx_care_plans_plan_uuid ON care_plans(plan_uuid);

COMMENT ON COLUMN care_plans.plan_uuid IS 'クライアント生成のUUID。レスポンスにも含め、参照キーとして使用する';

