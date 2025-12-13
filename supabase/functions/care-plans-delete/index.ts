declare const Deno: any;
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";

interface DeleteRequestBody {
  user_id?: number | string;
  uuid?: string;
  uuids?: string[] | string; // JSON配列 or カンマ区切り
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

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST" && req.method !== "DELETE") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    let userId: number | null = null;
    let uuids: string[] = [];

    const contentType = req.headers.get("content-type") ?? "";
    if (req.method === "GET") {
      // 未使用
    } else if (contentType.includes("application/json")) {
      const body = (await req.json()) as DeleteRequestBody;
      userId = parseUserId(body.user_id);
      if (typeof body.uuid === "string" && body.uuid.trim()) {
        uuids = [body.uuid.trim()];
      } else {
        uuids = parseUuids(body.uuids);
      }
    } else if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      userId = parseUserId(form.get("user_id"));
      const uuid = form.get("uuid");
      const uuidsField = form.get("uuids");
      if (typeof uuid === "string" && uuid.trim()) {
        uuids = [uuid.trim()];
      } else {
        uuids = parseUuids(uuidsField);
      }
    } else if (contentType.startsWith("text/plain")) {
      try {
        const text = await req.text();
        const body = JSON.parse(text) as DeleteRequestBody;
        userId = parseUserId(body.user_id);
        if (typeof body.uuid === "string" && body.uuid.trim()) {
          uuids = [body.uuid.trim()];
        } else {
          uuids = parseUuids(body.uuids);
        }
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
    if (!Array.isArray(uuids) || uuids.length === 0) {
      return new Response(
        JSON.stringify({ error: "uuid もしくは uuids を指定してください" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("care_plans")
      .delete()
      .eq("user_id", userId)
      .in("plan_uuid", uuids)
      .select("plan_uuid");
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const deletedUuids = Array.isArray(data)
      ? data.map((r: any) => r.plan_uuid)
      : [];
    return new Response(JSON.stringify({ deletedUuids }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "削除に失敗しました";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
