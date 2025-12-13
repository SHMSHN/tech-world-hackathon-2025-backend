/**
 * 音声文字起こしの結果
 */
export interface TranscriptionResult {
  text: string;
}

/**
 * AIプロバイダーの設定
 */
export interface AIProviderConfig {
  apiKey: string;
  baseUrl?: string;
}

/**
 * 音声文字起こしプロバイダーのインターフェース
 * 新しいAIプロバイダーを追加する際は、このインターフェースを実装する
 */
export interface TranscriptionProvider {
  readonly name: string;
  transcribe(
    audio: Uint8Array,
    mimeType: string
  ): Promise<TranscriptionResult>;
}

/**
 * 対応するAIプロバイダーの種類
 */
export type AIProviderType = "openai" | "sakura";
