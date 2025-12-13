# ケアログ API Backend

Supabase Edge Functions を使用した音声文字起こし API

## セットアップ

# セットアップ

## 1. 環境変数の設定

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

## 2. Supabase の起動

```bash
supabase start
```

### 3. Edge Functions の起動

## 3. データベースのセットアップ

### マイグレーションの適用

```bash
# 全マイグレーションを適用（シードデータ含む）
supabase db reset
```

または個別に適用:

```bash
# マイグレーションを順番に適用
supabase migration up
```

### マイグレーションファイル一覧

| ファイル                               | 内容             |
| -------------------------------------- | ---------------- |
| `20251213000001_create_caregivers.sql` | 介護者テーブル   |
| `20251213000002_create_users.sql`      | 利用者テーブル   |
| `20251213000003_create_logs.sql`       | 介護記録テーブル |
| `20251213000004_create_alerts.sql`     | アラートテーブル |
| `20251213000005_seed_data.sql`         | ダミーデータ     |

### ダミーデータの確認

`supabase db reset` 実行後、以下のダミーデータが投入されます:

- 介護者: 3 名（田中 美咲、佐藤 健一、山本 看護師）
- 利用者: 3 名（山田 花子、鈴木 太郎、高橋 和子）
- 介護記録: 6 件
- アラート: 3 件

### Supabase Studio での確認

```bash
# ブラウザで Studio を開く（デフォルト: http://localhost:54323）
supabase status
```

## 4. Edge Functions の起動

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
