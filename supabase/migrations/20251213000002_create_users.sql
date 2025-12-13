-- 利用者（被介護者）テーブル
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  age INTEGER,
  gender TEXT,                    -- 性別
  phone TEXT,                     -- 電話番号
  address TEXT,                   -- 住所
  primary_caregiver_id INTEGER REFERENCES caregivers(id),
  care_level TEXT,                -- 要介護レベル
  start_date DATE,                -- サービス開始日
  notes TEXT,                     -- 備考
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_users_name ON users(name);
CREATE INDEX idx_users_primary_caregiver_id ON users(primary_caregiver_id);
CREATE INDEX idx_users_care_level ON users(care_level);

COMMENT ON TABLE users IS '利用者（被介護者）情報';
COMMENT ON COLUMN users.care_level IS '要介護レベル: 要支援1-2, 要介護1-5';
