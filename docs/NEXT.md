# Where we are / what's next

## Done (Phase 0 + key entry)
- `src/engine/` — framework-agnostic debate engine ported from math-talk:
  - `types.ts`, `client.ts` (browser Anthropic + `validateKey`), `roundtable.ts`
    (N-round orchestration, streaming callbacks), `synthesizer.ts` (roster-aware),
    `demoPanel.ts` (temporary Visionary/Skeptic/Pragmatist trio).
- `src/components/KeyEntry.tsx`, `src/components/RoundtableView.tsx`, `src/App.tsx`.
- `npm run build` and `npm run dev` both verified.

## Next: Phase 1b — the Facilitator (the differentiator)
An agent that interviews the user and drafts three deliberately-conflicting experts.

1. **Facilitator system prompt** (Sonnet) tuned to design panels whose lenses
   genuinely clash (the way math-talk's Rivera/Chen/Alex do) — not three polite
   variations on the same view.
2. **Conversational intake** — asks 2-4 clarifying questions about the user's goal
   and what kind of disagreement would be useful.
3. **`propose_panel` tool** (forced/structured output) returning 3 `Expert` objects
   (`id`, `displayName`, `model`, `systemPrompt`) — each engineered to push back,
   with a distinct voice and real expertise.
4. **Editable review cards** — user tweaks names/prompts or regenerates, then
   "Start roundtable" passes the panel to `runRoundtable` (replaces `demoPanel.ts`).

### Expert count — DECIDED (2026-06-04)
**User-selectable 2-5 experts, default 3.** The engine already handles any N. The
Facilitator should propose 3 by default but let the user request a different count
(2-5), and the review UI should allow adding/removing an expert within that range.

## Later
- Phase 2: client-side RAG (doc upload → local vector store → grounded experts),
  saved panels, transcript export (markdown).
- Phase 3: optional accounts / sharing / hosted panels.

## Lineage
Generalizes ~/dev/math-talk (bespoke math-game research tool). That repo's
`docs/fraction-slicer-build-spec.md` and its roundtable engine are the reference.
