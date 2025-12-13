import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// SSE用のヘッダー
const sseHeaders = {
  ...corsHeaders,
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  "Connection": "keep-alive",
};

// SSEメッセージをフォーマット
function formatSSE(event: string, data: unknown): Uint8Array {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  return new TextEncoder().encode(message);
}

// キープアライブメッセージ
function formatKeepAlive(): Uint8Array {
  return new TextEncoder().encode(": keep-alive\n\n");
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

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");

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

  // Supabaseクライアントを作成（Realtime用に新規インスタンス）
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: "Supabase環境変数が設定されていません" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // 利用者の存在確認と名前取得
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, name")
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
    return new Response(
      JSON.stringify({ error: `利用者取得エラー: ${userError.message}` }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // SSEストリームを作成
  let keepAliveTimer: number | undefined;
  let channel: ReturnType<typeof supabase.channel> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // 接続成功メッセージを送信
      controller.enqueue(
        formatSSE("connected", {
          message: "SSE接続が確立されました",
          userId: userIdNum,
          userName: user.name,
        })
      );

      // キープアライブを60秒ごとに送信（150秒タイムアウト対策）
      keepAliveTimer = setInterval(() => {
        try {
          controller.enqueue(formatKeepAlive());
        } catch {
          // ストリームが閉じられている場合は無視
        }
      }, 60000);

      // Supabase Realtimeチャネルを購読
      channel = supabase
        .channel(`logs-user-${userIdNum}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "logs",
            filter: `user_id=eq.${userIdNum}`,
          },
          async (payload) => {
            try {
              // 介護者名を取得
              let authorName: string | null = null;
              if (payload.new.caregiver_id) {
                const { data: caregiver } = await supabase
                  .from("caregivers")
                  .select("name")
                  .eq("id", payload.new.caregiver_id)
                  .single();
                authorName = caregiver?.name ?? null;
              }

              // SSEイベントを送信
              controller.enqueue(
                formatSSE("log_inserted", {
                  id: payload.new.id,
                  createdAt: payload.new.created_at,
                  author: authorName,
                  content: payload.new.content,
                  userId: userIdNum,
                  userName: user.name,
                })
              );
            } catch (error) {
              console.error("Error processing realtime event:", error);
            }
          }
        )
        .subscribe((status) => {
          console.log(`Realtime subscription status: ${status}`);
          if (status === "SUBSCRIBED") {
            controller.enqueue(
              formatSSE("subscribed", {
                message: "Realtimeの購読を開始しました",
              })
            );
          }
        });
    },
    cancel() {
      // クリーンアップ
      if (keepAliveTimer) {
        clearInterval(keepAliveTimer);
      }
      if (channel) {
        channel.unsubscribe();
      }
      console.log(`SSE connection closed for userId: ${userIdNum}`);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: sseHeaders,
  });
});
