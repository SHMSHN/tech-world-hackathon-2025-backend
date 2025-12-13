# ケアログAPI実装計画（Phase 1: transcribeのみ）

## 概要
Supabase + Edge Functionsを使用した音声文字起こしAPI

## 技術スタック
- **ランタイム**: Supabase Edge Functions (Deno)
- **AI**: OpenAI Whisper ※後からさくらAIに置き換え可能な設計

## 確定事項
- **レスポンス形式**: 直接（ラッパーなし）
- **認証**: なし

---

## ディレクトリ構成

```
supabase/
├── config.toml
└── functions/
    ├── _shared/
    │   ├── cors.ts
    │   └── ai/
    │       ├── types.ts
    │       ├── provider-factory.ts
    │       └── providers/
    │           ├── openai.ts
    │           └── sakura.ts (スタブ)
    └── transcribe/
        └── index.ts
```

---

## AI抽象化レイヤー（Adapterパターン）

### インターフェース設計
```typescript
interface TranscriptionProvider {
  name: string;
  transcribe(audio: Uint8Array, mimeType: string): Promise<TranscriptionResult>;
}

interface TranscriptionResult {
  text: string;
}
```

### プロバイダー切り替え
環境変数 `AI_PROVIDER` で切り替え:
- `openai` (デフォルト) → OpenAIProvider
- `sakura` → SakuraProvider (スタブのみ)

---

## POST /transcribe

**リクエスト:**
```
Content-Type: multipart/form-data
audio: (音声ファイル)
```

**レスポンス（成功）:**
```json
{
  "text": "今日は7時に起床しました。"
}
```

**レスポンス（エラー）:**
```json
{
  "error": "音声ファイルがありません"
}
```

**仕様:**
- 対応形式: mp3, mp4, m4a, wav, webm
- サイズ制限: 25MB（OpenAI Whisper上限）

---

## 実装手順

1. `supabase init` でプロジェクト初期化
2. 共有ユーティリティ作成（`_shared/cors.ts`）
3. AI抽象化レイヤー作成（`_shared/ai/`）
4. transcribe Edge Function作成
5. ローカルテスト

---

## 環境変数

| 変数名 | 必須 | 説明 |
|--------|------|------|
| AI_PROVIDER | - | openai / sakura (default: openai) |
| OPENAI_API_KEY | ○ | OpenAI APIキー |

---

## 作成したファイル一覧

```
supabase/config.toml
supabase/functions/_shared/cors.ts
supabase/functions/_shared/ai/types.ts
supabase/functions/_shared/ai/provider-factory.ts
supabase/functions/_shared/ai/providers/openai.ts
supabase/functions/_shared/ai/providers/sakura.ts
supabase/functions/transcribe/index.ts
.env.example
.gitignore
```

---

## 実装完了日
2025年12月13日
