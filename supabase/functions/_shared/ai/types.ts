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
  model?: string;
}

/**
 * 音声文字起こしプロバイダーのインターフェース
 * 新しいAIプロバイダーを追加する際は、このインターフェースを実装する
 */
export interface TranscriptionProvider {
  readonly name: string;
  transcribe(audio: Uint8Array, mimeType: string): Promise<TranscriptionResult>;
}

/**
 * 対応するAIプロバイダーの種類
 */
export type AIProviderType = "openai" | "sakura";

/**
 * 要約結果
 */
export interface SummarizationResult {
  summary: string;
}

/**
 * 要約プロバイダー
 */
export interface SummarizationProvider {
  readonly name: string;
  summarize(text: string): Promise<SummarizationResult>;
}

/**
 * 危険検知（認知症関連のリスク兆候など）
 */
export type RiskSeverity = "medium" | "high";

export interface RiskFinding {
  id: string; // 例: "medication_nonadherence", "fall_risk", "dehydration"
  title: string; // 人が読める見出し
  severity: RiskSeverity;
  evidence: string[]; // ログ文面など根拠
  recommendation: string; // 推奨対応
  tasks?: string[]; // AIが生成する具体的タスク（最大3件程度）
  goal?: string; // AIが生成する到達目標
}

export interface RiskAssessmentResult {
  riskLevel: RiskSeverity;
  findings: RiskFinding[];
  notes?: string; // 補足
}

export interface RiskAssessmentProvider {
  readonly name: string;
  assessRisk(careLogs: unknown[]): Promise<RiskAssessmentResult>;
}
