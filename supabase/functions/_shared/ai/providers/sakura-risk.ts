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

    // まずは response_format ありで試行（未対応環境では後続でフォールバック）
    const requestBodyWithJsonMode = {
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      top_p: 1,
      max_tokens: 1200,
    };
    const requestBodyFallback = {
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0,
      top_p: 1,
      max_tokens: 1200,
    };

    let response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(requestBodyWithJsonMode),
    });

    // フォールバック：一部実装で response_format 未対応の可能性
    if (!response.ok && (response.status === 400 || response.status === 422)) {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(requestBodyFallback),
      });
    }

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
    // JSON以外を出力させないための強力な制約＋少量のfew-shot
    return [
      "あなたは介護記録から認知症関連の危険兆候を抽出するアシスタントです。",
      "必須要件:",
      "- 有効なJSONのみを返す（説明・前置き・コードブロック(``` )禁止）",
      "- ダブルクオートを用い、余計なキーを出さない、trailing comma禁止",
      "- スキーマと値域に厳密に従う。日本語で簡潔に書く",
      "- リスクが弱い/見当たらない場合も必ず有効なJSONを返す（findingsは空配列可）",
      "",
      "スキーマ（順序は任意、型と値域は厳守）:",
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
      "制約:",
      "- findings内の各要素には、入力ログ本文に基づく具体的な「evidence」を1〜5件含める",
      "- tasksは最大3件まで。短い命令形で具体的に",
      "- goalは1文で具体的に。結果が確認できる表現にする",
      "- 過剰な推測は禁止（入力に無い事実は書かない）",
      "- 全て日本語で出力する",
      "",
      "評価観点（例）: 服薬忘れ/不遵守、転倒リスク（ふらつき・夜間トイレ頻回）、脱水/栄養低下、睡眠障害、見当識障害、感情の変化など。",
      "",
      "良い出力例（例示。内容は入力に応じて生成し、必ずJSONのみ）:",
      "{",
      '  "riskLevel": "high",',
      '  "findings": [',
      "    {",
      '      "id": "fall_risk",',
      '      "title": "転倒リスクの増加",',
      '      "severity": "high",',
      '      "evidence": ["夜間のトイレ立ち上がりでふらつきが見られた", "歩行時に手すりを頻繁に使用"],',
      '      "recommendation": "夜間動線の安全確保と見守り強化",',
      '      "tasks": ["ベッド脇に足元灯を設置", "トイレまでの通路に障害物がないか点検", "夜間の見守り頻度を増やす"],',
      '      "goal": "夜間の立ち上がり・歩行時に転倒・転落が発生しない" ',
      "    }",
      "  ],",
      '  "notes": "昼間は安定しているが夜間の不安定さが目立つ"',
      "}",
      "",
      "入力は JSON で careLogs の配列（主に {id, content}）。これらを解析して上記のJSONだけを返す。",
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
    const bodyWithJsonMode = {
      model: this.model,
      messages: [
        {
          role: "system",
          content: [
            "次の入力はモデル出力（誤って説明やコードフェンスを含む可能性あり）です。",
            "要求: 下記スキーマに準拠した有効なJSONのみを返すこと。説明・コードブロック禁止。",
            "",
            "スキーマ:",
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
          ].join("\n"),
        },
        { role: "user", content: rawText },
      ],
      // 整形時もJSON出力を強制
      response_format: { type: "json_object" },
      temperature: 0,
      top_p: 1,
      max_tokens: 800,
    };
    const bodyFallback = {
      ...bodyWithJsonMode,
      // response_format を削除
      // deno-lint-ignore no-explicit-any
    } as any;
    delete (bodyFallback as any).response_format;

    let res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(bodyWithJsonMode),
    });

    if (!res.ok && (res.status === 400 || res.status === 422)) {
      res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(bodyFallback),
      });
    }
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
