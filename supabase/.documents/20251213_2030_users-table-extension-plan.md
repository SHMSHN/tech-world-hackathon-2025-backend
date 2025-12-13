# usersテーブル拡張 + ダミーデータ追加 実装計画

## 概要

1. usersテーブルに`name_kana`（ふりがな）カラムを追加
2. 被介護者のダミーデータを15名に増加
3. users APIで`nameKana`を返すように修正
4. users APIの`lastLogAt`取得を`created_at`に変更（date/time削除に対応）

---

## 実装ファイル

### 1. マイグレーション追加

**ファイル:** `supabase/migrations/20251213000006_add_name_kana.sql`

```sql
-- usersテーブルにふりがなカラムを追加
ALTER TABLE users ADD COLUMN name_kana TEXT;

-- 既存データにふりがなを設定
UPDATE users SET name_kana = 'やまだ はなこ' WHERE name = '山田 花子';
UPDATE users SET name_kana = 'すずき たろう' WHERE name = '鈴木 太郎';
UPDATE users SET name_kana = 'たかはし かずこ' WHERE name = '高橋 和子';
```

### 2. シードデータ更新

**ファイル:** `supabase/migrations/20251213000005_seed_data.sql`

- 被介護者を15名に増加
- name_kanaカラムにふりがなを設定

### 3. users API修正

**ファイル:** `supabase/functions/users/index.ts`

- `nameKana`フィールドを追加
- `lastLogAt`の取得を`created_at`に変更

### 4. users-detail API修正

**ファイル:** `supabase/functions/users-detail/index.ts`

- `nameKana`フィールドを追加

---

## ダミーデータ（15名）

| 名前 | ふりがな | 年齢 | 性別 | 要介護レベル |
|------|----------|------|------|--------------|
| 山田 花子 | やまだ はなこ | 82歳 | 女性 | 要介護2 |
| 鈴木 太郎 | すずき たろう | 75歳 | 男性 | 要介護1 |
| 高橋 和子 | たかはし かずこ | 88歳 | 女性 | 要介護3 |
| 田中 一郎 | たなか いちろう | 79歳 | 男性 | 要介護2 |
| 佐藤 美代子 | さとう みよこ | 84歳 | 女性 | 要介護1 |
| 伊藤 正男 | いとう まさお | 91歳 | 男性 | 要介護4 |
| 渡辺 節子 | わたなべ せつこ | 77歳 | 女性 | 要介護1 |
| 山本 勝 | やまもと まさる | 86歳 | 男性 | 要介護3 |
| 中村 君子 | なかむら きみこ | 80歳 | 女性 | 要介護2 |
| 小林 茂 | こばやし しげる | 73歳 | 男性 | 要支援2 |
| 加藤 幸子 | かとう さちこ | 89歳 | 女性 | 要介護5 |
| 吉田 清 | よしだ きよし | 81歳 | 男性 | 要介護2 |
| 松本 文子 | まつもと ふみこ | 76歳 | 女性 | 要介護1 |
| 井上 武 | いのうえ たけし | 85歳 | 男性 | 要介護3 |
| 木村 トメ | きむら とめ | 94歳 | 女性 | 要介護4 |

---

## APIレスポンス変更

### GET /users

```json
[
  {
    "id": 1,
    "name": "山田 花子",
    "nameKana": "やまだ はなこ",
    "age": 82,
    "gender": "女性",
    "careLevel": "要介護2",
    "caregiver": "田中 美咲",
    "lastLogAt": "2024-12-13T18:30:00Z"
  }
]
```

### GET /users-detail

```json
{
  "id": 1,
  "name": "山田 花子",
  "nameKana": "やまだ はなこ",
  "age": 82,
  ...
}
```

---

## 実装手順

1. マイグレーションファイル作成（name_kanaカラム追加）
2. シードデータ更新（15名分のデータ）
3. users API修正（nameKana追加、lastLogAt修正）
4. users-detail API修正（nameKana追加）
5. API設計書更新

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2025-12-13 | 初版作成 |
