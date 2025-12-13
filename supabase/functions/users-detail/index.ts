import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";

interface CaregiverInfo {
  id: number;
  name: string;
}

interface LogItem {
  id: number;
  createdAt: string;
  author: string;
  content: string;
}

interface UserDetail {
  id: number;
  name: string;
  nameKana: string | null;
  age: number | null;
  gender: string | null;
  phone: string | null;
  address: string | null;
  careLevel: string | null;
  startDate: string | null;
  notes: string | null;
  caregiver: CaregiverInfo | null;
  recentLogs: LogItem[];
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

    // パラメータ取得（両方の方式に対応）
    let userId: string | null = url.searchParams.get("id");

    // クエリパラメータにない場合、パスから取得を試みる
    if (!userId) {
      const pathParts = url.pathname.split("/").filter(Boolean);
      const lastPart = pathParts[pathParts.length - 1];
      // 数値かどうか確認
      if (/^\d+$/.test(lastPart)) {
        userId = lastPart;
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "利用者IDが指定されていません" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userIdNum = parseInt(userId, 10);
    if (isNaN(userIdNum)) {
      return new Response(
        JSON.stringify({ error: "利用者IDが不正です" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = getSupabaseClient();

    // 利用者情報を取得（担当者情報含む）
    const { data: user, error: userError } = await supabase
      .from("users")
      .select(`
        id,
        name,
        name_kana,
        age,
        gender,
        phone,
        address,
        care_level,
        start_date,
        notes,
        primary_caregiver_id,
        caregivers!primary_caregiver_id (
          id,
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

    // 最近のログを取得（最新10件）
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
      .limit(10);

    if (logsError) {
      throw new Error(`ログ取得エラー: ${logsError.message}`);
    }

    // レスポンス整形
    // deno-lint-ignore no-explicit-any
    const caregiver = (user as any).caregivers;
    const result: UserDetail = {
      id: user.id,
      name: user.name,
      nameKana: user.name_kana,
      age: user.age,
      gender: user.gender,
      phone: user.phone,
      address: user.address,
      careLevel: user.care_level,
      startDate: user.start_date,
      notes: user.notes,
      caregiver: caregiver
        ? { id: caregiver.id, name: caregiver.name }
        : null,
      // deno-lint-ignore no-explicit-any
      recentLogs: logs?.map((log: any) => ({
        id: log.id,
        createdAt: log.created_at,
        author: log.caregivers?.name ?? "不明",
        content: log.content,
      })) ?? [],
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("User detail error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "利用者詳細の取得に失敗しました";

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
