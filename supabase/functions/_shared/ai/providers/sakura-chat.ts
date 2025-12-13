import type {
  AIProviderConfig,
  SummarizationProvider,
  SummarizationResult,
} from "../types.ts";

/**
 * さくらのAIエンジン（OpenAI互換API）のチャット/要約プロバイダー
 * ベースURL例: https://api.ai.sakura.ad.jp/v1
 * エンドポイント: /chat/completions
 */
export class SakuraChatProvider implements SummarizationProvider {
  readonly name = "sakura";
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(config: AIProviderConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? "https://api.ai.sakura.ad.jp/v1";
    // モデルは環境により異なるため、必須ではなく任意にする
    // 例: "gpt-4o-mini", "llama-3.1-8b-instruct" 等（利用環境のドキュメントに従う）
    this.model = config.model ?? "gpt-4o-mini";
  }

  async summarize(text: string): Promise<SummarizationResult> {
    const systemPrompt = this.buildSystemPrompt();

    const body = {
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      temperature: 0.2,
      // 短い要約を想定。必要に応じて調整可能
      max_tokens: 320,
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Sakura Chat API error: ${response.status} - ${errorText}`
      );
    }

    const result = await response.json();
    const content = this.extractContentFromChatResult(result);
    const cleaned = this.sanitizeToJapaneseSummary(content);
    return { summary: cleaned };
  }

  private buildSystemPrompt(): string {
    return [
      "あなたは日本語の要約アシスタントです。",
      "入力テキストから主観や感情を過度に追加せず、事実に基づいて要点を抽出します。",
      "1-2文で簡潔にまとめてください（おおよそ60-120文字で最大でも4行を目安にして）。",
      "出力は日本語の要約文のみを返してください。前置きや説明は不要です。",
      "重要: 入力者の観測・気づき・懸念などの要点を落とさず、過剰な装飾を避けること。",
    ].join("\n");
  }

  /**
   * さくらAIのOpenAI互換レスポンス差異に強く対応する抽出関数
   * - choices[0].message.content が string
   * - choices[0].message.content が配列（{type:"text", text:"..."}など）
   * - choices[0].text が string（旧Completion互換）
   * - choices[0].content / choices[0].message.content.text / value などにも対応
   */
  private extractContentFromChatResult(result: any): string {
    try {
      const choice = result?.choices?.[0];
      if (!choice) {
        throw new Error("choices[0] is missing");
      }

      const msg = choice.message ?? {};

      // 0) reasoning_content を最優先で拾う（モデルによって content が null の場合がある）
      if (
        typeof msg.reasoning_content === "string" &&
        msg.reasoning_content.trim()
      ) {
        const extracted = this.extractSummaryFromReasoning(
          msg.reasoning_content
        );
        if (extracted) return extracted;
      }
      if (
        typeof (choice as any).reasoning_content === "string" &&
        (choice as any).reasoning_content.trim()
      ) {
        const extracted = this.extractSummaryFromReasoning(
          (choice as any).reasoning_content
        );
        if (extracted) return extracted;
      }

      // 1) Chat形式: string
      if (typeof msg.content === "string" && msg.content.trim()) {
        return msg.content;
      }

      // 1.1) Chat形式: オブジェクトに text/value が直にある
      if (msg && typeof msg === "object") {
        const maybeText =
          (msg as any).text ?? (msg as any).value ?? (msg as any).output_text;
        if (typeof maybeText === "string" && maybeText.trim()) {
          return maybeText;
        }
      }

      // 2) Chat形式: contentが配列（OpenAI互換の一部実装）
      if (Array.isArray(msg.content)) {
        const parts = msg.content
          .map((p: any) => {
            if (!p) return "";
            if (typeof p === "string") return p;
            if (typeof p.text === "string") return p.text;
            if (typeof p.content === "string") return p.content;
            if (typeof p.value === "string") return p.value;
            if (typeof p.output_text === "string") return p.output_text;
            return "";
          })
          .filter((s: string) => s && s.trim().length > 0);
        if (parts.length > 0) {
          return parts.join("\n");
        }
      }

      // 2.1) Chat形式: contentがオブジェクトで text/value を持つ
      if (
        msg &&
        typeof msg === "object" &&
        msg.content &&
        typeof msg.content === "object"
      ) {
        const ct: any = msg.content;
        const maybe =
          ct.text ??
          ct.value ??
          ct.output_text ??
          (Array.isArray(ct) &&
            ct[0] &&
            (ct[0].text ?? ct[0].value ?? ct[0].output_text));
        if (typeof maybe === "string" && maybe.trim()) {
          return maybe;
        }
      }

      // 3) textフィールド（旧Completion）
      if (typeof choice.text === "string" && choice.text.trim()) {
        return choice.text;
      }

      // 3.1) choice.content（互換実装で使われることがある）
      if (typeof choice.content === "string" && choice.content.trim()) {
        return choice.content;
      }
      if (Array.isArray(choice.content)) {
        const parts = choice.content
          .map((p: any) => {
            if (!p) return "";
            if (typeof p === "string") return p;
            if (typeof p.text === "string") return p.text;
            if (typeof p.content === "string") return p.content;
            if (typeof p.value === "string") return p.value;
            if (typeof p.output_text === "string") return p.output_text;
            return "";
          })
          .filter((s: string) => s && s.trim().length > 0);
        if (parts.length > 0) {
          return parts.join("\n");
        }
      }

      throw new Error("content is empty");
    } catch (_e) {
      // デバッグ用に生レスポンスを出力（開発環境前提）
      try {
        console.error("Sakura Chat raw result:", JSON.stringify(result));
      } catch {
        // ignore
      }
      throw new Error("Sakura Chat API response format is unexpected");
    }
  }

  /**
   * reasoning_content から日本語の要約文らしき部分を抽出
   */
  private extractSummaryFromReasoning(reasoning: string): string | null {
    const text = reasoning ?? "";
    if (!text.trim()) return null;

    // 1) 「…」 or "..." で囲まれた候補を優先
    const quoteCandidates: string[] = [];
    const jpQuoteRe = /「([^」]{10,400})」/g;
    const enQuoteRe = /"([^"]{10,400})"/g;
    let m: RegExpExecArray | null;
    while ((m = jpQuoteRe.exec(text)) !== null) quoteCandidates.push(m[1]);
    while ((m = enQuoteRe.exec(text)) !== null) quoteCandidates.push(m[1]);
    const jpCharRe = /[\u3040-\u30FF\u3400-\u9FFF]/;
    const quoteJp = quoteCandidates.filter((s) => jpCharRe.test(s));
    if (quoteJp.length > 0) {
      // 日本語っぽい最長の候補を採用
      const best = quoteJp.sort((a, b) => b.length - a.length)[0];
      return this.postprocessSummary(best);
    }

    // 2) "So summary:"や"要約:"の直後行を拾う
    const labelRe = /(So summary|Summary|要約|出力)\s*[:：]\s*(.+)$/gim;
    const labelMatches: string[] = [];
    while ((m = labelRe.exec(text)) !== null) {
      labelMatches.push(m[2]);
    }
    const labelJp = labelMatches.filter((s) => jpCharRe.test(s));
    if (labelJp.length > 0) {
      const best = labelJp.sort((a, b) => b.length - a.length)[0];
      return this.postprocessSummary(best);
    }

    // 3) 行ごとに分割し、日本語を含む適切な長さの行を候補に
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const lineCandidates = lines
      .filter((l) => jpCharRe.test(l))
      .filter((l) => l.length >= 20 && l.length <= 400);
    if (lineCandidates.length > 0) {
      const best = lineCandidates.sort((a, b) => b.length - a.length)[0];
      return this.postprocessSummary(best);
    }

    return null;
  }

  private postprocessSummary(s: string): string {
    const trimmed = s.trim();
    // 末尾の不要な英語や括弧内補足を軽く除去
    const cleaned = trimmed
      .replace(/\s+We'll output.*$/i, "")
      .replace(/\s+Should be fine\.*$/i, "");
    // 上限を軽く制限
    const limited = cleaned.length > 350 ? cleaned.slice(0, 350) : cleaned;
    return this.sanitizeToJapaneseSummary(limited);
  }

  /**
   * モデルが返す冗長な英語の推論文などを除去し、
   * 日本語の1-2文のみを返すサニタイズ処理
   */
  private sanitizeToJapaneseSummary(raw: string): string {
    const text = (raw ?? "").trim();
    if (!text) return "";

    // 行ごとに分割し、日本語(ひらがな/カタカナ/漢字)を含む行のみ残す
    const jpRe = /[\u3040-\u30FF\u3400-\u9FFF]/;
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((l) => jpRe.test(l));

    // 候補がなければ元文を返す（ただし最後に文区切りで短縮）
    const candidate = lines[0] ?? text;

    // 先頭/末尾の引用符を除去
    const dequoted = candidate.replace(/^[「"']+|[」"']+$/g, "");

    // 「要約:」「まとめ:」などの接頭を除去
    const noLabel = dequoted.replace(/^(要約|まとめ)\s*[:：]\s*/u, "").trim();

    // 日本語/英語の文区切りで分割（。．.!??. も考慮）
    const sentencesAll = noLabel
      .split(/(?<=[。．！!？\?\.])/u)
      .map((s) => s.trim())
      .filter(Boolean);
    // 文ごとに日本語と英字の比率で判定し、英語優勢な文を除外
    const sentences = sentencesAll.filter((s) => {
      const jpCount = (s.match(/[\u3040-\u30FF\u3400-\u9FFF]/g) ?? []).length;
      const enCount = (s.match(/[A-Za-z]/g) ?? []).length;
      if (jpCount === 0) return false;
      // 英字が多すぎる文は除外（英字 <= jp の半分 もしくは 英字 <= 2 まで許容）
      return enCount <= 2 || enCount <= Math.floor(jpCount / 2);
    });
    const joined = sentences.slice(0, 2).join("");

    // 文字数も軽く制限
    let finalText = joined || noLabel;
    // まだ英語テキストが末尾に残る場合、日本語文の終端（。．）までで打ち切り
    if (/[A-Za-z]/.test(finalText)) {
      const cutIdx =
        finalText.indexOf("。") >= 0
          ? finalText.indexOf("。") + 1
          : finalText.indexOf("．") + 1;
      if (cutIdx > 0) {
        finalText = finalText.slice(0, cutIdx);
      }
    }
    return finalText.length > 200 ? finalText.slice(0, 200) : finalText;
  }
}
