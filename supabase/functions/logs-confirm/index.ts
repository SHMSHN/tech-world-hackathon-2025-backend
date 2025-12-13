declare const Deno: any;
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";

interface LogConfirmRequest {
  userId: number;
  caregiverId: number;
  content: string;
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // POSTのみ許可
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const contentType = req.headers.get("content-type") ?? "";

    if (!contentType.includes("application/json")) {
      return new Response(
        JSON.stringify({
          error: "Content-Typeはapplication/jsonである必要があります",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body = (await req.json()) as LogConfirmRequest;

    // バリデーション
    if (!body.userId) {
      return new Response(
        JSON.stringify({ error: "userIdは必須です" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!body.caregiverId) {
      return new Response(
        JSON.stringify({ error: "caregiverIdは必須です" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!body.content) {
      return new Response(
        JSON.stringify({ error: "contentは必須です" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // DBに保存
    const supabase = getSupabaseClient();

    const { error } = await supabase.from("logs").insert({
      user_id: body.userId,
      caregiver_id: body.caregiverId,
      content: body.content,
    });

    if (error) {
      console.error("Database error:", error);
      return new Response(
        JSON.stringify({ error: "ログの保存に失敗しました" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 成功時はステータス200のみ
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "予期しないエラーが発生しました",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
