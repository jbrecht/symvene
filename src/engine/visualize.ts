// On-demand visualization pass: read a finished debate + synthesis and return a small,
// curated set of visualization specs (Mermaid diagrams and/or Vega-Lite data charts). The
// model emits specs, not pixels — the browser renders them. Framework-agnostic.
import type Anthropic from "@anthropic-ai/sdk";
import type { Expert, ExpertResponse } from "./types";
import { MODELS } from "./types";
import { buildTranscript } from "./synthesizer";

export type VizType = "mermaid" | "vega_lite";

export interface Visualization {
  type: VizType;
  title: string;
  caption: string;
  spec: string; // Mermaid diagram source, or a Vega-Lite spec as a JSON string
}

interface VizInput {
  brief: string;
  experts: Expert[];
  rounds: ExpertResponse[][];
  synthesis: string;
}

const PROPOSE_VISUALIZATIONS_TOOL: Anthropic.Tool = {
  name: "propose_visualizations",
  description:
    "Return the visualizations that would genuinely sharpen this debate's final report. Return an empty array if none would add real clarity — do not invent visuals to fill space.",
  input_schema: {
    type: "object",
    properties: {
      visualizations: {
        type: "array",
        description: "Zero or more visualizations, ordered most-useful first.",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["mermaid", "vega_lite"],
              description:
                "'mermaid' for structural/argument diagrams (an agreement/disagreement view, a recommendation quadrantChart, flows); 'vega_lite' for a data chart built ONLY from numbers actually stated in the debate.",
            },
            title: { type: "string", description: "Short heading for the visual." },
            caption: {
              type: "string",
              description:
                "One sentence on what it shows; for data charts, name where the numbers came from (which expert/round/source).",
            },
            spec: {
              type: "string",
              description:
                "For 'mermaid': the Mermaid diagram source. For 'vega_lite': a complete Vega-Lite specification as a JSON string, with the data inline in data.values.",
            },
          },
          required: ["type", "title", "caption", "spec"],
        },
      },
    },
    required: ["visualizations"],
  },
};

const SYSTEM = `You turn a finished expert-panel debate into a small set of visuals for the final report. You are a curator, not a decorator: only produce a visual when it materially clarifies the discussion, and return an empty array when nothing would.

Two kinds:
- mermaid — structural/argument diagrams. Strong defaults: a view of where the experts agree vs. disagree, and a recommendation 2x2 using Mermaid's quadrantChart. Flowcharts of how factors connect are also fine. Use valid Mermaid syntax and concise labels.
- vega_lite — a data chart, ONLY when the debate contains real, comparable numbers. Use exactly the numbers stated in the transcript; never invent, estimate, or extrapolate data. Put the data inline (data.values) and name the source in the caption. If there are no real numbers, produce no data chart.

Keep it to the few visuals that earn their place (usually 1-3). Prefer clarity over cleverness. Make every spec complete and valid.`;

export async function generateVisualizations(
  client: Anthropic,
  input: VizInput
): Promise<Visualization[]> {
  const transcript =
    buildTranscript({
      brief: input.brief,
      experts: input.experts,
      rounds: input.rounds,
      synthesis: input.synthesis,
    }) + `=== SYNTHESIS ===\n\n${input.synthesis}\n`;

  const stream = client.messages.stream({
    model: MODELS.synthesis,
    max_tokens: 4096,
    system: SYSTEM,
    tools: [PROPOSE_VISUALIZATIONS_TOOL],
    tool_choice: { type: "tool", name: "propose_visualizations" },
    messages: [{ role: "user", content: transcript }],
  });
  const final = await stream.finalMessage();

  const toolUse = final.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
  );
  if (!toolUse) return [];

  const raw = (toolUse.input as { visualizations?: unknown }).visualizations;
  if (!Array.isArray(raw)) return [];

  // Validate defensively — drop anything malformed rather than rendering garbage.
  const out: Visualization[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const v = item as Record<string, unknown>;
    const type: VizType | null =
      v.type === "vega_lite" ? "vega_lite" : v.type === "mermaid" ? "mermaid" : null;
    const spec = typeof v.spec === "string" ? v.spec.trim() : "";
    if (!type || !spec) continue;
    out.push({
      type,
      title: typeof v.title === "string" ? v.title : "",
      caption: typeof v.caption === "string" ? v.caption : "",
      spec,
    });
  }
  return out;
}
