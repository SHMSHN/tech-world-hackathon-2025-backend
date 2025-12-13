import type { AIProviderType, TranscriptionProvider } from "./types.ts";
import { OpenAIProvider } from "./providers/openai.ts";
import { SakuraProvider } from "./providers/sakura.ts";

/**
 * 環境変数に基づいて適切なAIプロバイダーを取得する
 * AI_PROVIDER環境変数で切り替え可能（デフォルト: openai）
 */
export function getTranscriptionProvider(): TranscriptionProvider {
  const providerType = (Deno.env.get("AI_PROVIDER") ??
    "openai") as AIProviderType;

  switch (providerType) {
    case "openai": {
      const apiKey = Deno.env.get("OPENAI_API_KEY");
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY環境変数が設定されていません");
      }
      return new OpenAIProvider({ apiKey });
    }
    case "sakura": {
      const apiKey = Deno.env.get("SAKURA_API_KEY");
      if (!apiKey) {
        throw new Error("SAKURA_API_KEY環境変数が設定されていません");
      }
      return new SakuraProvider({
        apiKey,
        baseUrl: Deno.env.get("SAKURA_BASE_URL"),
      });
    }
    default:
      throw new Error(`未対応のAIプロバイダー: ${providerType}`);
  }
}
