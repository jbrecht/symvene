// A fully-defined expert persona that sits at the roundtable.
export interface Expert {
  id: string;
  displayName: string; // e.g. "DR. CHEN (Cognitive Scientist)"
  model: string; // Claude model id used for this expert's turns
  systemPrompt: string; // the full persona definition
}

// One expert's contribution in one round.
export interface ExpertResponse {
  expertId: string;
  displayName: string;
  round: number; // 1-indexed
  content: string;
}

// The complete record of a roundtable session.
export interface RoundtableSession {
  brief: string;
  experts: Expert[];
  rounds: ExpertResponse[][]; // rounds[i] = all expert responses for round i+1
  synthesis: string;
}

// Model tiers used across the app. Kept here so they're easy to change in one place.
export const MODELS = {
  facilitator: "claude-sonnet-4-6",
  expert: "claude-haiku-4-5-20251001",
  synthesis: "claude-sonnet-4-6",
} as const;
