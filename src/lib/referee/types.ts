export type DebateRole = "affirmative" | "negative";
export type Severity = "info" | "low" | "medium" | "high";

export interface RefereeEvent {
  type: string;
  severity: Severity;
  message: string;
  points_delta: number;
  quote?: string;
}

export interface LiveCheckRequest {
  room_id: string;
  speaker_id: string;
  speaker_role: DebateRole;
  topic: string;
  text: string;
}

export interface LiveCheckResponse {
  room_id: string;
  speaker_id: string;
  events: RefereeEvent[];
}

export interface FinalScoreRequest {
  room_id: string;
  topic: string;
  debate_format?: string;
  affirmative_transcript: string;
  negative_transcript: string;
  affirmative_name?: string;
  negative_name?: string;
}

export interface SideScore {
  logic: number;
  evidence: number;
  clarity: number;
  rebuttal: number;
  civility: number;
  total: number;
}

export interface FallacyFinding {
  side: "affirmative" | "negative";
  fallacy: string;
  quote: string;
  explanation: string;
  severity: Severity;
}

export interface FinalScoreResult {
  winner_recommendation: "affirmative" | "negative" | "tie";
  confidence: number;
  affirmative: SideScore;
  negative: SideScore;
  summary: string;
  key_moments: string[];
  fallacies: FallacyFinding[];
  improvement_tips: Record<string, string>;
  referee_notes: string[];
}

export interface FinalScoreResponse {
  room_id: string;
  model: string;
  result: FinalScoreResult;
}
