import type {
  AIProviderConfig,
  TranscriptionProvider,
  TranscriptionResult,
} from "../types.ts";

/**
 * OpenAI Whisper APIを使用した音声文字起こしプロバイダー
 */
export class OpenAIProvider implements TranscriptionProvider {
  readonly name = "openai";
  private apiKey: string;
  private baseUrl: string;

  constructor(config: AIProviderConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? "https://api.openai.com/v1";
  }

  async transcribe(
    audio: Uint8Array,
    mimeType: string
  ): Promise<TranscriptionResult> {
    const extension = this.getExtensionFromMimeType(mimeType);
    const blob = new Blob([audio], { type: mimeType });
    const file = new File([blob], `audio.${extension}`, { type: mimeType });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("model", "whisper-1");

    const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    return {
      text: result.text,
    };
  }

  private getExtensionFromMimeType(mimeType: string): string {
    const extensions: Record<string, string> = {
      "audio/mpeg": "mp3",
      "audio/mp3": "mp3",
      "audio/mp4": "mp4",
      "audio/m4a": "m4a",
      "audio/x-m4a": "m4a",
      "audio/wav": "wav",
      "audio/wave": "wav",
      "audio/webm": "webm",
      "audio/ogg": "ogg",
      "audio/flac": "flac",
    };
    return extensions[mimeType] ?? "mp3";
  }
}
