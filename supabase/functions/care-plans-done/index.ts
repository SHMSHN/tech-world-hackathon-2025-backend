declare const Deno: any;
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";

interface UpdateStatusBody {
  id?: number | string;
  ids?: Array<number | string>;
  user_id?: number | string; // 任意: ユーザー範囲での制約に使う場合
}

function toNumberArray(val: unknown): number[] {
  if (Array.isArray(val)) {
    return val
      .map((v) =>
        typeof v === "number"
          ? v
          : typeof v === "string"
          ? parseInt(v, 10)
          : NaN
      )
      .filter((n) => Number.isFinite(n)) as number[];
  }
  if (typeof val === "string") {
    // カンマ区切り "1,2,3"
    return val
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n));
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
    let ids: number[] = [];
    let providedUserId: number | null = null;

    if (contentType.includes("application/json")) {
      const body = (await req.json()) as UpdateStatusBody;
      if (typeof body.id === "number") {
        ids = [body.id];
      } else if (typeof body.id === "string") {
        const p = parseInt(body.id, 10);
        if (Number.isFinite(p)) ids = [p];
      } else {
        ids = toNumberArray(body.ids);
      }
      if (typeof body.user_id === "number") {
        providedUserId = Number.isFinite(body.user_id) ? body.user_id : null;
      } else if (typeof body.user_id === "string") {
        const u = parseInt(body.user_id, 10);
        providedUserId = Number.isFinite(u) ? u : null;
      }
    } else if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const id = form.get("id");
      const idsField = form.get("ids");
      const uid = form.get("user_id");
      if (typeof id === "string" && id.trim()) {
        const p = parseInt(id, 10);
        if (Number.isFinite(p)) ids = [p];
      } else if (typeof idsField === "string") {
        try {
          // JSON かカンマ区切りのどちらかを許容
          if (idsField.trim().startsWith("[")) {
            ids = toNumberArray(JSON.parse(idsField));
          } else {
            ids = toNumberArray(idsField);
          }
        } catch {
          ids = toNumberArray(idsField);
        }
      }
      if (typeof uid === "string") {
        const u = parseInt(uid, 10);
        providedUserId = Number.isFinite(u) ? u : null;
      }
    } else if (contentType.startsWith("text/plain")) {
      try {
        const text = await req.text();
        const body = JSON.parse(text) as UpdateStatusBody;
        if (typeof body.id === "number") {
          ids = [body.id];
        } else if (typeof body.id === "string") {
          const p = parseInt(body.id, 10);
          if (Number.isFinite(p)) ids = [p];
        } else {
          ids = toNumberArray(body.ids);
        }
        if (typeof body.user_id === "number") {
          providedUserId = Number.isFinite(body.user_id) ? body.user_id : null;
        } else if (typeof body.user_id === "string") {
          const u = parseInt(body.user_id, 10);
          providedUserId = Number.isFinite(u) ? u : null;
        }
      } catch {
        // 無視して次へ
      }
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return new Response(
        JSON.stringify({ error: "id もしくは ids を指定してください" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = getSupabaseClient();
    // user_id が指定されていれば、その範囲に限定して更新
    let query = supabase
      .from("care_plans")
      .update({ status: "done" })
      .in("id", ids)
      .select("id");
    if (providedUserId != null) {
      query = query.eq("user_id", providedUserId);
    }
    const { data, error } = await query;
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const updatedIds = Array.isArray(data) ? data.map((r: any) => r.id) : [];
    return new Response(JSON.stringify({ updatedIds, status: "done" }), {
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
