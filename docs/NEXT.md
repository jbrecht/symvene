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

## In progress: Phase 2 (branch `phase-2-rag`)
**Client-side RAG — DONE.** Doc upload → Voyage embeddings → IndexedDB → grounded experts.
- `engine/voyage.ts` (embeddings client; Voyage allows browser CORS, so still no backend —
  but needs a *second* BYO key), `engine/chunk.ts` (boundary-aware chunking), `engine/pdf.ts`
  (pdfjs text extraction, lazy-loaded), `engine/retrieval.ts` (types + cosine top-k),
  `engine/rag.ts` (`ingestDocument`/`retrieve`).
- `lib/ragStore.ts` (IndexedDB persistence), `lib/storage.ts` (+ Voyage key).
- `components/SourcePanel.tsx` (collapsible upload/paste/list UI on the compose screen).
- `roundtable.ts` gained `opts.sources`; `RoundtableView` retrieves for the brief and injects.
- Default embedding model: `VOYAGE_MODEL = "voyage-4"` (one-line change in `engine/voyage.ts`).

**Per-expert RAG corpora — DONE.** Each expert brings its own knowledge base.
- Facilitator's `propose_panel` now also emits per-expert `informationNeeds` (descriptions of
  evidence the expert wants, in its voice — never fabricated citations).
- `RagDoc`/`DocChunk` carry an optional `expertId` (`undefined` = shared "problem" doc; a value
  = private to that expert). `scopedChunks()` = own ∪ shared. Shared docs persist (IndexedDB);
  per-expert docs are **session-scoped (in-memory)** since expert ids aren't stable across panels.
- `runRoundtable` takes `opts.sourcesFor(expertId)`; `RoundtableView` retrieves per expert.
- `components/DocUploader.tsx` (extracted) is reused by `SourcePanel` (shared) and the
  per-expert cards in `FacilitatorView`.
- Plan: `~/.claude/plans/tender-enchanting-meteor.md`.

**Transcript export — DONE.** `engine/transcript.ts` (`toMarkdown()` + `transcriptFilename()`,
pure) renders a finished debate (brief, grounding note, panel, rounds, synthesis) as Markdown;
`RoundtableView` shows Download .md / Copy buttons when the run is done.

**Saved / reusable panels — DONE.** A panel (experts + their per-expert docs) is saved as a
frozen unit and reused across questions.
- `lib/panelStore.ts` (separate `symvene-panels` IndexedDB DB): `SavedPanel` =
  `{ id, name, createdAt, experts, docs, chunks }`; `loadPanels`/`savePanel`/`deletePanel`.
- `components/PanelReview.tsx` extracted from `FacilitatorView` (editable cards + Save panel),
  reused by the Facilitator path and the new `review` stage.
- `components/SavedPanelsList.tsx` on the compose screen (Use/Delete). App: `panels` state,
  `handleSavePanel`/`handleUsePanel`/`handleDeletePanel`, and the `review` stage.
- This is where **per-expert corpus persistence** landed (a saved panel's frozen expert ids
  make it safe).

**On-demand visuals — DONE.** A **Visualize** button on the finished debate runs a forced-tool
Sonnet pass (`engine/visualize.ts`) that returns curated visualization specs — Mermaid diagrams
(agreement maps, recommendation quadrants) and Vega-Lite data charts (only from numbers actually
in the debate). Rendered client-side via lazy-loaded `mermaid`/`vega-embed`
(`components/Visuals|MermaidDiagram|VegaChart.tsx`); embedded in the `.md` export. Deps: mermaid,
vega-embed.

**Still TODO for Phase 2:**
- Possible polish: reranking; per-lens query shaping; clickable `[Source N]` citations in the
  UI; let the Facilitator see the corpus; agentic/mid-debate document requests.
- Visuals follow-ups: more chart types, edit/regenerate a single visual, a one-shot "repair" retry
  for a spec that fails to render.

## Later
- Phase 3: optional accounts / sharing / hosted panels.

## Lineage
Generalizes ~/dev/math-talk (bespoke math-game research tool). That repo's
`docs/fraction-slicer-build-spec.md` and its roundtable engine are the reference.
