# ケアログ API Backend

Supabase Edge Functions を使用した音声文字起こし API

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

### 3. Edge Functions の起動

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

## 停止

```bash
supabase stop
```
