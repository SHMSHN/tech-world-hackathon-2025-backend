declare const Deno: any;
import { corsHeaders } from "../_shared/cors.ts";
import {
  getTranscriptionProvider,
  getSummarizationProvider,
} from "../_shared/ai/provider-factory.ts";

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
  "application/octet-stream",
];

const VALID_EXTENSIONS = ["mp3", "mp4", "m4a", "wav", "webm", "ogg", "flac", "mpeg"];

function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

function isValidAudioFile(file: File): boolean {
  if (VALID_AUDIO_TYPES.includes(file.type)) {
    return true;
  }
  const ext = getFileExtension(file.name);
  return VALID_EXTENSIONS.includes(ext);
}

function getMimeType(file: File): string {
  let mimeType = file.type;
  if (!mimeType || mimeType === "application/octet-stream") {
    const ext = getFileExtension(file.name);
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
  return mimeType;
}

interface PreviewResponse {
  summary: string;
}

interface ErrorResponse {
  error: string;
  step?: "transcription" | "summarization";
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

    // === Step 1: 文字起こし ===
    let transcribedText: string;
    try {
      const transcriptionProvider = getTranscriptionProvider();
      const audioData = new Uint8Array(await audioFile.arrayBuffer());
      const mimeType = getMimeType(audioFile);
      const transcriptionResult = await transcriptionProvider.transcribe(
        audioData,
        mimeType
      );
      transcribedText = transcriptionResult.text;
    } catch (error) {
      console.error("Transcription error:", error);
      const errorResponse: ErrorResponse = {
        error:
          error instanceof Error ? error.message : "文字起こしに失敗しました",
        step: "transcription",
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 文字起こし結果が空の場合
    if (!transcribedText.trim()) {
      return new Response(
        JSON.stringify({ error: "音声から文字を認識できませんでした" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // === Step 2: 要約 ===
    let summary: string;

    try {
      const summarizationResult =
        await getSummarizationProvider().summarize(transcribedText);
      summary = summarizationResult.summary;
    } catch (error) {
      console.error("Summarization error:", error);
      const errorResponse: ErrorResponse = {
        error:
          error instanceof Error ? error.message : "要約に失敗しました",
        step: "summarization",
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // レスポンス構築
    const response: PreviewResponse = {
      summary,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
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
