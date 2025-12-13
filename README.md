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

## ドキュメント

| ドキュメント                                     | 説明                         |
| ------------------------------------------------ | ---------------------------- |
| [API 設計書](supabase/.documents/_api-design.md) | API 仕様・エンドポイント詳細 |
| [DB 設計書](supabase/.documents/_db-design.md)   | テーブル定義・ER 図          |

## 停止

```bash
supabase stop
```
