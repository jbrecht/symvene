import type Anthropic from "@anthropic-ai/sdk";
import type { Expert, ExpertResponse, RoundtableSession } from "./types";

// Round-specific framing. The number of rounds is just this array's length.
const ROUND_INSTRUCTIONS = [
  "You are sharing your initial perspective on the brief. You may acknowledge what colleagues said before you, but focus on your own view. Be substantive and specific rather than vaguely agreeable.",
  "You have now heard from the other experts. Respond directly to them — agree where you genuinely agree, push back hard where you don't, and sharpen your position. Be specific about where you differ and why.",
  "This is the final round. Stop debating and commit to your OWN concrete, actionable recommendations for the person who posed the brief — your recommendations alone, not a write-up of the whole panel's. Be specific enough to act on. Then name the single biggest remaining risk or open question in one sentence, and stop.",
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
  roundIndex: number,
  sources: string,
  displayName: string
): string {
  let prompt = `BRIEF:\n${brief}\n\n`;

  if (sources) {
    prompt += `SOURCE MATERIAL available to you (this may include documents you requested). Ground your claims in it and cite the relevant source as [Source N]. Where the material doesn't cover a point you need — including evidence you asked for but wasn't provided — reason from your own expertise and say so plainly. Do not invent facts or citations:\n\n${sources}\n\n`;
  }

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

  // The transcript above is a script of "Name:\ncontent" turns, which tempts the model to
  // keep writing and speak for the other experts too (especially in the recommendations
  // round). Pin it to a single first-person turn as this expert only.
  prompt += `\n\nRespond now as ${displayName}, and only as ${displayName}. Write a single first-person turn that is your own contribution. Do NOT write, summarise, or label any other expert's response — no "NAME:" headings for other people; they speak for themselves. Don't restate your own name as a heading either.`;

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

export interface RoundtableOptions {
  roundCount?: number;
  // Per-expert RAG source material, injected into that expert's turns. Returns "" for an
  // expert with no grounding. Each expert sees only its own scoped sources.
  sourcesFor?: (expertId: string) => string;
}

export async function runRoundtable(
  client: Anthropic,
  brief: string,
  experts: Expert[],
  cb: RoundtableCallbacks = {},
  opts: RoundtableOptions = {}
): Promise<RoundtableSession> {
  const roundCount = opts.roundCount ?? ROUND_INSTRUCTIONS.length;
  const rounds: ExpertResponse[][] = [];

  for (let roundIndex = 0; roundIndex < roundCount; roundIndex++) {
    cb.onPhase?.(roundIndex, ROUND_TITLES[roundIndex] ?? `Round ${roundIndex + 1}`);
    const currentRound: ExpertResponse[] = [];

    for (const expert of experts) {
      const sources = opts.sourcesFor?.(expert.id) ?? "";
      const prompt = buildPrompt(
        brief,
        rounds,
        currentRound,
        roundIndex,
        sources,
        expert.displayName
      );
      const response = await callExpert(client, expert, prompt, roundIndex + 1, cb);
      currentRound.push(response);
    }

    rounds.push(currentRound);
  }

  return { brief, experts, rounds, synthesis: "" };
}
