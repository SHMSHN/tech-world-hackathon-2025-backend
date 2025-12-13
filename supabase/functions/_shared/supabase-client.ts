import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// シングルトンインスタンス
let supabaseClient: SupabaseClient | null = null;

/**
 * Supabaseクライアントを取得する
 * Service Role Keyを使用してRLSをバイパス
 *
 * @returns SupabaseClient インスタンス
 * @throws Error 環境変数が設定されていない場合
 */
export function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL環境変数が設定されていません");
  }

  if (!supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY環境変数が設定されていません");
  }

  supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseClient;
}

export type { SupabaseClient };
