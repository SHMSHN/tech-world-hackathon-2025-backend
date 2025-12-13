# users / users-detail API 実装計画

## 概要

ケアログ API の `GET /users`（利用者一覧）と `GET /users/:id`（利用者詳細）を実装する。
DB テーブルがまだ存在しないため、マイグレーションも併せて作成する。

## 実装順序

### Step 1: DB マイグレーション作成

FK 依存関係に基づき、以下の順序で作成:

| ファイル                                                   | 内容                 |
| ---------------------------------------------------------- | -------------------- |
| `supabase/migrations/20251213000001_create_caregivers.sql` | caregivers テーブル  |
| `supabase/migrations/20251213000002_create_users.sql`      | users テーブル       |
| `supabase/migrations/20251213000003_create_logs.sql`       | logs テーブル        |
| `supabase/migrations/20251213000004_create_alerts.sql`     | alerts テーブル      |
| `supabase/migrations/20251213000005_seed_data.sql`         | テスト用シードデータ |

### Step 2: Supabase クライアント作成

**ファイル:** `supabase/functions/_shared/supabase-client.ts`

- `getSupabaseClient()` 関数を実装
- `SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` を使用
- シングルトンパターンで効率化

### Step 3: users API 作成

**ファイル:** `supabase/functions/users/index.ts`

- エンドポイント: `GET /users`
- レスポンス: 利用者一覧（担当者名、アクティブアラート数、最終ログ日時付き）
- CORS ヘッダー適用

### Step 4: users-detail API 作成

**ファイル:** `supabase/functions/users-detail/index.ts`

- エンドポイント: `GET /users-detail?id=1`
- レスポンス: 利用者詳細 + 最近のログ 10 件 + アクティブアラート
- パラメータ: クエリパラメータ `id` で取得

### Step 5: config.toml 更新

**ファイル:** `supabase/config.toml`

追加内容:

```toml
[functions.users]
verify_jwt = false

[functions.users-detail]
verify_jwt = false
```

## 作成ファイル一覧

```
supabase/
├── migrations/
│   ├── 20251213000001_create_caregivers.sql (新規)
│   ├── 20251213000002_create_users.sql (新規)
│   ├── 20251213000003_create_logs.sql (新規)
│   ├── 20251213000004_create_alerts.sql (新規)
│   └── 20251213000005_seed_data.sql (新規)
├── functions/
│   ├── _shared/
│   │   └── supabase-client.ts (新規)
│   ├── users/
│   │   └── index.ts (新規)
│   └── users-detail/
│       └── index.ts (新規)
└── config.toml (更新)
```

## 参照ファイル

- `supabase/functions/transcribe/index.ts` - Edge Function 実装パターン
- `supabase/functions/_shared/cors.ts` - CORS ヘッダー設定
- `.documents/20251213_care-log-api-implementation-plan.md` - API 仕様書

## テスト方法

```bash
# マイグレーション適用
supabase db reset

# Edge Functions起動
supabase functions serve

# APIテスト
curl http://localhost:54321/functions/v1/users
curl "http://localhost:54321/functions/v1/users-detail?id=1"
```

## API 詳細仕様

### GET /users レスポンス

```json
[
  {
    "id": 1,
    "name": "山田 花子",
    "age": 82,
    "gender": "女性",
    "careLevel": "要介護2",
    "caregiver": "田中 美咲",
    "activeAlerts": 2,
    "lastLogAt": "2024-12-13T18:30:00Z"
  }
]
```

### GET /users-detail?id=1 レスポンス

```json
{
  "id": 1,
  "name": "山田 花子",
  "age": 82,
  "gender": "女性",
  "phone": "090-1234-5678",
  "address": "東京都世田谷区...",
  "careLevel": "要介護2",
  "startDate": "2024-04-01",
  "notes": "高血圧...",
  "caregiver": { "id": 2, "name": "田中 美咲" },
  "recentLogs": [
    {
      "id": 1,
      "date": "2024-12-13",
      "time": "18:30",
      "author": "田中 美咲",
      "content": "...",
      "tags": ["食事"]
    }
  ],
  "alerts": [
    {
      "id": 1,
      "level": "red",
      "title": "服薬漏れが2日連続",
      "description": "...",
      "status": "active"
    }
  ]
}
```

## 作成日

2025 年 12 月 13 日
