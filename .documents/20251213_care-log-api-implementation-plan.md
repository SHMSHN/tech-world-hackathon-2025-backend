# ケアログAPI 残りエンドポイント実装計画

## 概要
既存のtranscribe APIに加え、残り6つのエンドポイントとDBスキーマを実装する

## 現状
- ✅ POST /transcribe - 実装済み
- ✅ AI抽象化レイヤー - 実装済み（OpenAI/Sakura切り替え可能）
- ✅ CORSユーティリティ - 実装済み

---

## さくらAI対応

### APIエンドポイント
- ベースURL: `https://api.ai.sakura.ad.jp/v1/`
- 認証: `Authorization: Bearer <Token>`

### 利用可能モデル
| 用途 | モデル名 |
|------|----------|
| 音声文字起こし | whisper-large-v3-turbo |
| テキスト生成 | Qwen3-Coder-480B, gpt-oss-120b, llm-jp-3.1-8x13b-instruct4 |

### 制限
- Whisper: 30分以下、30MB以下

### 環境変数
```
AI_PROVIDER=sakura
SAKURA_API_KEY=your-sakura-token
SAKURA_BASE_URL=https://api.ai.sakura.ad.jp/v1
SAKURA_CHAT_MODEL=gpt-oss-120b
```

---

## 実装内容

### Phase 1: データベース

**マイグレーションファイル作成:**
```
supabase/migrations/
├── 20251213000000_create_users.sql
├── 20251213000001_create_caregivers.sql
├── 20251213000002_create_logs.sql
├── 20251213000003_create_alerts.sql
├── 20251213000004_create_care_plans.sql
└── 20251213000005_seed_data.sql
```

**テーブル設計:**

#### users（患者/利用者）
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  age INTEGER,
  gender TEXT,                    -- 性別
  phone TEXT,                     -- 電話番号
  address TEXT,                   -- 住所
  primary_caregiver_id INTEGER,   -- 担当ケアギバーID（FK）
  care_level TEXT,                -- 要介護レベル
  start_date DATE,                -- サービス開始日
  notes TEXT,                     -- 備考
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### caregivers（ケアギバー/介護者）
```sql
CREATE TABLE caregivers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT,                      -- family/helper/nurse等
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### logs（介護記録）
```sql
CREATE TABLE logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  caregiver_id INTEGER REFERENCES caregivers(id),
  date DATE NOT NULL,
  time TIME NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[],                    -- PostgreSQL配列 ["食事", "服薬"]
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### alerts（要注意点）
```sql
CREATE TABLE alerts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  log_id INTEGER REFERENCES logs(id),
  level TEXT NOT NULL,            -- red/yellow
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',   -- active/monitoring/resolved
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### care_plans（介護計画）
```sql
CREATE TABLE care_plans (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  summary TEXT,
  goals JSONB,                    -- 目標配列（カテゴリ、短期/長期目標、アクション）
  notes TEXT,
  status TEXT DEFAULT 'pending', -- pending(未実施) / implemented(実施) / deleted(削除)
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Phase 2: 共有ユーティリティ拡張

**追加ファイル:**
```
supabase/functions/_shared/
├── supabase-client.ts  # Supabaseクライアント生成
├── response.ts         # レスポンスヘルパー（オプション）
└── ai/
    └── types.ts        # LogPreviewResult型を追加
```

### Phase 3: AI抽象化レイヤー拡張

**types.ts に追加:**
```typescript
interface LogPreviewResult {
  tags: string[];
  alert: {
    level: "red" | "yellow";
    title: string;
    description: string;
  } | null;
}

interface CarePlanResult {
  summary: string;
  goals: {
    category: string;
    shortTerm: string;
    longTerm: string;
    actions: string[];
  }[];
  notes: string;
}

interface AIProvider extends TranscriptionProvider {
  generateLogPreview(content: string): Promise<LogPreviewResult>;
  generateCarePlan(user: User, logs: Log[], alerts: Alert[]): Promise<CarePlanResult>;
}
```

**openai.ts に追加:**
- `generateLogPreview()` - GPT-4o-miniでタグ・アラート分析
- `generateCarePlan()` - GPT-4o-miniで介護計画生成

**sakura.ts を完全実装:**
- `transcribe()` - whisper-large-v3-turboで音声文字起こし
- `generateLogPreview()` - gpt-oss-120bでタグ・アラート分析
- `generateCarePlan()` - gpt-oss-120bで介護計画生成

**さくらAI実装詳細:**
```typescript
// sakura.ts（OpenAI互換形式）
export class SakuraProvider implements AIProvider {
  private baseUrl = "https://api.ai.sakura.ad.jp/v1";
  private chatModel = "gpt-oss-120b";
  private whisperModel = "whisper-large-v3-turbo";

  async transcribe(audio: Uint8Array, mimeType: string) {
    // POST /audio/transcriptions
  }

  async generateLogPreview(content: string) {
    // POST /chat/completions
    // プロンプトでタグとアラートをJSON出力
  }

  async generateCarePlan(user, logs, alerts) {
    // POST /chat/completions
    // プロンプトで介護計画をJSON出力
  }
}
```

### Phase 4: Edge Functions作成

| 関数名 | パス | 用途 |
|--------|------|------|
| logs-preview | POST /logs/preview | テキスト→AI要約 |
| logs-confirm | POST /logs/confirm | 確定してDB保存 |
| users | GET /users | 利用者一覧 |
| users-detail | GET /users/:id | 利用者詳細 |
| alerts-update | PATCH /alerts/:id | アラート更新 |
| care-plan | POST /care-plan/generate | 介護計画生成 |
| care-plan-update | PATCH /care-plan/:id | 介護計画ステータス更新 |

---

## 作成ファイル一覧

```
supabase/
├── migrations/
│   ├── 20251213000000_create_users.sql
│   ├── 20251213000001_create_caregivers.sql
│   ├── 20251213000002_create_logs.sql
│   ├── 20251213000003_create_alerts.sql
│   ├── 20251213000004_create_care_plans.sql
│   └── 20251213000005_seed_data.sql
└── functions/
    ├── _shared/
    │   ├── supabase-client.ts (新規)
    │   └── ai/
    │       ├── types.ts (更新)
    │       └── providers/
    │           ├── openai.ts (更新)
    │           └── sakura.ts (完全実装)
    ├── logs-preview/
    │   └── index.ts (新規)
    ├── logs-confirm/
    │   └── index.ts (新規)
    ├── users/
    │   └── index.ts (新規)
    ├── users-detail/
    │   └── index.ts (新規)
    ├── alerts-update/
    │   └── index.ts (新規)
    ├── care-plan/
    │   └── index.ts (新規)
    └── care-plan-update/
        └── index.ts (新規)
```

---

## 実装順序

1. **DBマイグレーション作成** - users, logs, alerts テーブル + シードデータ
2. **supabase-client.ts作成** - DB接続用クライアント
3. **AI types.ts拡張** - LogPreviewResult, CarePlanResult型追加
4. **openai.ts拡張** - generateLogPreview(), generateCarePlan()追加
5. **logs-preview作成** - AI要約プレビュー
6. **logs-confirm作成** - DB保存（logs + alerts）
7. **users作成** - 利用者一覧（最新アラート付き）
8. **users-detail作成** - 利用者詳細 + ログ + アラート
9. **alerts-update作成** - アラートステータス更新
10. **care-plan作成** - AI介護計画生成
11. **config.toml更新** - 全関数のverify_jwt設定

---

## API詳細

### POST /logs/preview
AIがログ内容からタグとアラートを分析
```typescript
// Request
{ "content": "夕食は8割ほど摂取。服薬は本人が忘れていたため声かけで対応。" }

// Response
{
  "tags": ["食事", "服薬"],
  "alert": {
    "level": "yellow",
    "title": "服薬忘れ",
    "description": "本人が服薬を忘れており声かけが必要だった"
  }
}
```

### POST /logs/confirm
```typescript
// Request
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

// Response
{ "logId": 5, "alertId": 3 }
```

### GET /users
```typescript
// Response
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

### GET /users/:id
```typescript
// Response
{
  "id": 1,
  "name": "山田 花子",
  "age": 82,
  "gender": "女性",
  "phone": "090-1234-5678",
  "address": "東京都世田谷区...",
  "careLevel": "要介護2",
  "startDate": "2024-04-01",
  "notes": "高血圧...",
  "caregiver": { "id": 2, "name": "田中 美咲" },
  "recentLogs": [
    { "id": 1, "date": "2024-12-13", "time": "18:30", "author": "田中 美咲", "content": "...", "tags": ["食事"] }
  ],
  "alerts": [
    { "id": 1, "level": "red", "title": "服薬漏れが2日連続", "status": "active" }
  ]
}
```

### PATCH /alerts/:id
```typescript
// Request
{ "status": "resolved" }  // active / monitoring / resolved

// Response
{ "id": 3, "status": "resolved" }
```

### POST /care-plan/generate
AIが介護計画を生成してDBに保存
```typescript
// Request
{ "userId": 1 }

// Response
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

### PATCH /care-plan/:id
介護計画のステータス更新
```typescript
// Request
{ "status": "implemented" }  // pending(未実施) / implemented(実施) / deleted(削除)

// Response
{ "id": 5, "status": "implemented" }
```

---

## 環境変数

### Supabase（自動提供）
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

### AI プロバイダー切り替え
```bash
# OpenAI使用時
AI_PROVIDER=openai
OPENAI_API_KEY=sk-xxx

# さくらAI使用時
AI_PROVIDER=sakura
SAKURA_API_KEY=your-sakura-token
SAKURA_BASE_URL=https://api.ai.sakura.ad.jp/v1
SAKURA_CHAT_MODEL=gpt-oss-120b  # オプション（デフォルト: gpt-oss-120b）
```

---

## 作成日
2025年12月13日
