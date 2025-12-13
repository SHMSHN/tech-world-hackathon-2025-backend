import type {
  AIProviderConfig,
  TranscriptionProvider,
  TranscriptionResult,
} from "../types.ts";

/**
 * さくらAIを使用した音声文字起こしプロバイダー（スタブ）
 * TODO: さくらAIのAPIが利用可能になったら実装する
 */
export class SakuraProvider implements TranscriptionProvider {
  readonly name = "sakura";
  private apiKey: string;
  private baseUrl: string;

  constructor(config: AIProviderConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? "https://api.sakura.ad.jp/v1";
  }

  async transcribe(
    _audio: Uint8Array,
    _mimeType: string
  ): Promise<TranscriptionResult> {
    // TODO: さくらAIのWhisper APIを実装
    throw new Error(
      "さくらAI Whisperは未実装です。OPENAI_API_KEYを設定してAI_PROVIDER=openaiを使用してください。"
    );
  }
}
