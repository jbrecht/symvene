# Where we are / what's next

## Done (Phase 0 + key entry)
- `src/engine/` — framework-agnostic debate engine ported from math-talk:
  - `types.ts`, `client.ts` (browser Anthropic + `validateKey`), `roundtable.ts`
    (N-round orchestration, streaming callbacks), `synthesizer.ts` (roster-aware).
- `src/components/KeyEntry.tsx`, `src/components/RoundtableView.tsx`, `src/App.tsx`.
- `npm run build` and `npm run dev` both verified.

## Done (Phase 1b — the Facilitator)
The differentiator: an agent that interviews the user and drafts deliberately-conflicting
experts.
- `src/engine/facilitator.ts` — Sonnet agent. `facilitatorTurn()` runs one streamed turn
  against the message history and returns either a clarifying `question` or a `panel` via
  the forced `propose_panel` tool. System prompt is tuned to design panels whose lenses
  genuinely clash. `normalizeExperts()` assigns the expert model + de-dupes ids.
  `MIN_EXPERTS`/`MAX_EXPERTS`/`DEFAULT_EXPERTS` = 2 / 5 / 3.
- `src/components/FacilitatorView.tsx` — drives the conversational intake, then renders the
  proposed panel as editable cards (tweak name/persona, add/remove within 2–5, regenerate),
  and hands the final `Expert[]` to the roundtable.
- `src/App.tsx` — `compose` → `facilitate` → `roundtable` stage machine, with an
  expert-count selector on the compose screen.
- `src/engine/demoPanel.ts` removed (the Facilitator replaces it).

## Next: Phase 2
- Client-side RAG: doc upload → local vector store (Voyage embeddings) → grounded experts.
- Saved / reusable expert panels.
- Transcript export (markdown) — `buildTranscript` in `synthesizer.ts` is a starting point.

## Later
- Phase 3: optional accounts / sharing / hosted panels.

## Lineage
Generalizes ~/dev/math-talk (bespoke math-game research tool). That repo's
`docs/fraction-slicer-build-spec.md` and its roundtable engine are the reference.
