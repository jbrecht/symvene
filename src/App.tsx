import { useState } from "react";
import { KeyEntry } from "./components/KeyEntry";
import { RoundtableView } from "./components/RoundtableView";
import { DEMO_PANEL } from "./engine/demoPanel";
import { loadKey, clearKey } from "./lib/storage";

function App() {
  const [apiKey, setApiKey] = useState<string | null>(() => loadKey());
  const [brief, setBrief] = useState("");
  const [activeBrief, setActiveBrief] = useState<string | null>(null);

  if (!apiKey) {
    return <KeyEntry onReady={setApiKey} />;
  }

  function reset() {
    clearKey();
    setApiKey(null);
    setActiveBrief(null);
    setBrief("");
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-white">symvene</h1>
        <button onClick={reset} className="text-xs text-neutral-500 hover:text-neutral-300">
          forget key
        </button>
      </header>

      {!activeBrief ? (
        <div className="space-y-4">
          <p className="text-sm text-neutral-400">
            Phase&nbsp;0 preview — running a fixed demo panel (Visionary / Skeptic /
            Pragmatist). The Facilitator that builds a custom panel for your question comes
            next.
          </p>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={5}
            placeholder="What do you want the panel to debate? Describe your question or goal…"
            className="w-full rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 text-sm text-white outline-none focus:border-violet-500"
          />
          <button
            onClick={() => setActiveBrief(brief.trim())}
            disabled={!brief.trim()}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40"
          >
            Convene the panel
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Brief
            </div>
            <p className="mt-1 text-sm text-neutral-200">{activeBrief}</p>
            <div className="mt-2 text-xs text-neutral-500">
              Panel: {DEMO_PANEL.map((e) => e.displayName).join(", ")}
            </div>
          </div>
          <RoundtableView apiKey={apiKey} experts={DEMO_PANEL} brief={activeBrief} />
          <button
            onClick={() => setActiveBrief(null)}
            className="text-xs text-neutral-500 hover:text-neutral-300"
          >
            ← new brief
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
