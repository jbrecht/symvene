# symvene

Assemble a panel of AI experts and have them debate your question.

symvene generalizes a pattern proven in a bespoke tool ("math-talk"): instead of
asking one model a question, you convene **three expert personas** who debate it
across multiple rounds, then a neutral facilitator synthesizes the discussion into
actionable recommendations. The tension between distinct, deliberately-conflicting
perspectives produces better answers than any single response.

## Design choices

- **Client-side only.** No backend. Your Anthropic API key and your data stay in
  your browser and are sent only to the Anthropic API directly.
- **Bring your own credentials.** Paste an Anthropic key; it's stored in
  `localStorage` on your machine.
- **App-first**, with the debate engine kept as framework-agnostic modules under
  `src/engine/` so it can be extracted as a library later.

## Stack

Vite + React + TypeScript + Tailwind v4, `@anthropic-ai/sdk` (browser mode).
Sonnet for the facilitator + synthesis, Haiku for expert turns.

## Run

```bash
npm install
npm run dev
```

Open the local URL, paste an Anthropic key, and convene a panel.

## Status / roadmap

- **Phase 0 ✅** — debate engine ported and running in-browser; key entry.
- **Phase 1 (in progress)** — the Facilitator: an agent that interviews you and
  drafts three custom experts you can review and edit before the roundtable.
  (Currently a fixed demo panel of Visionary / Skeptic / Pragmatist.)
- **Phase 2** — client-side RAG (upload docs → local vector store → grounded
  experts), saved expert panels, transcript export.
- **Phase 3** — optional accounts, sharing, hosted panels.

## Layout

```
src/
├── engine/           # framework-agnostic debate engine
│   ├── types.ts        # Expert, ExpertResponse, RoundtableSession, MODELS
│   ├── client.ts       # browser Anthropic client + key validation
│   ├── roundtable.ts   # multi-round orchestration with streaming callbacks
│   ├── synthesizer.ts  # roster-aware synthesis
│   └── demoPanel.ts    # temporary fixed panel (replaced by the Facilitator)
├── components/       # React UI
├── lib/storage.ts    # localStorage key handling
└── App.tsx           # screen flow
```
