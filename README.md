# ケアログ API Backend

Supabase Edge Functions を使用した介護記録 API

## セットアップ

### 1. 環境変数の設定

```bash
cp .env.example .env
```

`.env`を編集して必要なキーを設定:

```
AI_PROVIDER=sakura            # さくらAIを使う場合（既定: openai）
SAKURA_API_KEY=sk-your-sakura-api-key
# 任意: 企業契約等でURL/モデルが異なる場合に設定
# SAKURA_BASE_URL=https://api.ai.sakura.ad.jp/v1
# SAKURA_CHAT_MODEL=gpt-4o-mini

# OpenAIを使う場合に必要
# OPENAI_API_KEY=sk-your-openai-api-key
```

### 2. Supabase の起動

```bash
supabase start
```

### 3. データベースのセットアップ

```bash
# 全マイグレーションを適用（シードデータ含む）
supabase db reset
```

または個別に適用:

```bash
supabase migration up
```

### 4. Edge Functions の起動

```bash
supabase functions serve --env-file .env
```

## API の使い方

### POST /transcribe

音声ファイルをテキストに変換します。

```bash
curl -X POST http://localhost:54321/functions/v1/transcribe \
  -F "audio=@./test.m4a"
```

**レスポンス例:**

```json
{
  "text": "今日は7時に起床しました。"
}
```

**対応形式:** mp3, mp4, m4a, wav, webm

**サイズ制限:** 25MB

### POST /summarize

テキストを要約します（さくらの AI Engine 経由）。

```bash
curl -X POST http://localhost:54321/functions/v1/summarize \
  -F 'text=今日なんですけど、全体的に大きな問題はなかったんですが、なんとなく、いつもより反応が遅い気がしました。呼びかけたときに、一拍おいてから返事することが多かったです。疲れてるだけかもしれないですけど、ちょっと気になったので残しておきます。他の違和感としては、いつも通り過ごしてはいたんですけど、表情があまり動かなかったです。笑顔が少なくて、ぼーっとしている時間が長かった印象です。体調が悪いのか、気分なのかは分かりません。'
```

**レスポンス例:**

```json
{
  "summary": "全体的に大きな問題はなかったが、反応が遅く一拍置いて返事することが増え、表情も乏しく笑顔が少なくぼーっとした様子が見られた。体調や気分の影響かは不明。"
}
```

備考: `application/json` でも呼べます。

```bash
curl -X POST http://localhost:54321/functions/v1/summarize \
  -H "Content-Type: application/json" \
  -d '{"text":"…同上のテキスト…"}'
```

### POST /assess-risk

介護日報ログを AI で評価し、危険兆候を構造化して返します。2 通りの呼び出し方があります。

- user_id を渡してサーバーが DB から `logs` を取得
- `careLogs` を直接渡す（後方互換）

#### 1) user_id を指定（推奨）

```bash
curl -X POST http://localhost:54321/functions/v1/assess-risk \
  -H "Content-Type: application/json" \
  -d '{"user_id":1}'
```

または

```bash
curl -X POST http://localhost:54321/functions/v1/assess-risk \
  -F 'user_id=1'
```

サーバー側で `logs` テーブルから `user_id=1` の行を取得し、`content` を AI に渡します。

#### 2) careLogs を直接渡す（後方互換）

```bash
curl -X POST http://localhost:54321/functions/v1/assess-risk \
  -H "Content-Type: application/json" \
  -d '{
    "careLogs": [
      {"id": 1, "content": "夕食は8割ほど摂取。お粥と煮物を好んで食べていた。食後の服薬は本人が忘れていたため声かけで対応。"},
      {"id": 3, "content": "夜間トイレ3回。2回目の際にふらつきがあったため付き添い。朝の服薬を忘れていたことが判明。"}
    ]
  }'
```

`multipart/form-data` でも可:

```bash
curl -X POST http://localhost:54321/functions/v1/assess-risk \
  -F 'careLogs=[{"id":1,"content":"..."},{"id":2,"content":"..."}]'
```

#### レスポンス（例）

```json
[
  {
    "uuid": "b6e6a9b6-7a3f-4a61-9b5b-3c7a1e0f9a12",
    "id": 1,
    "level": "alert",
    "title": "服薬漏れが2日連続",
    "tasks": ["服薬タイマーを設定する", "ピルケースを導入する"],
    "goal": "服薬忘れが解消されている",
    "description": "服薬タイマーを設定する"
  },
  {
    "uuid": "cc2d2b51-3b0f-4c05-8e0f-5cfb2ddbbf3a",
    "id": 2,
    "level": "warning",
    "title": "転倒リスク（夜間のふらつき）",
    "tasks": ["夜間動線の安全確認", "トイレ誘導・見守りを強化する"],
    "goal": "夜間のふらつきが減少している",
    "description": "夜間動線の安全確認"
  }
]
```

備考: `uuid` はレスポンスに含まれ、DB の `care_plans.plan_uuid` にも保存されます。

## 停止

```bash
supabase stop
```

## 追加エンドポイント: care_plans のステータス更新

および取得

### POST/DELETE /care-plans-delete

`user_id` と `uuid`（もしくは `uuids`）で該当する `care_plans` を削除します。

```bash
# 単一UUIDを削除
curl -X POST http://localhost:54321/functions/v1/care-plans-delete \
  -H "Content-Type: application/json" \
  -d '{"user_id":1,"uuid":"b6e6a9b6-7a3f-4a61-9b5b-3c7a1e0f9a12"}'

# 複数UUIDを削除
curl -X POST http://localhost:54321/functions/v1/care-plans-delete \
  -H "Content-Type: application/json" \
  -d '{"user_id":1,"uuids":["b6e6a9b6-7a3f-4a61-9b5b-3c7a1e0f9a12","cc2d2b51-3b0f-4c05-8e0f-5cfb2ddbbf3a"]}'
```

レスポンス例:

```json
{ "deletedUuids": ["b6e6a9b6-7a3f-4a61-9b5b-3c7a1e0f9a12"] }
```

### GET/POST /care-plans

`user_id` に紐づく `care_plans` を全件取得します（`created_at` の降順）。

例（GET, クエリパラメータ）:

```bash
curl "http://localhost:54321/functions/v1/care-plans?user_id=1"
```

例（POST, JSON）:

```bash
curl -X POST http://localhost:54321/functions/v1/care-plans \
  -H "Content-Type: application/json" \
  -d '{"user_id":1}'
```

レスポンス例:

```json
{
  "items": [
    {
      "id": 42,
      "plan_uuid": "b6e6a9b6-7a3f-4a61-9b5b-3c7a1e0f9a12",
      "user_id": 1,
      "title": "服薬漏れが2日連続",
      "goal": "服薬忘れが解消されている",
      "tasks": ["服薬タイマーを設定する", "ピルケースを導入する"],
      "level": "alert",
      "status": "pending",
      "created_at": "2025-12-13T00:00:00Z"
    }
  ]
}
```

### POST /care-plans-done

`care_plans.status` を `done` に更新します。`uuid` もしくは `uuids`（推奨）を指定してください。任意で `user_id` でスコープを制限できます。

```bash
# 単一UUID
curl -X POST http://localhost:54321/functions/v1/care-plans-done \
  -H "Content-Type: application/json" \
  -d '{"uuid": "b6e6a9b6-7a3f-4a61-9b5b-3c7a1e0f9a12"}'

# 複数UUID
curl -X POST http://localhost:54321/functions/v1/care-plans-done \
  -H "Content-Type: application/json" \
  -d '{"uuids": ["b6e6a9b6-7a3f-4a61-9b5b-3c7a1e0f9a12", "cc2d2b51-3b0f-4c05-8e0f-5cfb2ddbbf3a"]}'

# user_id でスコープを絞る（該当ユーザーの行のみ更新）
curl -X POST http://localhost:54321/functions/v1/care-plans-done \
  -H "Content-Type: application/json" \
  -d '{"uuids": ["...","..."], "user_id": 1}'
```

multipart/form-data 例:

```bash
curl -X POST http://localhost:54321/functions/v1/care-plans-done \
  -F 'uuids=["b6e6a9b6-7a3f-4a61-9b5b-3c7a1e0f9a12","cc2d2b51-3b0f-4c05-8e0f-5cfb2ddbbf3a"]' \
  -F 'user_id=1'
```

レスポンス例:

```json
{
  "updatedUuids": [
    "b6e6a9b6-7a3f-4a61-9b5b-3c7a1e0f9a12",
    "cc2d2b51-3b0f-4c05-8e0f-5cfb2ddbbf3a"
  ],
  "status": "done"
}
```

### POST /care-plans-pending

`care_plans.status` を `pending` に更新します。使い方は `/care-plans-done` と同様です。

```bash
curl -X POST http://localhost:54321/functions/v1/care-plans-pending \
  -H "Content-Type: application/json" \
  -d '{"uuids": ["b6e6a9b6-7a3f-4a61-9b5b-3c7a1e0f9a12"], "user_id": 1}'
```

### POST /care-plans-create

クライアントから任意の項目を指定して `care_plans` に登録します。

```bash
curl -X POST http://localhost:54321/functions/v1/care-plans-create \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "replace_pending": false,
    "items": [
      {
        "uuid": "c0f2d1e9-1234-4bcd-9abc-ffeeddccbbaa",
        "title": "夜間の転倒予防",
        "goal": "夜間の転倒ゼロを維持",
        "tasks": ["夜間動線の確認", "足元照明の設置"],
        "level": "alert",
        "status": "pending"
      },
      {
        "title": "服薬支援の強化",
        "goal": "服薬忘れの解消",
        "tasks": ["服薬タイマー設定", "ピルケース導入"],
        "level": "warning"
      }
    ]
  }'
```

備考:

- `uuid` を省略した場合はサーバー側で生成します（`plan_uuid` として保存）。
- `tasks` は配列（またはカンマ区切り/JSON 文字列配列でも可）。
- `status` は `pending|done`、省略時は `pending`。
- `replace_pending=true` を指定すると、同 `user_id` の既存 `pending` を削除してから登録します。

レスポンス例:

```json
{
  "updatedUuids": ["b6e6a9b6-7a3f-4a61-9b5b-3c7a1e0f9a12"],
  "status": "pending"
}
```
