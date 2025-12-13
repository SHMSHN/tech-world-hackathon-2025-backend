# ケアログAPI Backend

Supabase Edge Functionsを使用した音声文字起こしAPI

## セットアップ

### 1. 環境変数の設定

```bash
cp .env.example .env
```

`.env`を編集して`OPENAI_API_KEY`を設定:

```
OPENAI_API_KEY=sk-your-openai-api-key
```

### 2. Supabaseの起動

```bash
supabase start
```

### 3. Edge Functionsの起動

```bash
supabase functions serve --env-file .env
```

## APIの使い方

### POST /transcribe

音声ファイルをテキストに変換します。

```bash
curl -X POST http://localhost:54321/functions/v1/transcribe \
  -F "audio=@/path/to/audio.mp3"
```

**レスポンス例:**

```json
{
  "text": "今日は7時に起床しました。"
}
```

**対応形式:** mp3, mp4, m4a, wav, webm

**サイズ制限:** 25MB

## 停止

```bash
supabase stop
```
