declare const Deno: any;
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";

type PlanLevel = "alert" | "warning";
type PlanStatus = "pending" | "done";

interface UpdateRequestBody {
  user_id?: number | string;
  uuid?: string;
  uuids?: string[] | string; // JSON配列 or カンマ区切り
  title?: string | null;
  goal?: string | null;
  tasks?: unknown; // string[] | string(JSON/カンマ区切り) | null
  level?: PlanLevel | null;
  status?: PlanStatus | null;
}

function parseUserId(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseUuids(input: unknown): string[] {
  if (typeof input === "string") {
    const s = input.trim();
    if (!s) return [];
    try {
      if (s.startsWith("[")) {
        const arr = JSON.parse(s);
        if (Array.isArray(arr)) {
          return arr
            .map((x) => (typeof x === "string" ? x.trim() : ""))
            .filter(Boolean);
        }
      }
      return s
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    } catch {
      return s
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }
  }
  if (Array.isArray(input)) {
    return input
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter(Boolean);
  }
  return [];
}

function toStringArray(value: unknown): string[] | null {
  if (value == null) return null;
  if (Array.isArray(value)) {
    return value
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter((x) => x.length > 0);
  }
  if (typeof value === "string") {
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
  if (req.method !== "POST" && req.method !== "PATCH") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const contentType = req.headers.get("content-type") ?? "";
    let userId: number | null = null;
    let uuids: string[] = [];
    let title: string | null | undefined = undefined;
    let goal: string | null | undefined = undefined;
    let tasks: string[] | null | undefined = undefined;
    let level: PlanLevel | null | undefined = undefined;
    let status: PlanStatus | null | undefined = undefined;

    const assignBody = (body: UpdateRequestBody) => {
      userId = parseUserId(body.user_id);
      if (typeof body.uuid === "string" && body.uuid.trim()) {
        uuids = [body.uuid.trim()];
      } else if (body.uuids) {
        uuids = parseUuids(body.uuids);
      }
      if (typeof body.title === "string") title = body.title.trim();
      else if (body.title === null) title = null;

      if (typeof body.goal === "string") goal = body.goal.trim();
      else if (body.goal === null) goal = null;

      const t = toStringArray(body.tasks);
      if (t !== null) tasks = t;
      else if (body.tasks === null) tasks = null;

      if (body.level === "alert" || body.level === "warning")
        level = body.level;
      else if (body.level === null) level = null;

      if (body.status === "pending" || body.status === "done")
        status = body.status;
      else if (body.status === null) status = null;
    };

    if (contentType.includes("application/json")) {
      const body = (await req.json()) as UpdateRequestBody;
      assignBody(body);
    } else if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      assignBody({
        user_id: form.get("user_id") as any,
        uuid: (form.get("uuid") as string) ?? undefined,
        uuids: (form.get("uuids") as string) ?? undefined,
        title: (form.get("title") as string) ?? undefined,
        goal: (form.get("goal") as string) ?? undefined,
        tasks: (form.get("tasks") as string) ?? undefined,
        level: (form.get("level") as any) ?? undefined,
        status: (form.get("status") as any) ?? undefined,
      });
    } else if (contentType.startsWith("text/plain")) {
      try {
        const text = await req.text();
        const body = JSON.parse(text) as UpdateRequestBody;
        assignBody(body);
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

    // 必須チェック
    if (userId == null) {
      return new Response(JSON.stringify({ error: "user_id は必須です" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Array.isArray(uuids) || uuids.length === 0) {
      return new Response(
        JSON.stringify({ error: "uuid もしくは uuids を指定してください" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 更新内容の組み立て（指定のあるキーのみ）
    const updatePayload: Record<string, unknown> = {};
    if (title !== undefined) updatePayload.title = title;
    if (goal !== undefined) updatePayload.goal = goal;
    if (tasks !== undefined) updatePayload.tasks = tasks;
    if (level !== undefined) updatePayload.level = level;
    if (status !== undefined) updatePayload.status = status;

    if (Object.keys(updatePayload).length === 0) {
      return new Response(
        JSON.stringify({
          error:
            "更新対象のフィールド（title/goal/tasks/level/status）のいずれかを指定してください",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("care_plans")
      .update(updatePayload)
      .eq("user_id", userId)
      .in("plan_uuid", uuids)
      .select("id,plan_uuid,user_id,title,goal,tasks,level,status,created_at");

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updatedUuids = Array.isArray(data)
      ? data.map((r: any) => r.plan_uuid)
      : [];

    return new Response(JSON.stringify({ updatedUuids, items: data ?? [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "更新に失敗しました";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
