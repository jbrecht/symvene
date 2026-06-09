import { useEffect, useState } from "react";
import { KeyEntry } from "./components/KeyEntry";
import { FacilitatorView } from "./components/FacilitatorView";
import { RoundtableView } from "./components/RoundtableView";
import { SourcePanel } from "./components/SourcePanel";
import { MIN_EXPERTS, MAX_EXPERTS, DEFAULT_EXPERTS } from "./engine/facilitator";
import type { Expert } from "./engine/types";
import type { DocChunk, RagDoc } from "./engine/retrieval";
import { loadKey, clearKey, loadVoyageKey, saveVoyageKey, clearVoyageKey } from "./lib/storage";
import { loadCorpus, addDocument, deleteDocument, clearCorpus } from "./lib/ragStore";

type Stage =
  | { name: "compose" }
  | { name: "facilitate"; brief: string; expertCount: number | null }
  | { name: "roundtable"; brief: string; experts: Expert[] };

const COUNT_OPTIONS = Array.from(
  { length: MAX_EXPERTS - MIN_EXPERTS + 1 },
  (_, i) => MIN_EXPERTS + i
);

function App() {
  const [apiKey, setApiKey] = useState<string | null>(() => loadKey());
  const [brief, setBrief] = useState("");
  const [count, setCount] = useState<number | "auto">("auto");
  const [stage, setStage] = useState<Stage>({ name: "compose" });

  // RAG corpus (persisted in IndexedDB) + the Voyage embeddings key.
  const [voyageKey, setVoyageKey] = useState<string | null>(() => loadVoyageKey());
  const [docs, setDocs] = useState<RagDoc[]>([]);
  const [chunks, setChunks] = useState<DocChunk[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadCorpus().then(({ docs, chunks }) => {
      if (!cancelled) {
        setDocs(docs);
        setChunks(chunks);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!apiKey) {
    return <KeyEntry onReady={setApiKey} />;
  }

  function reset() {
    clearKey();
    setApiKey(null);
    setStage({ name: "compose" });
    setBrief("");
    setCount("auto");
  }

  async function handleDocIngested(doc: RagDoc, newChunks: DocChunk[]) {
    // Shared ("problem") docs persist in IndexedDB; per-expert docs are session-scoped
    // (their expert ids aren't stable across panels), so they live in memory only.
    if (doc.expertId == null) await addDocument(doc, newChunks);
    setDocs((d) => [...d, doc]);
    setChunks((c) => [...c, ...newChunks]);
  }

  async function handleRemoveDoc(docId: string) {
    await deleteDocument(docId); // no-op for in-memory expert docs not in IndexedDB
    setDocs((d) => d.filter((doc) => doc.id !== docId));
    setChunks((c) => c.filter((chunk) => chunk.docId !== docId));
  }

  // Clear shared docs only (IndexedDB + memory), leaving any per-expert docs in place.
  async function handleClearCorpus() {
    await clearCorpus();
    setDocs((d) => d.filter((doc) => doc.expertId != null));
    setChunks((c) => c.filter((chunk) => chunk.expertId != null));
  }

  // Drop all per-expert (session-scoped) docs — called when a new panel is proposed.
  function clearExpertScopedCorpus() {
    setDocs((d) => d.filter((doc) => doc.expertId == null));
    setChunks((c) => c.filter((chunk) => chunk.expertId == null));
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-white">symvene</h1>
        <button onClick={reset} className="text-xs text-neutral-500 hover:text-neutral-300">
          forget key
        </button>
      </header>

      {stage.name === "compose" && (
        <div className="space-y-4">
          <p className="text-sm text-neutral-400">
            Describe your question and the Facilitator will interview you, then assemble
            a panel of experts who debate it.
          </p>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={5}
            placeholder="What do you want the panel to debate? Describe your question or goal…"
            className="w-full rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 text-sm text-white outline-none focus:border-violet-500"
          />

          <SourcePanel
            voyageKey={voyageKey}
            docs={docs}
            onVoyageKey={(key) => {
              saveVoyageKey(key);
              setVoyageKey(key);
            }}
            onForgetVoyageKey={() => {
              clearVoyageKey();
              setVoyageKey(null);
            }}
            onDocIngested={handleDocIngested}
            onRemoveDoc={handleRemoveDoc}
            onClear={handleClearCorpus}
          />

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-neutral-400">Experts:</label>
            <select
              value={count}
              onChange={(e) =>
                setCount(e.target.value === "auto" ? "auto" : Number(e.target.value))
              }
              className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
            >
              <option value="auto">Let the Facilitator decide ({DEFAULT_EXPERTS})</option>
              {COUNT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <button
              onClick={() =>
                setStage({
                  name: "facilitate",
                  brief: brief.trim(),
                  expertCount: count === "auto" ? null : count,
                })
              }
              disabled={!brief.trim()}
              className="ml-auto rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40"
            >
              Convene the panel
            </button>
          </div>
        </div>
      )}

      {stage.name !== "compose" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Brief
            </div>
            <p className="mt-1 text-sm text-neutral-200">{stage.brief}</p>
            {docs.length > 0 && (
              <div className="mt-2 text-xs text-neutral-500">
                Source material: {docs.length} doc{docs.length === 1 ? "" : "s"}
              </div>
            )}
            {stage.name === "roundtable" && (
              <div className="mt-2 text-xs text-neutral-500">
                Panel: {stage.experts.map((e) => e.displayName).join(", ")}
              </div>
            )}
          </div>

          {stage.name === "facilitate" && (
            <FacilitatorView
              apiKey={apiKey}
              brief={stage.brief}
              expertCount={stage.expertCount}
              voyageKey={voyageKey}
              expertDocs={docs.filter((d) => d.expertId != null)}
              onPanelReady={(experts) =>
                setStage({ name: "roundtable", brief: stage.brief, experts })
              }
              onBack={() => setStage({ name: "compose" })}
              onExpertDocIngested={handleDocIngested}
              onRemoveDoc={handleRemoveDoc}
              onResetExpertDocs={clearExpertScopedCorpus}
            />
          )}

          {stage.name === "roundtable" && (
            <>
              <RoundtableView
                apiKey={apiKey}
                experts={stage.experts}
                brief={stage.brief}
                voyageKey={voyageKey}
                chunks={chunks}
              />
              <button
                onClick={() => setStage({ name: "compose" })}
                className="text-xs text-neutral-500 hover:text-neutral-300"
              >
                ← new brief
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
