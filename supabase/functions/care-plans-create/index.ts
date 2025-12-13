declare const Deno: any;
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";

type PlanLevel = "alert" | "warning";
type PlanStatus = "pending" | "done";

interface CreateItemInput {
  uuid?: string; // 任意。未指定ならサーバーで生成
  title?: string;
  goal?: string;
  tasks?: unknown; // 後で正規化（string[]）
  level?: PlanLevel;
  status?: PlanStatus;
}

interface CreateRequestBody {
  user_id?: number | string;
  items?: CreateItemInput[];
  replace_pending?: boolean; // true の場合、既存の pending を消してから登録
}

function parseUserId(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter((x) => x.length > 0);
  }
  if (typeof value === "string") {
    // カンマ区切り、または JSON 文字列配列の両対応
    const s = value.trim();
    if (!s) return [];
    try {
      if (s.startsWith("[")) {
        const arr = JSON.parse(s);
        if (Array.isArray(arr)) {
          return arr
            .map((x) => (typeof x === "string" ? x.trim() : ""))
            .filter((x) => x.length > 0);
        }
      }
      return s
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
    } catch {
      return s
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
    }
  }
  return [];
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const contentType = req.headers.get("content-type") ?? "";
    let userId: number | null = null;
    let items: CreateItemInput[] = [];
    let replacePending = false;

    if (contentType.includes("application/json")) {
      const body = (await req.json()) as CreateRequestBody;
      userId = parseUserId(body.user_id);
      items = Array.isArray(body.items) ? body.items : [];
      replacePending = Boolean(body.replace_pending);
    } else if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      userId = parseUserId(form.get("user_id"));
      const itemsField = form.get("items");
      replacePending =
        String(form.get("replace_pending") || "").toLowerCase() === "true";
      if (typeof itemsField === "string" && itemsField.trim()) {
        try {
          const parsed = JSON.parse(itemsField);
          if (Array.isArray(parsed)) items = parsed;
        } catch {
          // ignore
        }
      }
    } else if (contentType.startsWith("text/plain")) {
      try {
        const text = await req.text();
        const body = JSON.parse(text) as CreateRequestBody;
        userId = parseUserId(body.user_id);
        items = Array.isArray(body.items) ? body.items : [];
        replacePending = Boolean(body.replace_pending);
      } catch {
        // ignore
      }
    } else {
      return new Response(
        JSON.stringify({ error: "Unsupported Content-Type" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (userId == null) {
      return new Response(JSON.stringify({ error: "user_id は必須です" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ error: "items は1件以上必要です" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 正規化とバリデーション
    const normalized = items
      .map((it, idx) => {
        const title = typeof it.title === "string" ? it.title.trim() : "";
        if (!title) return null;
        const goal = typeof it.goal === "string" ? it.goal.trim() : "";
        const tasks = toStringArray(it.tasks);
        const level: PlanLevel = it.level === "alert" ? "alert" : "warning";
        const status: PlanStatus = it.status === "done" ? "done" : "pending";
        const uuid =
          typeof it.uuid === "string" && it.uuid.trim()
            ? it.uuid.trim()
            : (globalThis as any)?.crypto?.randomUUID
            ? (globalThis as any).crypto.randomUUID()
            : `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 10)}`;
        return { title, goal, tasks, level, status, uuid };
      })
      .filter(Boolean) as Array<{
      title: string;
      goal: string;
      tasks: string[];
      level: PlanLevel;
      status: PlanStatus;
      uuid: string;
    }>;

    if (normalized.length === 0) {
      return new Response(
        JSON.stringify({ error: "有効な items がありません（title が必須）" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = getSupabaseClient();

    // オプション: 既存の pending を削除
    if (replacePending) {
      const { error: delErr } = await supabase
        .from("care_plans")
        .delete()
        .eq("user_id", userId)
        .eq("status", "pending");
      if (delErr) {
        // 削除失敗は致命ではないためログのみ
        console.error(
          "Failed to delete pending care_plans before create:",
          delErr
        );
      }
    }

    const payload = normalized.map((n) => ({
      user_id: userId!,
      plan_uuid: n.uuid,
      title: n.title,
      goal: n.goal,
      tasks: n.tasks,
      level: n.level,
      status: n.status,
    }));

    const { data, error } = await supabase
      .from("care_plans")
      .insert(payload)
      .select("id,plan_uuid,title,goal,tasks,level,status,created_at");
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ items: data ?? [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "登録に失敗しました";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
