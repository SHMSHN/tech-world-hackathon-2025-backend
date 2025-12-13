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
    "id": 1,
    "level": "alert",
    "title": "服薬漏れが2日連続",
    "tasks": ["服薬タイマーを設定する", "ピルケースを導入する"],
    "goal": "服薬忘れが解消されている",
    "description": "服薬タイマーを設定する"
  },
  {
    "id": 2,
    "level": "warning",
    "title": "転倒リスク（夜間のふらつき）",
    "tasks": ["夜間動線の安全確認", "トイレ誘導・見守りを強化する"],
    "goal": "夜間のふらつきが減少している",
    "description": "夜間動線の安全確認"
  }
]
```

## 停止

```bash
supabase stop
```
