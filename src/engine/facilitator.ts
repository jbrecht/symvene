import type Anthropic from "@anthropic-ai/sdk";
import type { Expert } from "./types";
import { MODELS } from "./types";

// The Facilitator is a Sonnet agent that interviews the user about their question,
// then designs a panel of *deliberately-conflicting* expert personas. It either asks
// a clarifying question (plain text) or commits a panel via the `propose_panel` tool.
// This module is framework-agnostic; the React layer drives the conversation.

export const MIN_EXPERTS = 2;
export const MAX_EXPERTS = 5;
export const DEFAULT_EXPERTS = 3;

// A raw expert as the model proposes it — no model id (we assign that ourselves).
interface ProposedExpert {
  id: string;
  displayName: string;
  systemPrompt: string;
}

const PROPOSE_PANEL_TOOL: Anthropic.Tool = {
  name: "propose_panel",
  description:
    "Commit the panel of experts who will debate the user's question. Call this only once you understand the question well enough to design experts whose perspectives genuinely clash. Each expert must be a fully-realised persona with real domain expertise, a distinct voice, and a lens that will put them in productive tension with the others.",
  input_schema: {
    type: "object",
    properties: {
      experts: {
        type: "array",
        description:
          "The panel. Between 2 and 5 experts. Order them so adjacent experts tend to disagree.",
        items: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "A short lowercase-hyphenated slug, e.g. 'cognitive-scientist'.",
            },
            displayName: {
              type: "string",
              description:
                "The name shown at the roundtable, e.g. 'DR. CHEN (Cognitive Scientist)' or 'THE SKEPTIC'.",
            },
            systemPrompt: {
              type: "string",
              description:
                "The full persona definition this expert will run on: their role, their lens, their voice, and instructions to stay in character, speak in the first person, be specific, and disagree where they genuinely would. Roughly 150-250 words.",
            },
          },
          required: ["id", "displayName", "systemPrompt"],
        },
      },
    },
    required: ["experts"],
  },
};

function buildFacilitatorSystem(expertCount?: number | null): string {
  const countRule =
    expertCount != null
      ? `The user has asked for exactly ${expertCount} experts. Propose exactly ${expertCount}.`
      : `Propose ${DEFAULT_EXPERTS} experts by default. If the user explicitly asks for a different number, honour it — but never fewer than ${MIN_EXPERTS} or more than ${MAX_EXPERTS}.`;

  return `You are the Facilitator. Your job is to assemble a panel of AI experts who will debate a question the user cares about, and whose disagreement will produce a better answer than any single perspective.

You work in two steps:

STEP 1 — INTERVIEW. Briefly interview the user so you can design the right panel. Ask 2 to 4 sharp clarifying questions in a SINGLE message — about their real goal, the decision or output they're after, the context and constraints, and what kind of disagreement would actually be useful to them. Do not interrogate them across many rounds; one focused round of questions is usually enough. If the user's opening brief is already rich and specific, you may skip straight to STEP 2.

STEP 2 — PROPOSE THE PANEL. When you understand the question well enough, call the propose_panel tool. Do not announce that you are about to do it and do not write the panel out as prose — just call the tool.

What makes a good panel:
- The experts must genuinely CLASH. Give them lenses that lead to different conclusions, not three polite variations on the same view. Think of how a visionary, a hard-nosed skeptic, and an execution-focused pragmatist would pull a question in different directions — then tailor that tension to THIS user's question.
- Each expert has real, specific domain expertise relevant to the question — not a generic "optimist/pessimist" pairing.
- Each expert has a distinct voice and is engineered to push back on the others.
- ${countRule}

Each expert's systemPrompt is the actual prompt that expert will run on during the debate. Write it in the second person ("You are..."), define their role, their lens, and their style, and instruct them to: stay fully in character, speak in the first person, give substantive and specific opinions rather than vague agreement, disagree strongly where they genuinely would (the tension is the point), not break character, and keep each turn to roughly 200-300 words.

Be warm and concise in your interview questions. The user is not a prompt engineer — keep the conversation natural.`;
}

export interface FacilitatorCallbacks {
  onText?(delta: string): void;
}

export interface FacilitatorQuestion {
  type: "question";
  text: string;
  assistant: Anthropic.MessageParam;
}

export interface FacilitatorPanel {
  type: "panel";
  experts: Expert[];
  assistant: Anthropic.MessageParam;
}

export type FacilitatorResult = FacilitatorQuestion | FacilitatorPanel;

function slugify(value: string, fallback: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

// Turn raw proposed experts into engine `Expert`s: assign the expert model and
// guarantee unique, non-empty ids.
export function normalizeExperts(raw: ProposedExpert[]): Expert[] {
  const seen = new Set<string>();
  return raw.map((e, i) => {
    let id = slugify(e.id || e.displayName || "", `expert-${i + 1}`);
    while (seen.has(id)) id = `${id}-${i + 1}`;
    seen.add(id);
    return {
      id,
      displayName: e.displayName?.trim() || `Expert ${i + 1}`,
      model: MODELS.expert,
      systemPrompt: e.systemPrompt?.trim() ?? "",
    };
  });
}

// Run one Facilitator turn against the running message history. Returns either a
// clarifying question (stream it with cb.onText) or the proposed panel. The returned
// `assistant` message must be appended to the history before the next turn.
export async function facilitatorTurn(
  client: Anthropic,
  messages: Anthropic.MessageParam[],
  expertCount?: number | null,
  cb: FacilitatorCallbacks = {}
): Promise<FacilitatorResult> {
  const stream = client.messages.stream({
    model: MODELS.facilitator,
    max_tokens: 4096,
    system: buildFacilitatorSystem(expertCount),
    tools: [PROPOSE_PANEL_TOOL],
    messages,
  });

  stream.on("text", (delta) => cb.onText?.(delta));
  const final = await stream.finalMessage();
  const assistant: Anthropic.MessageParam = { role: "assistant", content: final.content };

  const toolUse = final.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );

  if (toolUse) {
    const input = toolUse.input as { experts?: ProposedExpert[] };
    const experts = normalizeExperts(input.experts ?? []);
    return { type: "panel", experts, assistant };
  }

  const text = final.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  return { type: "question", text, assistant };
}
