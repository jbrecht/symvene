import type Anthropic from "@anthropic-ai/sdk";
import type { Expert, ExpertResponse, RoundtableSession } from "./types";

// Round-specific framing. The number of rounds is just this array's length.
const ROUND_INSTRUCTIONS = [
  "You are sharing your initial perspective on the brief. You may acknowledge what colleagues said before you, but focus on your own view. Be substantive and specific rather than vaguely agreeable.",
  "You have now heard from the other experts. Respond directly to them — agree where you genuinely agree, push back hard where you don't, and sharpen your position. Be specific about where you differ and why.",
  "This is the final round. Stop debating and commit to concrete, actionable recommendations for the person who posed the brief. Be specific enough to act on. Then name the single biggest remaining risk or open question in one sentence, and stop.",
] as const;

export const ROUND_TITLES = [
  "Initial Perspectives",
  "Responses & Pushback",
  "Recommendations",
] as const;

export interface RoundtableCallbacks {
  onPhase?(roundIndex: number, title: string): void;
  onTurnStart?(expert: Expert, round: number): void;
  onText?(expert: Expert, round: number, delta: string): void;
  onTurnEnd?(response: ExpertResponse): void;
}

function buildPrompt(
  brief: string,
  completedRounds: ExpertResponse[][],
  currentRound: ExpertResponse[],
  roundIndex: number
): string {
  let prompt = `BRIEF:\n${brief}\n\n`;

  completedRounds.forEach((round, i) => {
    prompt += `=== ROUND ${i + 1}: ${ROUND_TITLES[i] ?? `Round ${i + 1}`} ===\n\n`;
    for (const r of round) {
      prompt += `${r.displayName}:\n${r.content}\n\n`;
    }
  });

  if (currentRound.length > 0) {
    prompt += `=== ROUND ${roundIndex + 1} SO FAR ===\n\n`;
    for (const r of currentRound) {
      prompt += `${r.displayName}:\n${r.content}\n\n`;
    }
  }

  prompt += ROUND_INSTRUCTIONS[roundIndex] ?? ROUND_INSTRUCTIONS[ROUND_INSTRUCTIONS.length - 1];
  return prompt;
}

async function callExpert(
  client: Anthropic,
  expert: Expert,
  userMessage: string,
  round: number,
  cb: RoundtableCallbacks
): Promise<ExpertResponse> {
  cb.onTurnStart?.(expert, round);

  const stream = client.messages.stream({
    model: expert.model,
    max_tokens: 1024,
    system: expert.systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  let content = "";
  stream.on("text", (delta) => {
    content += delta;
    cb.onText?.(expert, round, delta);
  });
  await stream.finalMessage();

  const response: ExpertResponse = {
    expertId: expert.id,
    displayName: expert.displayName,
    round,
    content,
  };
  cb.onTurnEnd?.(response);
  return response;
}

export async function runRoundtable(
  client: Anthropic,
  brief: string,
  experts: Expert[],
  cb: RoundtableCallbacks = {},
  roundCount = ROUND_INSTRUCTIONS.length
): Promise<RoundtableSession> {
  const rounds: ExpertResponse[][] = [];

  for (let roundIndex = 0; roundIndex < roundCount; roundIndex++) {
    cb.onPhase?.(roundIndex, ROUND_TITLES[roundIndex] ?? `Round ${roundIndex + 1}`);
    const currentRound: ExpertResponse[] = [];

    for (const expert of experts) {
      const prompt = buildPrompt(brief, rounds, currentRound, roundIndex);
      const response = await callExpert(client, expert, prompt, roundIndex + 1, cb);
      currentRound.push(response);
    }

    rounds.push(currentRound);
  }

  return { brief, experts, rounds, synthesis: "" };
}
