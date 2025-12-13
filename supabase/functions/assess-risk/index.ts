declare const Deno: any;
import { corsHeaders } from "../_shared/cors.ts";
import { getRiskAssessmentProvider } from "../_shared/ai/provider-factory.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";

interface AssessRiskJsonBody {
  careLogs?: unknown;
  user_id?: number | string;
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
    let careLogs: unknown = null;
    let providedUserId: number | null = null;

    if (contentType.includes("application/json")) {
      const body = (await req.json()) as AssessRiskJsonBody;
      careLogs = body.careLogs ?? null;
      if (typeof body.user_id === "number") {
        providedUserId = Number.isFinite(body.user_id) ? body.user_id : null;
      } else if (typeof body.user_id === "string") {
        const parsed = parseInt(body.user_id, 10);
        providedUserId = Number.isFinite(parsed) ? parsed : null;
      }
    } else if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const value = form.get("careLogs");
      const uid = form.get("user_id");
      if (typeof uid === "string") {
        const parsed = parseInt(uid, 10);
        providedUserId = Number.isFinite(parsed) ? parsed : null;
      }
      if (value instanceof File) {
        const text = await value.text();
        careLogs = JSON.parse(text);
      } else if (typeof value === "string") {
        careLogs = JSON.parse(value);
      }
    } else if (contentType.startsWith("text/plain")) {
      const text = await req.text();
      try {
        const parsed = JSON.parse(text) as AssessRiskJsonBody;
        careLogs = parsed?.careLogs ?? null;
        if (typeof parsed?.user_id === "number") {
          providedUserId = Number.isFinite(parsed.user_id)
            ? parsed.user_id
            : null;
        } else if (typeof parsed?.user_id === "string") {
          const u = parseInt(parsed.user_id, 10);
          providedUserId = Number.isFinite(u) ? u : null;
        }
      } catch {
        // text/plain で生の user_id 数値が来る場合は未対応（JSONを推奨）
      }
    } else {
      return new Response(
        JSON.stringify({
          error:
            "サポートされていないContent-Typeです（application/json, multipart/form-data, text/plainに対応）",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // user_id が指定されている場合はDBから該当ユーザーのログを取得して careLogs を上書き
    if (providedUserId != null) {
      try {
        const supabase = getSupabaseClient();
        const { data: logsRows, error: logsErr } = await supabase
          .from("logs")
          .select("id,user_id,content")
          .eq("user_id", providedUserId);
        if (logsErr) {
          throw logsErr;
        }
        const rows = Array.isArray(logsRows) ? logsRows : [];
        careLogs = rows.map((r: any) => ({
          id: r?.id,
          content: typeof r?.content === "string" ? r.content : "",
        }));
      } catch (e) {
        console.error("Failed to fetch logs by user_id:", e);
        return new Response(
          JSON.stringify({
            error: "指定された user_id のログ取得に失敗しました",
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    if (!Array.isArray(careLogs)) {
      return new Response(
        JSON.stringify({
          error:
            providedUserId != null
              ? "指定された user_id のログが見つかりませんでした"
              : "careLogs は配列(JSON)である必要があります",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // AI結果生成（失敗時はエラー返却）
    let items: Array<{
      id: number;
      level: "alert" | "warning";
      title: string;
      tasks: string[];
      goal: string;
      description?: string;
    }> = [];
    const provider = getRiskAssessmentProvider();
    const result = await provider.assessRisk(careLogs);
    // 返却フォーマットをユーザー指定の配列に変換（AI出力をパススルー）
    items = (result.findings ?? []).map((f, i) => {
      const uuid = (globalThis as any)?.crypto?.randomUUID
        ? (globalThis as any).crypto.randomUUID()
        : `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 10)}`;
      const level = f.severity === "high" ? "alert" : "warning";
      const tasks = Array.isArray(f.tasks)
        ? f.tasks.slice(0, 3)
        : f.recommendation
        ? [f.recommendation]
        : [];
      const goal = typeof f.goal === "string" && f.goal ? f.goal : "";
      // description は保存用に先頭タスクを優先（なければgoal or recommendation）
      const description =
        (tasks.length > 0 ? tasks[0] : goal || f.recommendation || "") || "";
      return {
        uuid,
        id: i + 1,
        level,
        title: f.title,
        tasks,
        goal,
        description,
      };
    });

    // DB保存（care_plans） - 可能なら（設計: title/goal/tasks/level/status）
    try {
      const supabase = getSupabaseClient();
      // 保存時の user_id は、リクエストで与えられた user_id を優先
      let resolvedUserId: number | null = providedUserId;
      if (resolvedUserId == null) {
        // 後方互換: careLogs から user_id を解決（従来仕様）
        const logIds: number[] = Array.isArray(careLogs)
          ? (careLogs as any[])
              .map((l) => (typeof l?.id === "number" ? l.id : null))
              .filter((v): v is number => Number.isInteger(v))
          : [];
        if (logIds.length > 0) {
          const { data: logsRows, error: logsErr } = await supabase
            .from("logs")
            .select("id,user_id")
            .in("id", logIds);
          if (!logsErr && Array.isArray(logsRows) && logsRows.length > 0) {
            const uniqUserIds = Array.from(
              new Set(logsRows.map((r: any) => r.user_id).filter(Boolean))
            );
            if (uniqUserIds.length === 1) {
              resolvedUserId = uniqUserIds[0] as number;
            }
          }
        }
      }
      // 既存の pending を削除（同一ユーザーの古い下書きをクリア）
      if (resolvedUserId != null) {
        const { error: delErr } = await supabase
          .from("care_plans")
          .delete()
          .eq("user_id", resolvedUserId)
          .eq("status", "pending");
        if (delErr) {
          console.error("Failed to delete pending care_plans:", delErr);
        }
      }
      if (resolvedUserId != null && items.length > 0) {
        const payload = items.map((it) => ({
          user_id: resolvedUserId!,
          plan_uuid: (it as any).uuid,
          title: it.title,
          goal: it.goal,
          tasks: it.tasks, // JSONB配列として保存
          level: it.level,
          status: "pending",
        }));
        const { error: insErr } = await supabase
          .from("care_plans")
          .insert(payload);
        if (insErr) console.error("Failed to insert care_plans:", insErr);
      }
    } catch (dbError) {
      // DB保存失敗はレスポンスを妨げない
      console.error("DB save skipped/failed:", dbError);
    }

    return new Response(JSON.stringify(items), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("AssessRisk error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "危険検知に失敗しました";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
