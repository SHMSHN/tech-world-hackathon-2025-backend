import type {
  AIProviderType,
  TranscriptionProvider,
  SummarizationProvider,
} from "./types.ts";
import { OpenAIProvider } from "./providers/openai.ts";
import { SakuraProvider } from "./providers/sakura.ts";
import { SakuraChatProvider } from "./providers/sakura-chat.ts";

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

/**
 * 要約プロバイダーを取得
 */
export function getSummarizationProvider(): SummarizationProvider {
  const providerType = (Deno.env.get("AI_PROVIDER") ??
    "sakura") as AIProviderType;

  switch (providerType) {
    case "sakura": {
      const apiKey = Deno.env.get("SAKURA_API_KEY");
      if (!apiKey) {
        throw new Error("SAKURA_API_KEY環境変数が設定されていません");
      }
      return new SakuraChatProvider({
        apiKey,
        baseUrl: Deno.env.get("SAKURA_BASE_URL"),
        model: Deno.env.get("SAKURA_CHAT_MODEL") ?? undefined,
      });
    }
    case "openai": {
      const apiKey = Deno.env.get("OPENAI_API_KEY");
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY環境変数が設定されていません");
      }
      // OpenAI互換のSakuraベースURLが無い場合はOpenAIのURLを使用
      // Edge Function内にOpenAI専用の要約実装が無いため、SakuraChatProvider互換の別実装を導入するまで未対応
      throw new Error(
        "現在、要約はAI_PROVIDER=sakuraのみ対応しています（openai未対応）"
      );
    }
    default:
      throw new Error(`未対応のAIプロバイダー: ${providerType}`);
  }
}
