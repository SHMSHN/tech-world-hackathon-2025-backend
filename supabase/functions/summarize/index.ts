declare const Deno: any;
import { corsHeaders } from "../_shared/cors.ts";
import { getSummarizationProvider } from "../_shared/ai/provider-factory.ts";

interface SummarizeRequestBody {
  text?: string;
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
    let text = "";

    if (contentType.includes("application/json")) {
      const body = (await req.json()) as SummarizeRequestBody;
      text = (body.text ?? "").toString().trim();
    } else if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const value = form.get("text");
      text = (typeof value === "string" ? value : "").toString().trim();
    } else if (contentType.startsWith("text/plain")) {
      text = (await req.text()).toString().trim();
    } else {
      return new Response(
        JSON.stringify({
          error:
            "サポートされていないContent-Typeです（application/json, multipart/form-data, text/plainに対応）",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!text) {
      return new Response(
        JSON.stringify({ error: "textフィールドは必須です" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const provider = getSummarizationProvider();
    const result = await provider.summarize(text);

    return new Response(JSON.stringify({ summary: result.summary }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Summarize error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "要約に失敗しました";

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
