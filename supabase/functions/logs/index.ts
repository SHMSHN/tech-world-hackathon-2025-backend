import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";

interface UserInfo {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  caregiver: string | null;
  startDate: string | null;
}

interface LogItem {
  id: number;
  createdAt: string;
  author: string | null;
  content: string;
}

interface LogsResponse {
  user: UserInfo;
  logs: LogItem[];
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // GETのみ許可
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

    // バリデーション: userIdは必須
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userIdパラメータは必須です" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userIdNum = parseInt(userId, 10);
    if (isNaN(userIdNum)) {
      return new Response(
        JSON.stringify({ error: "userIdは数値である必要があります" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = getSupabaseClient();

    // 利用者情報を取得（担当介護者含む）
    const { data: user, error: userError } = await supabase
      .from("users")
      .select(`
        id,
        name,
        phone,
        address,
        start_date,
        caregivers!primary_caregiver_id (
          name
        )
      `)
      .eq("id", userIdNum)
      .single();

    if (userError) {
      if (userError.code === "PGRST116") {
        return new Response(
          JSON.stringify({ error: "利用者が見つかりません" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      throw new Error(`利用者取得エラー: ${userError.message}`);
    }

    // ログ一覧を取得（介護者情報含む）
    const { data: logs, error: logsError } = await supabase
      .from("logs")
      .select(`
        id,
        created_at,
        content,
        caregivers!caregiver_id (
          name
        )
      `)
      .eq("user_id", userIdNum)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (logsError) {
      throw new Error(`ログ取得エラー: ${logsError.message}`);
    }

    // レスポンス整形
    // deno-lint-ignore no-explicit-any
    const userInfo: UserInfo = {
      id: user.id,
      name: user.name,
      phone: user.phone ?? null,
      address: user.address ?? null,
      caregiver: (user as any).caregivers?.name ?? null,
      startDate: user.start_date ?? null,
    };

    // deno-lint-ignore no-explicit-any
    const logItems: LogItem[] = logs?.map((log: any) => ({
      id: log.id,
      createdAt: log.created_at,
      author: log.caregivers?.name ?? null,
      content: log.content,
    })) ?? [];

    const result: LogsResponse = {
      user: userInfo,
      logs: logItems,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Logs list error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "ログ一覧の取得に失敗しました";

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
