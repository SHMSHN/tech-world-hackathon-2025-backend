import type {
  AIProviderConfig,
  RiskAssessmentProvider,
  RiskAssessmentResult,
} from "../types.ts";

/**
 * さくらAI（OpenAI互換）のチャットAPIで介護ログのリスクを構造化評価
 */
export class SakuraRiskProvider implements RiskAssessmentProvider {
  readonly name = "sakura";
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(config: AIProviderConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? "https://api.ai.sakura.ad.jp/v1";
    this.model = config.model ?? "gpt-4o-mini";
  }

  async assessRisk(careLogs: unknown[]): Promise<RiskAssessmentResult> {
    const systemPrompt = this.buildSystemPrompt();
    const userContent = JSON.stringify({ careLogs });

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.2,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Sakura Chat API error: ${response.status} - ${errorText}`
      );
    }

    const result = await response.json();
    const content = this.extractContentFromChatResult(result);
    let parsed = this.tryParseJson(content);
    if (!parsed) {
      // 2段階目: JSONに整形させる再問い合わせ（堅牢化）
      const refined = await this.refineToJson(content);
      parsed = this.tryParseJson(refined);
      if (!parsed) {
        throw new Error("Failed to parse risk assessment JSON");
      }
    }
    return parsed as RiskAssessmentResult;
  }

  private buildSystemPrompt(): string {
    return [
      "あなたは介護記録から認知症関連の危険兆候を抽出するアシスタントです。",
      "出力は必ず有効なJSONのみを返してください。コードブロック（```）や説明文は禁止。ダブルクオートで正しいJSONにすること。",
      "以下のスキーマに厳密に従うこと。tasks は最大3件。goal は短く具体的に。",
      "",
      "Schema:",
      "{",
      '  "riskLevel": "medium|high",',
      '  "findings": [',
      "    {",
      '      "id": "string",',
      '      "title": "string",',
      '      "severity": "medium|high",',
      '      "evidence": ["string", "..."],',
      '      "recommendation": "string",',
      '      "tasks": ["string", "..."],',
      '      "goal": "string"',
      "    }",
      "  ],",
      '  "notes": "string"',
      "}",
      "",
      "評価観点例：服薬忘れ/不遵守、転倒リスク（ふらつき・夜間トイレ頻回）、脱水/栄養低下、睡眠障害、行動の迷い・見当識障害、感情の変化など。",
      "過剰な推測は避け、各findingには必ず具体的なログ文面の根拠（evidence）を入れてください。tasks/goalも日本語で記載。",
      "入力ログは主に id と content（本文）のみが含まれます。date/time/author/tags はありません。全て日本語で記載してください。",
    ].join("\n");
  }

  private extractContentFromChatResult(result: any): string {
    try {
      const choice = result?.choices?.[0];
      if (!choice) throw new Error("choices[0] is missing");
      const msg = choice.message ?? {};

      // reasoning_content対応（contentがnullのモデル用）
      if (
        typeof msg.reasoning_content === "string" &&
        msg.reasoning_content.trim()
      ) {
        const json = this.extractJsonFromText(msg.reasoning_content);
        if (json) return json;
      }
      if (
        typeof (choice as any).reasoning_content === "string" &&
        (choice as any).reasoning_content.trim()
      ) {
        const json = this.extractJsonFromText(
          (choice as any).reasoning_content
        );
        if (json) return json;
      }

      if (typeof msg.content === "string" && msg.content.trim()) {
        const json = this.extractJsonFromText(msg.content);
        if (json) return json;
        return msg.content;
      }
      if (Array.isArray(msg.content)) {
        const parts = msg.content
          .map((p: any) => {
            if (!p) return "";
            if (typeof p === "string") return p;
            if (typeof p.text === "string") return p.text;
            if (typeof p.content === "string") return p.content;
            if (typeof p.value === "string") return p.value;
            return "";
          })
          .filter((s: string) => s && s.trim().length > 0);
        if (parts.length > 0) {
          const joined = parts.join("\n");
          const json = this.extractJsonFromText(joined);
          if (json) return json;
          return joined;
        }
      }
      if (typeof choice.text === "string" && choice.text.trim()) {
        const json = this.extractJsonFromText(choice.text);
        if (json) return json;
        return choice.text;
      }
      if (typeof choice.content === "string" && choice.content.trim()) {
        const json = this.extractJsonFromText(choice.content);
        if (json) return json;
        return choice.content;
      }
      if (Array.isArray(choice.content)) {
        const parts = choice.content
          .map((p: any) =>
            typeof p === "string" ? p : p?.text ?? p?.content ?? p?.value ?? ""
          )
          .filter((s: string) => s && s.trim().length > 0);
        if (parts.length > 0) {
          const joined = parts.join("\n");
          const json = this.extractJsonFromText(joined);
          if (json) return json;
          return joined;
        }
      }
      throw new Error("content is empty");
    } catch (_e) {
      try {
        console.error("Sakura Risk raw result:", JSON.stringify(result));
      } catch {
        // ignore
      }
      throw new Error("Sakura Chat API response format is unexpected");
    }
  }

  private extractJsonFromText(text: string): string | null {
    // 1) ```json ... ``` に対応
    const fencedJson = text.match(/```json\s*([\s\S]*?)```/i);
    if (fencedJson && fencedJson[1]) {
      return fencedJson[1].trim();
    }
    const fenced = text.match(/```\s*([\s\S]*?)```/);
    if (fenced && fenced[1]) {
      // フェンス内にJSONらしきものがあれば採用
      const brace = fenced[1].match(/\{[\s\S]*\}/);
      if (brace) return brace[0];
    }
    // 2) 最初の { ... } ブロックを抽出
    const m = text.match(/\{[\s\S]*\}/);
    return m ? m[0] : null;
  }

  private tryParseJson(text: string): unknown | null {
    try {
      return JSON.parse(text);
    } catch {
      const extracted = this.extractJsonFromText(text);
      if (!extracted) return null;
      try {
        return JSON.parse(extracted);
      } catch {
        return null;
      }
    }
  }

  private async refineToJson(rawText: string): Promise<string> {
    const body = {
      model: this.model,
      messages: [
        {
          role: "system",
          content:
            "次の入力はモデル出力です。与えられた内容からスキーマ準拠の有効なJSONのみを返してください。コードブロックや説明は禁止。",
        },
        { role: "user", content: rawText },
      ],
      temperature: 0,
      max_tokens: 600,
    };
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Refine JSON error: ${res.status} - ${t}`);
    }
    const json = await res.json();
    const choice = json?.choices?.[0];
    const msg = choice?.message ?? {};
    const content: string = msg?.content ?? choice?.text ?? "";
    return content?.toString() ?? "";
  }
}
