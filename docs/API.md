# API 仕様書

フロントエンド開発者向け API 仕様ドキュメント

## 基本情報

| 項目                 | 値                                    |
| -------------------- | ------------------------------------- |
| Base URL（ローカル） | `http://localhost:54321/functions/v1` |
| 認証                 | なし（JWT 検証無効）                  |
| Content-Type         | `application/json`（特記なき場合）    |

### CORS

全エンドポイントで以下に対応:

- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`

### エラーレスポンス形式

全エンドポイント共通:

```json
{ "error": "エラーメッセージ" }
```

---

## 画面別エンドポイント対応表

| 画面           | 機能                 | エンドポイント       | 状態      |
| -------------- | -------------------- | -------------------- | --------- |
| Dashboard      | Patients リスト      | `GET /users`         | ✅        |
| Patient Detail | ログ一覧 + User 情報 | `GET /users-detail`  | ✅        |
| Patient Detail | 介護計画生成         | -                    | ⚠️ 未実装 |
| Patient Detail | Goals 編集           | -                    | ⚠️ 未実装 |
| App            | Log 生成（Whisper）  | `POST /logs-preview` | ✅        |
| App            | Log 確定（DB 保存）  | `POST /logs-confirm` | ✅        |
| App            | Patient 選択         | `GET /users`         | ✅        |
| App            | User 情報            | `GET /users-detail`  | ✅        |
| App            | Goals 編集           | -                    | ⚠️ 未実装 |

---

## エンドポイント詳細

### 1. GET /users

**Patients のリストを返す（あいうえお順）**

#### リクエスト

```bash
GET /users
```

#### レスポンス（200 OK）

```json
[
  {
    "id": 1,
    "name": "山田太郎",
    "nameKana": "やまだたろう",
    "age": 78,
    "gender": "男性",
    "careLevel": "要介護2",
    "caregiver": "田中花子",
    "lastLogAt": "2025-12-13T14:30:00Z"
  }
]
```

#### レスポンスフィールド

| フィールド | 型             | 説明                     |
| ---------- | -------------- | ------------------------ |
| id         | number         | 利用者 ID                |
| name       | string         | 氏名                     |
| nameKana   | string \| null | ふりがな                 |
| age        | number \| null | 年齢                     |
| gender     | string \| null | 性別                     |
| careLevel  | string \| null | 要介護レベル             |
| caregiver  | string \| null | 担当介護者名             |
| lastLogAt  | string \| null | 最新ログ日時（ISO 8601） |

#### エラー

| ステータス | 内容                                            |
| ---------- | ----------------------------------------------- |
| 500        | `{ "error": "利用者一覧の取得に失敗しました" }` |

---

### 2. GET /users-detail

**User (Patient) の詳細情報 + ログ一覧を返す**

#### リクエスト

2 つの方式に対応:

```bash
GET /users-detail?id=1        # クエリパラメータ
GET /users-detail/1           # パスパラメータ
```

#### レスポンス（200 OK）

```json
{
  "id": 1,
  "name": "山田太郎",
  "nameKana": "やまだたろう",
  "age": 78,
  "gender": "男性",
  "phone": "090-1234-5678",
  "address": "東京都渋谷区1-2-3",
  "careLevel": "要介護2",
  "startDate": "2024-01-15",
  "notes": "高血圧あり。朝食は刻み食推奨。",
  "caregiver": {
    "id": 1,
    "name": "田中花子"
  },
  "recentLogs": [
    {
      "id": 42,
      "createdAt": "2025-12-13T14:30:00Z",
      "author": "田中花子",
      "content": "朝食は全食。食後に血圧測定120/80。"
    }
  ]
}
```

#### レスポンスフィールド

| フィールド             | 型             | 説明                         |
| ---------------------- | -------------- | ---------------------------- |
| id                     | number         | 利用者 ID                    |
| name                   | string         | 氏名                         |
| nameKana               | string \| null | ふりがな                     |
| age                    | number \| null | 年齢                         |
| gender                 | string \| null | 性別                         |
| phone                  | string \| null | 電話番号                     |
| address                | string \| null | 住所                         |
| careLevel              | string \| null | 要介護レベル                 |
| startDate              | string \| null | サービス開始日（YYYY-MM-DD） |
| notes                  | string \| null | 備考・注意事項               |
| caregiver              | object \| null | 担当介護者                   |
| caregiver.id           | number         | 介護者 ID                    |
| caregiver.name         | string         | 介護者氏名                   |
| recentLogs             | array          | 最新ログ（最大 10 件、降順） |
| recentLogs[].id        | number         | ログ ID                      |
| recentLogs[].createdAt | string         | 作成日時（ISO 8601）         |
| recentLogs[].author    | string         | 作成者名                     |
| recentLogs[].content   | string         | ログ本文                     |

#### エラー

| ステータス | 内容                                            |
| ---------- | ----------------------------------------------- |
| 400        | `{ "error": "利用者IDが指定されていません" }`   |
| 400        | `{ "error": "利用者IDが不正です" }`             |
| 404        | `{ "error": "利用者が見つかりません" }`         |
| 500        | `{ "error": "利用者詳細の取得に失敗しました" }` |

---

### 3. POST /logs-preview

**音声ファイルからログを生成する（Whisper 文字起こし + 要約）**

#### リクエスト

- **Content-Type:** `multipart/form-data`
- **フィールド:** `audio`（音声ファイル）

```bash
curl -X POST /logs-preview -F "audio=@recording.m4a"
```

#### 対応フォーマット

| 形式 | MIME Type             |
| ---- | --------------------- |
| mp3  | audio/mpeg, audio/mp3 |
| mp4  | audio/mp4             |
| m4a  | audio/m4a             |
| wav  | audio/wav             |
| webm | audio/webm            |
| ogg  | audio/ogg             |
| flac | audio/flac            |

**サイズ上限:** 25MB

#### レスポンス（200 OK）

```json
{
  "summary": "朝7時に起床。食事は全食。特に問題なし。"
}
```

#### エラー

| ステータス | 内容                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------ |
| 400        | `{ "error": "Content-Typeはmultipart/form-dataである必要があります" }`                     |
| 400        | `{ "error": "音声ファイルがありません" }`                                                  |
| 400        | `{ "error": "ファイルサイズが大きすぎます（上限: 25MB）" }`                                |
| 400        | `{ "error": "対応していない音声形式です。対応形式: mp3, mp4, m4a, wav, webm, ogg, flac" }` |
| 400        | `{ "error": "音声から文字を認識できませんでした" }`                                        |
| 500        | `{ "error": "文字起こしに失敗しました", "step": "transcription" }`                         |
| 500        | `{ "error": "要約に失敗しました", "step": "summarization" }`                               |

---

### 4. POST /logs-confirm

**ログを確定して DB に保存する（最終確認後）**

#### リクエスト

- **Content-Type:** `application/json`

```json
{
  "userId": 1,
  "caregiverId": 2,
  "content": "朝7時に起床。食事は全食。特に問題なし。"
}
```

#### リクエストフィールド

| フィールド  | 型     | 必須 | 説明      |
| ----------- | ------ | ---- | --------- |
| userId      | number | ○    | 利用者 ID |
| caregiverId | number | ○    | 介護者 ID |
| content     | string | ○    | ログ本文  |

#### レスポンス（200 OK）

ボディなし（ステータス 200 のみ）

#### エラー

| ステータス | 内容                                                                |
| ---------- | ------------------------------------------------------------------- |
| 400        | `{ "error": "Content-Typeはapplication/jsonである必要があります" }` |
| 400        | `{ "error": "userIdは必須です" }`                                   |
| 400        | `{ "error": "caregiverIdは必須です" }`                              |
| 400        | `{ "error": "contentは必須です" }`                                  |
| 500        | `{ "error": "ログの保存に失敗しました" }`                           |

---

### 5. POST /transcribe

**音声ファイルをテキストに変換する（文字起こしのみ）**

`/logs-preview` との違い: 要約処理を行わず、文字起こし結果をそのまま返す。

#### リクエスト

- **Content-Type:** `multipart/form-data`
- **フィールド:** `audio`（音声ファイル）

```bash
curl -X POST /transcribe -F "audio=@recording.m4a"
```

#### 対応フォーマット

`/logs-preview` と同じ

**サイズ上限:** 25MB

#### レスポンス（200 OK）

```json
{
  "text": "今日は朝7時に起床しました。食事は全食でした。"
}
```

#### エラー

| ステータス | 内容                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------ |
| 400        | `{ "error": "Content-Typeはmultipart/form-dataである必要があります" }`                     |
| 400        | `{ "error": "音声ファイルがありません" }`                                                  |
| 400        | `{ "error": "ファイルサイズが大きすぎます（上限: 25MB）" }`                                |
| 400        | `{ "error": "対応していない音声形式です。対応形式: mp3, mp4, m4a, wav, webm, ogg, flac" }` |
| 500        | `{ "error": "文字起こしに失敗しました" }`                                                  |

---

### 6. POST /summarize

**テキストを要約する**

#### リクエスト

複数の Content-Type に対応:

**application/json（推奨）:**

```bash
curl -X POST /summarize \
  -H "Content-Type: application/json" \
  -d '{"text": "要約したいテキスト..."}'
```

**multipart/form-data:**

```bash
curl -X POST /summarize -F "text=要約したいテキスト..."
```

**text/plain:**

```bash
curl -X POST /summarize \
  -H "Content-Type: text/plain" \
  -d "要約したいテキスト..."
```

#### リクエストフィールド

| フィールド | 型     | 必須 | 説明               |
| ---------- | ------ | ---- | ------------------ |
| text       | string | ○    | 要約対象のテキスト |

#### レスポンス（200 OK）

```json
{
  "summary": "要約されたテキスト。"
}
```

#### エラー

| ステータス | 内容                                                                                                             |
| ---------- | ---------------------------------------------------------------------------------------------------------------- |
| 400        | `{ "error": "サポートされていないContent-Typeです（application/json, multipart/form-data, text/plainに対応）" }` |
| 400        | `{ "error": "textフィールドは必須です" }`                                                                        |
| 500        | `{ "error": "要約に失敗しました" }`                                                                              |

---

## 未実装エンドポイント

以下の機能は現在未実装です:

| 機能                        | 備考                     |
| --------------------------- | ------------------------ |
| 介護計画生成（assess-risk） | エンドポイント未作成     |
| Goals 取得                  | DB に goals テーブルなし |
| Goals 編集                  | DB に goals テーブルなし |
| ログ編集（既存ログの更新）  | エンドポイントなし       |

---

## 使用フロー

### ログ作成フロー

```
1. POST /logs-preview（音声アップロード）
   ↓ { summary: "要約テキスト" }
2. ユーザーが内容を確認・編集
   ↓
3. POST /logs-confirm（確定・保存）
   ↓ 200 OK
```

### 代替フロー（文字起こしのみ）

```
1. POST /transcribe（音声アップロード）
   ↓ { text: "文字起こしテキスト" }
2. POST /summarize（テキスト要約）
   ↓ { summary: "要約テキスト" }
3. ユーザーが内容を確認・編集
   ↓
4. POST /logs-confirm（確定・保存）
   ↓ 200 OK
```

---

## 補足

### 日時フォーマット

全ての日時は **ISO 8601 形式** で返却:

```
2025-12-13T14:30:00Z
```

### 認証について

現在は全エンドポイントで `verify_jwt = false`（認証なし）です。
本番環境では認証を有効化する必要があります。
