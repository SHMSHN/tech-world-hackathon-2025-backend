# ケアログ DB 設計書

## 概要

介護記録システム「ケアログ」のデータベース設計書。
PostgreSQL 15 + Supabase を使用。

---

## ER 図

```
┌─────────────┐       ┌─────────────┐
│ caregivers  │       │   users     │
│─────────────│       │─────────────│
│ id (PK)     │◄──────│ primary_    │
│ name        │       │ caregiver_id│
│ role        │       │ id (PK)     │
│ phone       │       │ name        │
│ created_at  │       │ name_kana   │
└──────┬──────┘       │ age         │
       │              │ gender      │
       │              │ phone       │
       │              │ address     │
       │              │ care_level  │
       │              │ start_date  │
       │              │ notes       │
       │              │ created_at  │
       │              └──────┬──────┘
       │                     │
       │    ┌────────────────┼────────────────┐
       │    │                │                │
       ▼    ▼                ▼                ▼
┌─────────────┐       ┌─────────────┐  ┌─────────────┐
│    logs     │       │   alerts    │  │ care_plans  │
│─────────────│       │─────────────│  │─────────────│
│ id (PK)     │◄──────│ log_id (FK) │  │ id (PK)     │
│ user_id(FK) │       │ id (PK)     │  │ user_id(FK) │
│ caregiver_id│       │ user_id(FK) │  │ title       │
│ date        │       │ level       │  │ goal        │
│ time        │       │ title       │  │ tasks       │
│ content     │       │ description │  │ status      │
│ tags        │       │ status      │  │ level       │
│ created_at  │       │ created_at  │  │ created_at  │
└─────────────┘       └─────────────┘  └─────────────┘
```

---

## テーブル定義

### 1. caregivers（介護者）

介護を行う人の情報を管理。

| カラム     | 型          | NULL | デフォルト | 説明                        |
| ---------- | ----------- | ---- | ---------- | --------------------------- |
| id         | SERIAL      | NO   | 自動採番   | 主キー                      |
| name       | TEXT        | NO   | -          | 氏名                        |
| role       | TEXT        | YES  | -          | 役割（family/helper/nurse） |
| phone      | TEXT        | YES  | -          | 電話番号                    |
| created_at | TIMESTAMPTZ | YES  | NOW()      | 作成日時                    |

**インデックス:**

- `idx_caregivers_name` - name

**役割の種類:**
| 値 | 説明 |
|----|------|
| family | 家族 |
| helper | ヘルパー |
| nurse | 看護師 |

---

### 2. users（利用者）

介護サービスを受ける人（被介護者）の情報を管理。

| カラム               | 型          | NULL | デフォルト | 説明                |
| -------------------- | ----------- | ---- | ---------- | ------------------- |
| id                   | SERIAL      | NO   | 自動採番   | 主キー              |
| name                 | TEXT        | NO   | -          | 氏名                |
| name_kana            | TEXT        | YES  | -          | ふりがな            |
| age                  | INTEGER     | YES  | -          | 年齢                |
| gender               | TEXT        | YES  | -          | 性別                |
| phone                | TEXT        | YES  | -          | 電話番号            |
| address              | TEXT        | YES  | -          | 住所                |
| primary_caregiver_id | INTEGER     | YES  | -          | 担当介護者 ID（FK） |
| care_level           | TEXT        | YES  | -          | 要介護レベル        |
| start_date           | DATE        | YES  | -          | サービス開始日      |
| notes                | TEXT        | YES  | -          | 備考                |
| created_at           | TIMESTAMPTZ | YES  | NOW()      | 作成日時            |

**インデックス:**

- `idx_users_name` - name
- `idx_users_primary_caregiver_id` - primary_caregiver_id
- `idx_users_care_level` - care_level

**外部キー:**

- `primary_caregiver_id` → `caregivers.id`

**要介護レベルの種類:**
| 値 | 説明 |
|----|------|
| 要支援 1 | 要支援 1 |
| 要支援 2 | 要支援 2 |
| 要介護 1 | 要介護 1 |
| 要介護 2 | 要介護 2 |
| 要介護 3 | 要介護 3 |
| 要介護 4 | 要介護 4 |
| 要介護 5 | 要介護 5 |

---

### 3. logs（介護記録）

日々の介護記録を管理。Supabase Realtime が有効。

| カラム       | 型          | NULL | デフォルト | 説明            |
| ------------ | ----------- | ---- | ---------- | --------------- |
| id           | SERIAL      | NO   | 自動採番   | 主キー          |
| user_id      | INTEGER     | NO   | -          | 利用者 ID（FK） |
| caregiver_id | INTEGER     | YES  | -          | 記録者 ID（FK） |
| content      | TEXT        | NO   | -          | 記録内容        |
| created_at   | TIMESTAMPTZ | YES  | NOW()      | 作成日時        |

**インデックス:**

- `idx_logs_user_id` - user_id
- `idx_logs_caregiver_id` - caregiver_id

**外部キー:**

- `user_id` → `users.id` (CASCADE DELETE)
- `caregiver_id` → `caregivers.id`

**Realtime:**

- `supabase_realtime` publication に追加済み

---

### 4. care_plans（介護計画）【未実装】

AI が生成する介護計画を管理。

| カラム     | 型          | NULL | デフォルト | 説明                       |
| ---------- | ----------- | ---- | ---------- | -------------------------- |
| id         | SERIAL      | NO   | 自動採番   | 主キー                     |
| user_id    | INTEGER     | NO   | -          | 利用者 ID（FK）            |
| summary    | TEXT        | YES  | -          | 計画概要                   |
| goals      | JSONB       | YES  | -          | 目標（JSON）               |
| notes      | TEXT        | YES  | -          | 備考                       |
| status     | TEXT        | YES  | 'pending'  | ステータス（pending/done） |
| created_at | TIMESTAMPTZ | YES  | NOW()      | 作成日時                   |

**外部キー:**

- `user_id` → `users.id`

**ステータスの種類:**
| 値 | 説明 |
|----|------|
| pending | 未実施 |
| done | 実施 |

**goals の JSON 構造:**

```json
[
  {
    "category": "服薬管理",
    "shortTerm": "服薬漏れをゼロにする（1ヶ月以内）",
    "longTerm": "自立した服薬習慣の確立（3ヶ月）",
    "actions": ["服薬時間にアラームを設定", "服薬チェックシートの導入"]
  }
]
```

---

## マイグレーション順序

FK 依存関係に基づく適用順序:

| 順序 | ファイル                                         | 内容                                 |
| ---- | ------------------------------------------------ | ------------------------------------ |
| 1    | `20251213000001_create_caregivers.sql`           | caregivers テーブル                  |
| 2    | `20251213000002_create_users.sql`                | users テーブル                       |
| 3    | `20251213000003_create_logs.sql`                 | logs テーブル                        |
| 4    | `20251213000004_remove_tags_enable_realtime.sql` | tags/date/time 削除、Realtime 有効化 |
| 5    | `20251213000005_seed_data.sql`                   | シードデータ（15 名分）              |
| 6    | `20251213000006_add_name_kana.sql`               | name_kana カラム追加                 |
| 7    | `20251213000007_create_care_plans.sql`           | care_plans テーブル（未実装）        |

---

## 更新履歴

| 日付       | 内容                                                |
| ---------- | --------------------------------------------------- |
| 2025-12-13 | 初版作成                                            |
| 2025-12-13 | alerts テーブル削除                                 |
| 2025-12-13 | logs から tags/date/time 削除、Realtime 有効化      |
| 2025-12-13 | users に name_kana 追加、シードデータを 15 名に拡充 |
