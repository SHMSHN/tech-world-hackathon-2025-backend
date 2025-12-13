# /logs/preview API 実装計画

## 概要

1. `/logs/preview` - 音声ファイルを受け取り、文字起こし→要約→タグ抽出を行う（新規）
2. `/summarize` - 既存APIを改修し、要約に加えてタグ抽出も行う

両APIとも `{ summary, tags }` を返す統一レスポンス形式

---

## API仕様

### POST /logs/preview（新規）

**リクエスト:**
```
Content-Type: multipart/form-data
Form Fields:
- audio: File (required) - 音声ファイル（mp3, mp4, m4a, wav, webm等、最大25MB）
```

**レスポンス:**
```json
{
  "summary": "朝食を全量摂取し、服薬も完了した。",
  "tags": ["食事", "服薬"]
}
```

### POST /summarize（改修）

**リクエスト:** 変更なし（JSON/FormData/text/plain対応）

**レスポンス:** `{ summary }` → `{ summary, tags }` に変更
```json
{
  "summary": "朝食を全量摂取し、服薬も完了した。",
  "tags": ["食事", "服薬"]
}
```

## 処理フロー

```
音声ファイル → [1]文字起こし → [2]要約 + [3]タグ抽出（並列） → レスポンス
```

## 実装ファイル

### 1. 型定義追加: `supabase/functions/_shared/ai/types.ts`
- `VALID_TAGS` 定数（食事, 服薬, 入浴, 排泄, 体調, 行動, 通院）
- `ValidTag` 型
- `TagExtractionResult` インターフェース
- `TagExtractionProvider` インターフェース

### 2. タグ抽出機能追加: `supabase/functions/_shared/ai/providers/sakura-chat.ts`
- `SakuraChatProvider`に`TagExtractionProvider`インターフェースを追加実装
- `extractTags(text: string)` メソッド追加
- タグ抽出用プロンプト（有効タグのみ出力するよう制約）
- レスポンスパーサー（カンマ区切りからタグ配列へ変換）

### 3. ファクトリ関数追加: `supabase/functions/_shared/ai/provider-factory.ts`
- `getTagExtractionProvider()` 関数追加

### 4. 既存API改修: `supabase/functions/summarize/index.ts`
- `getTagExtractionProvider()` をインポート
- 要約とタグ抽出を並列実行（`Promise.all`）
- レスポンスを `{ summary, tags }` に変更

### 5. 新規API作成: `supabase/functions/logs-preview/index.ts`
- 音声ファイル検証（transcribeと同じパターン）
- 文字起こし実行
- 要約とタグ抽出を並列実行（`Promise.all`）
- レスポンス構築 `{ summary, tags }`

## タグ抽出プロンプト設計

```
あなたは介護記録のタグ分類アシスタントです。
入力テキストを分析し、該当するタグをカンマ区切りで出力してください。

【選択可能なタグ】
食事, 服薬, 入浴, 排泄, 体調, 行動, 通院

【出力形式】
タグ名をカンマ区切りで出力（例: 食事, 服薬）
該当なしの場合は「なし」と出力
```

## エラーハンドリング

各ステップで失敗時は`step`フィールドで失敗箇所を明示:
```json
{
  "error": "エラーメッセージ",
  "step": "transcription" | "summarization" | "tag_extraction"
}
```

## 実装順序

1. `types.ts` - タグ関連の型定義追加
2. `sakura-chat.ts` - タグ抽出メソッド追加
3. `provider-factory.ts` - `getTagExtractionProvider()` 追加
4. `summarize/index.ts` - 既存API改修（タグ抽出追加）
5. `logs-preview/index.ts` - 新規APIエンドポイント作成
