// Render a completed debate as a Markdown document for download/copy. Pure and
// framework-agnostic: the React layer handles the actual file/clipboard side.
import type { Expert, ExpertResponse } from "./types";
import { ROUND_TITLES } from "./roundtable";

export interface TranscriptInput {
  brief: string;
  experts: Expert[];
  rounds: ExpertResponse[][];
  synthesis: string;
  grounding?: string; // optional one-line note, e.g. "Grounded in 11 passages from 7 documents."
}

export function toMarkdown({
  brief,
  experts,
  rounds,
  synthesis,
  grounding,
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
