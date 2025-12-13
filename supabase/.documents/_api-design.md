# API 設計書

## 概要

介護記録システム「ケアログ」の API 設計書。
Supabase Edge Functions（Deno）で実装。

---

## ベース URL

```
http://localhost:54321/functions/v1
```

---

## 共通仕様

### リクエストヘッダー

| ヘッダー     | 値               | 必須       |
| ------------ | ---------------- | ---------- |
| Content-Type | application/json | POST/PATCH |

### レスポンスヘッダー

| ヘッダー                     | 値                                                 |
| ---------------------------- | -------------------------------------------------- |
| Content-Type                 | application/json                                   |
| Access-Control-Allow-Origin  | \*                                                 |
| Access-Control-Allow-Headers | authorization, x-client-info, apikey, content-type |

### エラーレスポンス

すべての API は以下の形式でエラーを返します。

```json
{
  "error": "エラーメッセージ"
}
```

### HTTP ステータスコード

| コード | 説明                   |
| ------ | ---------------------- |
| 200    | 成功                   |
| 400    | リクエスト不正         |
| 404    | リソースが見つからない |
| 405    | メソッド不許可         |
| 500    | サーバーエラー         |

---

## エンドポイント一覧

| メソッド | パス                | 説明                   | 状態   |
| -------- | ------------------- | ---------------------- | ------ |
| POST     | /transcribe         | 音声文字起こし         | 実装済 |
| POST     | /summarize          | テキスト要約（AI）     | 実装済 |
| GET      | /users              | 利用者一覧             | 実装済 |
| GET      | /users-detail       | 利用者詳細             | 実装済 |
| POST     | /logs/preview       | ログプレビュー（AI）   | 未実装 |
| POST     | /logs/confirm       | ログ確定・保存         | 未実装 |
| POST     | /care-plan/generate | 介護計画生成（AI）     | 未実装 |
| PATCH    | /care-plan/:id      | 介護計画ステータス更新 | 未実装 |

---

## 実装済み API

### POST /transcribe

音声ファイルをテキストに変換します。

#### リクエスト

**Content-Type:** `multipart/form-data`

| フィールド | 型   | 必須 | 説明         |
| ---------- | ---- | ---- | ------------ |
| audio      | File | Yes  | 音声ファイル |

**対応形式:** mp3, mp4, m4a, wav, webm
**サイズ制限:** 25MB

#### レスポンス

```json
{
  "text": "今日は7時に起床しました。"
}
```

#### cURL 例

```bash
curl -X POST http://localhost:54321/functions/v1/transcribe \
  -F "audio=@/path/to/audio.mp3"
```

---

### POST /summarize

テキストを要約します（AI 経由）。

#### リクエスト

**Content-Type:** `multipart/form-data` または `application/json`

| フィールド | 型     | 必須 | 説明             |
| ---------- | ------ | ---- | ---------------- |
| text       | string | Yes  | 要約対象テキスト |

#### レスポンス

```json
{
  "summary": "全体的に大きな問題はなかったが、反応が遅く..."
}
```

| フィールド | 型     | 説明         |
| ---------- | ------ | ------------ |
| summary    | string | 要約テキスト |

#### cURL 例

```bash
# form-data
curl -X POST http://localhost:54321/functions/v1/summarize \
  -F 'text=今日なんですけど、全体的に大きな問題はなかったんですが...'

# JSON
curl -X POST http://localhost:54321/functions/v1/summarize \
  -H "Content-Type: application/json" \
  -d '{"text":"今日なんですけど、全体的に大きな問題はなかったんですが..."}'
```

---

### GET /users

利用者一覧を取得します。

#### リクエスト

パラメータなし

#### レスポンス

```json
[
  {
    "id": 1,
    "name": "山田 花子",
    "age": 82,
    "gender": "女性",
    "careLevel": "要介護2",
    "caregiver": "田中 美咲",
    "lastLogAt": "2024-12-13T18:30:00Z"
  }
]
```

#### レスポンスフィールド

| フィールド | 型             | 説明                     |
| ---------- | -------------- | ------------------------ |
| id         | number         | 利用者 ID                |
| name       | string         | 氏名                     |
| age        | number \| null | 年齢                     |
| gender     | string \| null | 性別                     |
| careLevel  | string \| null | 要介護レベル             |
| caregiver  | string \| null | 担当介護者名             |
| lastLogAt  | string \| null | 最終ログ日時（ISO 8601） |

#### cURL 例

```bash
curl http://localhost:54321/functions/v1/users
```

---

### GET /users-detail

利用者詳細を取得します（最近のログ含む）。

#### リクエスト

**パラメータ:**

| パラメータ | 型     | 必須 | 説明      |
| ---------- | ------ | ---- | --------- |
| id         | number | Yes  | 利用者 ID |

#### レスポンス

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
  "notes": "高血圧の持病あり...",
  "caregiver": {
    "id": 1,
    "name": "田中 美咲"
  },
  "recentLogs": [
    {
      "id": 1,
      "date": "2024-12-13",
      "time": "18:30",
      "author": "田中 美咲",
      "content": "夕食は8割ほど摂取...",
      "tags": ["食事", "服薬"]
    }
  ]
}
```

#### レスポンスフィールド

| フィールド | 型             | 説明                     |
| ---------- | -------------- | ------------------------ |
| id         | number         | 利用者 ID                |
| name       | string         | 氏名                     |
| age        | number \| null | 年齢                     |
| gender     | string \| null | 性別                     |
| phone      | string \| null | 電話番号                 |
| address    | string \| null | 住所                     |
| careLevel  | string \| null | 要介護レベル             |
| startDate  | string \| null | サービス開始日           |
| notes      | string \| null | 備考                     |
| caregiver  | object \| null | 担当介護者（id, name）   |
| recentLogs | array          | 最近のログ（最大 10 件） |

#### cURL 例

```bash
curl "http://localhost:54321/functions/v1/users-detail?id=1"
```

---

## 未実装 API

### POST /logs/preview

AI がログ内容からタグを分析します。

#### リクエスト

```json
{
  "content": "夕食は8割ほど摂取。服薬は本人が忘れていたため声かけで対応。"
}
```

| フィールド | 型     | 必須 | 説明     |
| ---------- | ------ | ---- | -------- |
| content    | string | Yes  | ログ内容 |

#### レスポンス

```json
{
  "tags": ["食事", "服薬"]
}
```

| フィールド | 型       | 説明           |
| ---------- | -------- | -------------- |
| tags       | string[] | 抽出されたタグ |

---

### POST /logs/confirm

ログを確定して DB に保存します。

#### リクエスト

```json
{
  "userId": 1,
  "caregiverId": 2,
  "date": "2024-12-13",
  "time": "18:30",
  "content": "夕食は8割ほど摂取...",
  "tags": ["食事", "服薬"]
}
```

| フィールド  | 型       | 必須 | 説明                 |
| ----------- | -------- | ---- | -------------------- |
| userId      | number   | Yes  | 利用者 ID            |
| caregiverId | number   | Yes  | 介護者 ID            |
| date        | string   | Yes  | 記録日（YYYY-MM-DD） |
| time        | string   | Yes  | 記録時刻（HH:MM）    |
| content     | string   | Yes  | 記録内容             |
| tags        | string[] | No   | タグ配列             |

#### レスポンス

```json
{
  "logId": 5
}
```

| フィールド | 型     | 説明              |
| ---------- | ------ | ----------------- |
| logId      | number | 作成されたログ ID |

---

### POST /care-plan/generate

AI が介護計画を生成して DB に保存します。

#### リクエスト

```json
{
  "userId": 1
}
```

| フィールド | 型     | 必須 | 説明      |
| ---------- | ------ | ---- | --------- |
| userId     | number | Yes  | 利用者 ID |

#### レスポンス

```json
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

| フィールド | 型     | 説明                  |
| ---------- | ------ | --------------------- |
| id         | number | 介護計画 ID           |
| summary    | string | 計画概要              |
| goals      | array  | 目標リスト            |
| notes      | string | 備考                  |
| status     | string | ステータス（pending） |

---

### PATCH /care-plan/:id

介護計画のステータスを更新します。

#### リクエスト

**パスパラメータ:**

| パラメータ | 型     | 説明        |
| ---------- | ------ | ----------- |
| id         | number | 介護計画 ID |

**ボディ:**

```json
{
  "status": "done"
}
```

| フィールド | 型     | 必須 | 説明                       |
| ---------- | ------ | ---- | -------------------------- |
| status     | string | Yes  | ステータス（pending/done） |

#### レスポンス

```json
{
  "id": 5,
  "status": "done"
}
```

---

## AI プロバイダー

本システムは AI プロバイダーを切り替え可能な設計です。

### 環境変数

```bash
# OpenAI使用時
AI_PROVIDER=openai
OPENAI_API_KEY=sk-xxx

# さくらAI使用時
AI_PROVIDER=sakura
SAKURA_API_KEY=your-token
SAKURA_BASE_URL=https://api.ai.sakura.ad.jp/v1
SAKURA_CHAT_MODEL=gpt-oss-120b
```

### 利用可能モデル（さくら AI）

| 用途           | モデル名               |
| -------------- | ---------------------- |
| 音声文字起こし | whisper-large-v3-turbo |
| テキスト生成   | gpt-oss-120b           |

---

## 更新履歴

| 日付       | 内容                               |
| ---------- | ---------------------------------- |
| 2025-12-13 | 初版作成                           |
| 2025-12-13 | alerts 関連 API・フィールド削除    |
