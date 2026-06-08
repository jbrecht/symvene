# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

symvene is a **client-side, bring-your-own-key web app**: the user pastes their own
Anthropic API key, and a panel of deliberately-conflicting AI expert personas debates
their question across multiple rounds, ending in a neutral synthesis. There is **no
backend** — the key and all data stay in the browser and are sent only to the Anthropic
API directly (privacy is a deliberate selling point and removes key-storage liability).

It generalizes a pattern proven in a prior bespoke tool, "math-talk" (`~/dev/math-talk`,
the reference implementation), into a reusable product for any research/decision question.

## Commands

```bash
npm run dev      # Vite dev server
npm run build    # tsc -b (typecheck) then vite build — run this to verify a change compiles
npm run lint     # eslint .
npm run preview  # serve the production build
```

There is **no test runner** configured yet. `npm run build` is the current
verification gate (it typechecks via `tsc -b` before bundling).

## Architecture

The codebase is split into a **framework-agnostic engine** (`src/engine/`) and a thin
**React UI** (`src/components/`, `src/App.tsx`). The engine is kept free of React on
purpose so it can be extracted as a standalone library later — do not import React or
DOM APIs into `src/engine/`.

### Engine (`src/engine/`)

- **`types.ts`** — core data shapes (`Expert`, `ExpertResponse`, `RoundtableSession`) and
  the `MODELS` map. `MODELS` is the single source of truth for which Claude model each
  role uses (facilitator/synthesis = Sonnet, expert turns = Haiku); change model ids here.
- **`client.ts`** — `makeClient(apiKey)` builds the browser Anthropic client (requires
  `dangerouslyAllowBrowser: true`); `validateKey` does a cheap ping to verify a pasted key.
- **`roundtable.ts`** — `runRoundtable()` orchestrates the debate. Experts respond
  **sequentially within a round** (each sees the prior speakers' turns this round), and
  the loop runs N rounds. **The number of rounds is just the length of the
  `ROUND_INSTRUCTIONS` array** — round count, per-round framing, and `ROUND_TITLES` are all
  driven by these parallel arrays. Each turn is streamed; progress is reported via the
  `RoundtableCallbacks` (`onPhase`/`onTurnStart`/`onText`/`onTurnEnd`). The optional
  `opts.sources` (a RAG block) is injected into every expert turn with an instruction to
  ground claims in it and cite `[Source N]`.
- **`synthesizer.ts`** — `runSynthesis()` takes a completed session, builds a
  roster-aware prompt (it names the actual experts so it won't invent ones), and streams a
  ~400-word actionable summary.
- **`facilitator.ts`** — the Facilitator: a Sonnet agent that interviews the user, then
  calls a forced `propose_panel` tool to generate the `Expert[]` panel. `facilitatorTurn()`
  runs one streamed turn against the message history and returns **either** a clarifying
  `question` (stream it via `onText`) **or** the proposed `panel`. The conversation is a
  standard tool-use loop driven by the UI: the returned `assistant` message is appended to
  the history before the next turn. Panel size is bounded by `MIN_EXPERTS`/`MAX_EXPERTS`
  (2–5, default 3). `normalizeExperts()` assigns the expert model and de-dupes ids.

#### RAG (client-side, optional — Phase 2)

The corpus is a flat list of embedded chunks; retrieval is brute-force cosine in-browser.
- **`voyage.ts`** — Voyage embeddings client (`embed(key, texts, "document"|"query")`,
  batched; `validateVoyageKey`). Called directly from the browser — **Voyage returns
  permissive CORS**, so no backend is needed. `VOYAGE_MODEL` is the single place to change
  the model. Needs a **second** BYO key (separate from the Anthropic key).
- **`chunk.ts`** — `chunkText()`: paragraph-boundary-aware packing toward ~1200 chars with
  ~150-char overlap; oversized paragraphs are hard-windowed.
- **`pdf.ts`** — `extractPdfText()` via `pdfjs-dist`. **Dynamically imported** from
  `SourcePanel` so pdfjs + its worker stay out of the initial bundle (separate `pdf-*.js`
  chunk). Worker URL comes from a Vite `?url` import. No OCR — scanned PDFs yield no text.
- **`retrieval.ts`** — `DocChunk`/`RagDoc` types, `cosineSimilarity`, `search()` (top-k with
  a `minScore` floor), `formatSources()` (renders chunks into the prompt block).
- **`rag.ts`** — orchestration: `ingestDocument()` (chunk → embed → assemble) and
  `retrieve()` (embed query → search). `DEFAULT_TOP_K`.

### UI (`src/`)

- **`App.tsx`** — top-level screen flow as a `Stage` union: no key → `KeyEntry`; key present
  → `compose` (brief + expert-count selector) → `facilitate` (`FacilitatorView`) →
  `roundtable` (`RoundtableView`).
- **`components/KeyEntry.tsx`** — key paste + live validation gate.
- **`components/FacilitatorView.tsx`** — drives the intake conversation (holds the
  `Anthropic.MessageParam[]` history in a ref, streams facilitator questions, collects user
  answers) and then renders the proposed panel as **editable cards** (tweak name/persona,
  add/remove within 2–5, regenerate). On "Start roundtable" it hands the final `Expert[]`
  up to `App` via `onPanelReady`.
- **`components/RoundtableView.tsx`** — drives a run: optionally **retrieves** source
  chunks for the brief (when a Voyage key + corpus exist), then calls `runRoundtable` (with
  `sources`) and `runSynthesis`, translating streaming callbacks into incremental React
  state. Retrieval failure is non-fatal — the debate proceeds ungrounded with a warning.
  Uses a `started` ref to guard against double-starting under React strict mode.
- **`components/SourcePanel.tsx`** — collapsible "source material" section on the compose
  screen: Voyage key gate, file (.txt/.md/.pdf) + paste ingestion, and the doc list. Does
  ingestion; hands `(doc, chunks)` to `App` to persist.
- **`lib/storage.ts`** — `localStorage` keys (try/catch for private mode): the Anthropic key
  (`symvene.anthropic_key`) and the optional Voyage key (`symvene.voyage_key`).
- **`lib/ragStore.ts`** — IndexedDB persistence (`symvene-rag` DB, `docs` + `chunks` stores)
  so the corpus + its `Float32Array` embeddings survive reloads. `App` loads it on mount and
  holds the corpus in memory; the engine never touches storage.

### Data flow

`KeyEntry` → key in `localStorage` → `App` collects a brief (and optionally source docs via
`SourcePanel`, embedded with Voyage and stored in IndexedDB) → `FacilitatorView` interviews
the user and produces an `Expert[]` panel → `RoundtableView` retrieves grounding chunks for
the brief, then calls `runRoundtable(client, brief, experts, callbacks, { sources })` →
streamed `ExpertResponse[][]` → `runSynthesis(client, session)` → streamed synthesis string.
Experts are plain data passed between layers, so the panel's *source* (Facilitator, a saved
panel, etc.) is decoupled from the debate engine.

## Stack notes

- **Tailwind v4** via `@tailwindcss/vite` (no `tailwind.config.js`; configured in CSS).
- React 19, TypeScript ~6, Vite 8. ESM throughout (`"type": "module"`).
- `@anthropic-ai/sdk` in browser mode — all model calls use `client.messages.stream(...)`
  and consume the `"text"` event for incremental UI.
- **RAG deps:** `pdfjs-dist` (PDF text, lazy-loaded) and `idb` (IndexedDB wrapper). Voyage
  embeddings are called over raw `fetch` (no SDK).

## Roadmap context

Phase 0 (engine + key entry) and Phase 1b (the Facilitator) are done. **Phase 2 is in
progress on the `phase-2-rag` branch**: client-side RAG (doc upload → Voyage embeddings →
IndexedDB → grounded experts) is built; **saved/reusable panels and transcript export are
still TODO**. See `docs/NEXT.md`.
