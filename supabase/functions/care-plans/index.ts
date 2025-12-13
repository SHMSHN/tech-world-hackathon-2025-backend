declare const Deno: any;
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";

interface ListRequestBody {
  user_id?: number | string;
  status?: "pending" | "done";
  limit?: number | string;
  order?: "asc" | "desc";
}

function parseUserId(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseLimit(v: unknown, def = 100): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(1, v);
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    if (Number.isFinite(n)) return Math.max(1, n);
  }
  return def;
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let userId: number | null = null;
    // 取得は全件（created_at desc）

    if (req.method === "GET") {
      const url = new URL(req.url);
      userId = parseUserId(url.searchParams.get("user_id"));
      // 他のパラメータは無視（全件取得）
    } else if (req.method === "POST") {
      const contentType = req.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const body = (await req.json()) as ListRequestBody;
        userId = parseUserId(body.user_id);
        // 他のパラメータは無視（全件取得）
      } else if (contentType.includes("multipart/form-data")) {
        const form = await req.formData();
        userId = parseUserId(form.get("user_id"));
        // 他のパラメータは無視（全件取得）
      } else if (contentType.startsWith("text/plain")) {
        try {
          const text = await req.text();
          const body = JSON.parse(text) as ListRequestBody;
          userId = parseUserId(body.user_id);
          // 他のパラメータは無視（全件取得）
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
    } else {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (userId == null) {
      return new Response(JSON.stringify({ error: "user_id は必須です" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("care_plans")
      .select("id,plan_uuid,user_id,title,goal,tasks,level,status,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
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
    const msg = error instanceof Error ? error.message : "取得に失敗しました";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
