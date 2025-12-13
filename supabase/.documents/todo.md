# API 実装 TODO

## 現状

### 実装済み

- [x] POST /transcribe - 音声文字起こし
- [x] AI 抽象化レイヤー（OpenAI/Sakura 切り替え可能）
- [x] CORS ユーティリティ
- [x] DB マイグレーション（caregivers, users, logs + seed）
- [x] supabase-client.ts
- [x] GET /users - 利用者一覧
- [x] GET /users-detail - 利用者詳細

---

## TODO

### Phase 1: care_plans テーブル追加

- [ ] `supabase/migrations/20251213000005_create_care_plans.sql` 作成

```sql
CREATE TABLE care_plans (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  summary TEXT,
  goals JSONB,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Phase 2: AI 抽象化レイヤー拡張

- [ ] `_shared/ai/types.ts` に型追加（LogPreviewResult, CarePlanResult）
- [ ] `_shared/ai/providers/openai.ts` に関数追加
  - [ ] generateLogPreview()
  - [ ] generateCarePlan()
- [ ] `_shared/ai/providers/sakura.ts` に関数追加
  - [ ] generateLogPreview()
  - [ ] generateCarePlan()

### Phase 3: Edge Functions 作成

- [ ] `logs-preview/index.ts` - POST /logs/preview（AI タグ分析）
- [ ] `logs-confirm/index.ts` - POST /logs/confirm（DB 保存）
- [ ] `care-plan/index.ts` - POST /care-plan/generate（AI 計画生成）
- [ ] `care-plan-update/index.ts` - PATCH /care-plan/:id（ステータス更新）

### Phase 4: 設定更新

- [ ] `config.toml` に追加
  - [ ] functions.logs-preview
  - [ ] functions.logs-confirm
  - [ ] functions.care-plan
  - [ ] functions.care-plan-update

---

## API 仕様（残り）

### POST /logs/preview

AI がログ内容からタグを分析

```typescript
// Request
{ "content": "夕食は8割ほど摂取。服薬は本人が忘れていたため声かけで対応。" }

// Response
{
  "tags": ["食事", "服薬"]
}
```

### POST /logs/confirm

```typescript
// Request
{
  "userId": 1,
  "caregiverId": 2,
  "date": "2024-12-13",
  "time": "18:30",
  "content": "夕食は8割ほど摂取...",
  "tags": ["食事", "服薬"]
}

// Response
{ "logId": 5 }
```

### POST /care-plan/generate

AI が介護計画を生成して DB に保存

```typescript
// Request
{ "userId": 1 }

// Response
{
  "id": 5,
  "summary": "山田花子様は現在、服薬管理と夜間の安全確保が最優先課題です...",
  "goals": [
    {
      "category": "服薬管理",
      "shortTerm": "服薬漏れをゼロにする（1ヶ月以内）",
      "longTerm": "自立した服薬習慣の確立（3ヶ月）",
      "actions": ["服薬時間にアラームを設定", "服薬チェックシートの導入"]
    }
  ],
  "notes": "ご家族との連携を密にし...",
  "status": "pending"
}
```

### PATCH /care-plan/:id

```typescript
// Request
{ "status": "done" }  // pending / done

// Response
{ "id": 5, "status": "done" }
```

---

## さくら AI 情報

### API エンドポイント

- ベース URL: `https://api.ai.sakura.ad.jp/v1/`
- 認証: `Authorization: Bearer <Token>`

### 利用可能モデル

| 用途           | モデル名               |
| -------------- | ---------------------- |
| 音声文字起こし | whisper-large-v3-turbo |
| テキスト生成   | gpt-oss-120b           |

### 環境変数

```
AI_PROVIDER=sakura
SAKURA_API_KEY=your-sakura-token
SAKURA_BASE_URL=https://api.ai.sakura.ad.jp/v1
SAKURA_CHAT_MODEL=gpt-oss-120b
```

---

## 更新日

2025 年 12 月 13 日
