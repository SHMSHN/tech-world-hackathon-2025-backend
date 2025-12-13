-- ケアギバー（介護者）テーブル
CREATE TABLE caregivers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT,                      -- family/helper/nurse等
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_caregivers_name ON caregivers(name);

COMMENT ON TABLE caregivers IS '介護者情報';
COMMENT ON COLUMN caregivers.role IS '役割: family(家族), helper(ヘルパー), nurse(看護師)等';
