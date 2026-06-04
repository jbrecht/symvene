import type Anthropic from "@anthropic-ai/sdk";
import type { Expert, RoundtableSession } from "./types";
import { MODELS } from "./types";
import { ROUND_TITLES } from "./roundtable";

// ["a", "b", "c"] -> "a, b, and c"
function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function buildSynthesisPrompt(experts: Expert[]): string {
  const roster = joinList(experts.map((e) => e.displayName));
  return `You are a neutral facilitator summarising a roundtable discussion between these experts: ${roster}. Your job is to produce a clear, actionable summary for the person who posed the original brief.

Your summary should:
1. Identify 2-3 points of genuine consensus across the experts
2. Identify 1-2 meaningful points of disagreement and explain why they matter for the reader's decision
3. Propose 2-3 specific, concrete next steps or directions that emerged from the discussion — each described in enough detail to act on
4. Be honest about uncertainty: if the experts disagreed about something important, say so rather than papering over it

Refer to the experts by the names they used in the transcript. Do not invent experts who were not part of this discussion.

Keep the summary to around 400 words. Write in plain language. The reader wants to know what to do next.`;
}

function buildTranscript(session: RoundtableSession): string {
  let transcript = `BRIEF: ${session.brief}\n\n`;
  session.rounds.forEach((round, i) => {
    transcript += `=== ROUND ${i + 1}: ${ROUND_TITLES[i] ?? `Round ${i + 1}`} ===\n\n`;
    for (const r of round) {
      transcript += `${r.displayName}:\n${r.content}\n\n`;
    }
  });
  return transcript;
}

export interface SynthesisCallbacks {
  onStart?(): void;
  onText?(delta: string): void;
}

export async function runSynthesis(
  client: Anthropic,
  session: RoundtableSession,
  cb: SynthesisCallbacks = {}
): Promise<string> {
  cb.onStart?.();
  const stream = client.messages.stream({
    model: MODELS.synthesis,
    max_tokens: 2048,
    system: buildSynthesisPrompt(session.experts),
    messages: [{ role: "user", content: buildTranscript(session) }],
  });

  let content = "";
  stream.on("text", (delta) => {
    content += delta;
    cb.onText?.(delta);
  });
  await stream.finalMessage();
  return content;
}

export { buildTranscript };
