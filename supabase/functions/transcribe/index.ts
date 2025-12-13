import { corsHeaders } from "../_shared/cors.ts";
import { getTranscriptionProvider } from "../_shared/ai/provider-factory.ts";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB (OpenAI Whisper上限)

const VALID_AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/wav",
  "audio/wave",
  "audio/webm",
  "audio/ogg",
  "audio/flac",
  "audio/aac",
  "audio/x-wav",
  "application/octet-stream", // curlがMIMEタイプを判定できない場合
];

const VALID_EXTENSIONS = ["mp3", "mp4", "m4a", "wav", "webm", "ogg", "flac", "mpeg"];

function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

function isValidAudioFile(file: File): boolean {
  // MIMEタイプでチェック
  if (VALID_AUDIO_TYPES.includes(file.type)) {
    return true;
  }
  // 拡張子でチェック（MIMEタイプが不明な場合のフォールバック）
  const ext = getFileExtension(file.name);
  return VALID_EXTENSIONS.includes(ext);
}

Deno.serve(async (req) => {
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

    if (!contentType.includes("multipart/form-data")) {
      return new Response(
        JSON.stringify({
          error: "Content-Typeはmultipart/form-dataである必要があります",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio");

    if (!audioFile || !(audioFile instanceof File)) {
      return new Response(
        JSON.stringify({ error: "音声ファイルがありません" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ファイルサイズチェック
    if (audioFile.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({
          error: `ファイルサイズが大きすぎます（上限: ${MAX_FILE_SIZE / 1024 / 1024}MB）`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 音声形式チェック
    if (!isValidAudioFile(audioFile)) {
      return new Response(
        JSON.stringify({
          error: `対応していない音声形式です。対応形式: ${VALID_EXTENSIONS.join(", ")}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // プロバイダー取得と文字起こし実行
    const provider = getTranscriptionProvider();
    const audioData = new Uint8Array(await audioFile.arrayBuffer());

    // MIMEタイプが不明な場合は拡張子から推測
    let mimeType = audioFile.type;
    if (!mimeType || mimeType === "application/octet-stream") {
      const ext = getFileExtension(audioFile.name);
      const extToMime: Record<string, string> = {
        mp3: "audio/mpeg",
        mp4: "audio/mp4",
        m4a: "audio/m4a",
        wav: "audio/wav",
        webm: "audio/webm",
        ogg: "audio/ogg",
        flac: "audio/flac",
      };
      mimeType = extToMime[ext] ?? "audio/mpeg";
    }

    const result = await provider.transcribe(audioData, mimeType);

    return new Response(JSON.stringify({ text: result.text }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Transcription error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "文字起こしに失敗しました";

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
