# API 仕様書

## ベース URL

```
http://localhost:54321/functions/v1
```

---

## エンドポイント一覧

| メソッド | パス                | 説明                   | 状態   |
| -------- | ------------------- | ---------------------- | ------ |
| POST     | /transcribe         | 音声文字起こし         | 実装済 |
| GET      | /users              | 利用者一覧             | 実装済 |
| GET      | /users-detail       | 利用者詳細             | 実装済 |
| POST     | /logs/preview       | ログプレビュー（AI）   | 未実装 |
| POST     | /logs/confirm       | ログ確定・保存         | 未実装 |
| PATCH    | /alerts/:id         | アラートステータス更新 | 未実装 |
| POST     | /care-plan/generate | 介護計画生成（AI）     | 未実装 |
| PATCH    | /care-plan/:id      | 介護計画ステータス更新 | 未実装 |

---

## 実装済み API

### POST /transcribe

音声ファイルをテキストに変換します。

**リクエスト:**

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

**仕様:**

| 項目       | 値                       |
| ---------- | ------------------------ |
| 対応形式   | mp3, mp4, m4a, wav, webm |
| サイズ制限 | 25MB                     |

---

### GET /users

利用者一覧を取得します。

**リクエスト:**

```bash
curl http://localhost:54321/functions/v1/users
```

**レスポンス例:**

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

**レスポンスフィールド:**

| フィールド   | 型             | 説明                     |
| ------------ | -------------- | ------------------------ |
| id           | number         | 利用者 ID                |
| name         | string         | 氏名                     |
| age          | number \| null | 年齢                     |
| gender       | string \| null | 性別                     |
| careLevel    | string \| null | 要介護レベル             |
| caregiver    | string \| null | 担当介護者名             |
| activeAlerts | number         | アクティブなアラート数   |
| lastLogAt    | string \| null | 最終ログ日時（ISO 8601） |

---

### GET /users-detail

利用者詳細を取得します（最近のログ・アラート含む）。

**リクエスト:**

```bash
curl "http://localhost:54321/functions/v1/users-detail?id=1"
```

**パラメータ:**

| パラメータ | 型     | 必須 | 説明      |
| ---------- | ------ | ---- | --------- |
| id         | number | Yes  | 利用者 ID |

**レスポンス例:**

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
  ],
  "alerts": [
    {
      "id": 1,
      "level": "red",
      "title": "服薬漏れが2日連続",
      "description": "12/12, 12/13と連続で服薬忘れが発生",
      "status": "active"
    }
  ]
}
```

**レスポンスフィールド:**

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
| alerts     | array          | アクティブなアラート一覧 |

---

## 未実装 API

### POST /logs/preview

AI がログ内容からタグとアラートを分析します。

**リクエスト:**

```json
{
  "content": "夕食は8割ほど摂取。服薬は本人が忘れていたため声かけで対応。"
}
```

**レスポンス:**

```json
{
  "tags": ["食事", "服薬"],
  "alert": {
    "level": "yellow",
    "title": "服薬忘れ",
    "description": "本人が服薬を忘れており声かけが必要だった"
  }
}
```

---

### POST /logs/confirm

ログを確定して DB に保存します。

**リクエスト:**

```json
{
  "userId": 1,
  "caregiverId": 2,
  "date": "2024-12-13",
  "time": "18:30",
  "content": "夕食は8割ほど摂取...",
  "tags": ["食事", "服薬"],
  "alert": {
    "level": "yellow",
    "title": "服薬忘れ",
    "description": "..."
  }
}
```

**レスポンス:**

```json
{
  "logId": 5,
  "alertId": 3
}
```

---

### PATCH /alerts/:id

アラートのステータスを更新します。

**リクエスト:**

```json
{
  "status": "resolved"
}
```

**ステータス値:** `active` / `resolved`

**レスポンス:**

```json
{
  "id": 3,
  "status": "resolved"
}
```

---

### POST /care-plan/generate

AI が介護計画を生成して DB に保存します。

**リクエスト:**

```json
{
  "userId": 1
}
```

**レスポンス:**

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

---

### PATCH /care-plan/:id

介護計画のステータスを更新します。

**リクエスト:**

```json
{
  "status": "implemented"
}
```

**ステータス値:** `pending` / `implemented` / `deleted`

**レスポンス:**

```json
{
  "id": 5,
  "status": "implemented"
}
```

---

## エラーレスポンス

すべての API は以下の形式でエラーを返します。

```json
{
  "error": "エラーメッセージ"
}
```

**HTTP ステータスコード:**

| コード | 説明                   |
| ------ | ---------------------- |
| 400    | リクエスト不正         |
| 404    | リソースが見つからない |
| 405    | メソッド不許可         |
| 500    | サーバーエラー         |

---

## 更新日

2025 年 12 月 13 日
