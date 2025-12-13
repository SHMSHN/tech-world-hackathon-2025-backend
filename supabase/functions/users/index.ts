import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";

interface UserListItem {
  id: number;
  name: string;
  nameKana: string | null;
  age: number | null;
  gender: string | null;
  careLevel: string | null;
  caregiver: string | null;
  lastLogAt: string | null;
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
    const supabase = getSupabaseClient();

    // 利用者一覧を取得（担当者情報含む）
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select(`
        id,
        name,
        name_kana,
        age,
        gender,
        care_level,
        caregivers!primary_caregiver_id (
          name
        )
      `)
      .order("name_kana");

    if (usersError) {
      throw new Error(`利用者取得エラー: ${usersError.message}`);
    }

    // 最新ログ日時を取得（created_atを使用）
    const { data: latestLogs, error: logsError } = await supabase
      .from("logs")
      .select("user_id, created_at")
      .order("created_at", { ascending: false });

    if (logsError) {
      throw new Error(`ログ取得エラー: ${logsError.message}`);
    }

    // user_idごとの最新ログを取得
    const lastLogMap = new Map<number, string>();
    latestLogs?.forEach((log) => {
      if (!lastLogMap.has(log.user_id)) {
        lastLogMap.set(log.user_id, log.created_at);
      }
    });

    // レスポンス整形
    // deno-lint-ignore no-explicit-any
    const result: UserListItem[] = users?.map((user: any) => ({
      id: user.id,
      name: user.name,
      nameKana: user.name_kana,
      age: user.age,
      gender: user.gender,
      careLevel: user.care_level,
      caregiver: user.caregivers?.name ?? null,
      lastLogAt: lastLogMap.get(user.id) ?? null,
    })) ?? [];

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Users list error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "利用者一覧の取得に失敗しました";

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
