# /logs/confirm API 実装計画

## 概要

`/logs/confirm` APIを実装し、ログをDBに保存する。
また、tagsカラムを削除し、Supabase Realtimeを有効化してログ一覧ページにリアルタイム反映する。

---

## API仕様

### POST /logs/confirm

**リクエスト:**
```json
{
  "userId": 1,
  "caregiverId": 2,
  "date": "2024-12-13",
  "time": "18:30",
  "content": "夕食は8割ほど摂取..."
}
```

| フィールド  | 型     | 必須 | 説明                 |
|-------------|--------|------|----------------------|
| userId      | number | Yes  | 利用者 ID            |
| caregiverId | number | Yes  | 介護者 ID            |
| date        | string | Yes  | 記録日（YYYY-MM-DD） |
| time        | string | Yes  | 記録時刻（HH:MM）    |
| content     | string | Yes  | 記録内容             |

**レスポンス:**
- 成功時: ステータス200（空レスポンス）
- エラー時: `{ "error": "エラーメッセージ" }`

---

## 実装ファイル

### 1. マイグレーション: `supabase/migrations/20251213000004_remove_tags_enable_realtime.sql`

```sql
-- tagsカラムとインデックスを削除
DROP INDEX IF EXISTS idx_logs_tags;
ALTER TABLE logs DROP COLUMN IF EXISTS tags;

-- Supabase Realtimeを有効化
ALTER PUBLICATION supabase_realtime ADD TABLE logs;
```

### 2. API: `supabase/functions/logs-confirm/index.ts`

```typescript
// 処理フロー
1. CORSプリフライト対応
2. POSTメソッドのみ許可
3. JSONボディから userId, caregiverId, date, time, content を取得
4. バリデーション（必須フィールドチェック）
5. SupabaseクライアントでlogsテーブルにINSERT
6. ステータス200を返す
```

**依存:**
- `_shared/cors.ts` - CORSヘッダー
- `_shared/supabase-client.ts` - DBクライアント

### 3. API設計書更新: `supabase/.documents/_api-design.md`
- tagsフィールドを削除
- レスポンス仕様を更新

---

## Realtime連携

フロントエンドでのサブスクリプション例:
```typescript
const channel = supabase
  .channel('logs')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'logs'
  }, (payload) => {
    // 新しいログを一覧に追加
  })
  .subscribe();
```

---

## 実装順序

1. マイグレーション作成・適用
2. logs-confirm API作成
3. API設計書更新
4. 動作確認
