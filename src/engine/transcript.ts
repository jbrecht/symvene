// Render a completed debate as a Markdown document for download/copy. Pure and
// framework-agnostic: the React layer handles the actual file/clipboard side.
import type { Expert, ExpertResponse } from "./types";
import type { RetrievedChunk } from "./retrieval";
import type { Visualization } from "./visualize";
import { ROUND_TITLES } from "./roundtable";

// A visual for export. `image` (a PNG data URL) is set for Vega-Lite charts so they render in
// static Markdown viewers; without it we fall back to embedding the raw spec.
export type ExportVisual = Visualization & { image?: string };

export interface TranscriptInput {
  brief: string;
  experts: Expert[];
  rounds: ExpertResponse[][];
  synthesis: string;
  grounding?: string; // optional one-line note, e.g. "Grounded in 11 passages from 7 documents."
  visuals?: ExportVisual[];
  // Each expert's retrieved grounding in [Source N] order (keyed by expert id) — rendered
  // as an appendix so the citations in the turns resolve outside the app.
  sources?: Record<string, RetrievedChunk[]>;
}

export function toMarkdown({
  brief,
  experts,
  rounds,
  synthesis,
  grounding,
  visuals,
  sources,
}: TranscriptInput): string {
  const lines: string[] = ["# symvene debate", ""];

  lines.push("## Brief", "", brief.trim(), "");
  if (grounding) lines.push(`_${grounding}_`, "");

  if (experts.length > 0) {
    lines.push("## Panel", "");
    for (const e of experts) lines.push(`- ${e.displayName}`);
    lines.push("");
  }

  rounds.forEach((round, i) => {
    lines.push(`## Round ${i + 1} — ${ROUND_TITLES[i] ?? `Round ${i + 1}`}`, "");
    for (const turn of round) {
      lines.push(`### ${turn.displayName}`, "", turn.content.trim(), "");
    }
  });

  if (synthesis.trim()) lines.push("## Synthesis", "", synthesis.trim(), "");

  if (visuals && visuals.length > 0) {
    lines.push("## Visuals", "");
    for (const v of visuals) {
      if (v.title) lines.push(`### ${v.title}`, "");
      if (v.type === "vega_lite" && v.image) {
        // Static image so the chart renders anywhere (Vega-Lite has no native MD renderer).
        lines.push(`![${v.title || v.caption || "chart"}](${v.image})`, "");
      } else {
        // Mermaid renders natively in GitHub/VS Code; Vega-Lite without an image falls back to its spec.
        lines.push("```" + (v.type === "mermaid" ? "mermaid" : "json"), v.spec.trim(), "```", "");
      }
      if (v.caption) lines.push(`_${v.caption}_`, "");
    }
  }

  const groundedExperts = sources ? experts.filter((e) => (sources[e.id] ?? []).length > 0) : [];
  if (groundedExperts.length > 0) {
    lines.push("## Source material", "");
    lines.push(
      "_Each expert drew on its own numbered source list; a [Source N] citation in a turn refers to that expert's list below._",
      ""
    );
    for (const e of groundedExperts) {
      lines.push(`### ${e.displayName}`, "");
      sources![e.id].forEach((r, i) => {
        // <details> keeps a long appendix collapsed in GitHub/VS Code; the blank lines
        // around the blockquote make the inner Markdown render.
        lines.push("<details>", `<summary>Source ${i + 1} — ${r.chunk.docName}</summary>`, "");
        for (const textLine of r.chunk.text.trim().split("\n")) {
          lines.push(`> ${textLine}`);
        }
        lines.push("", "</details>", "");
      });
    }
  }

  lines.push("---", "", "_Generated with symvene_");
  return lines.join("\n");
}

// A filesystem-safe filename derived from the brief. Truncates at a word boundary so a
// long brief doesn't get cut mid-word (e.g. "colonizing" → "colon").
export function transcriptFilename(brief: string): string {
  const base = brief
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  let slug = base;
  if (base.length > 50) {
    slug = base.slice(0, 50);
    const lastHyphen = slug.lastIndexOf("-");
    if (lastHyphen > 0) slug = slug.slice(0, lastHyphen); // drop the partial trailing word
  }

  return `symvene-${slug || "debate"}.md`;
}
