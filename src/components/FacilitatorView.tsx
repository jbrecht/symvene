import { useEffect, useRef, useState } from "react";
import type Anthropic from "@anthropic-ai/sdk";
import { makeClient } from "../engine/client";
import { facilitatorTurn } from "../engine/facilitator";
import { retrieve } from "../engine/rag";
import { formatSources } from "../engine/retrieval";
import type { Expert } from "../engine/types";
import { PanelReview } from "./PanelReview";
import type { DocChunk, RagDoc } from "../engine/retrieval";

// How many brief-relevant passages the Facilitator gets to read before designing the panel.
const FACILITATOR_TOP_K = 8;

type LogEntry = { speaker: "facilitator" | "you"; text: string };

type Status =
  | "thinking" // waiting on a facilitator turn
  | "asking" // facilitator asked a question; awaiting the user
  | "review" // a panel has been proposed; user is editing it
  | "error";

export function FacilitatorView({
  apiKey,
  brief,
  expertCount,
  voyageKey,
  expertDocs,
  sharedChunks,
  onPanelReady,
  onBack,
  onExpertDocIngested,
  onRemoveDoc,
  onResetExpertDocs,
  onSavePanel,
}: {
  apiKey: string;
  brief: string;
  expertCount: number | null;
  voyageKey: string | null;
  expertDocs: RagDoc[];
  sharedChunks: DocChunk[]; // shared-scope corpus the Facilitator may read for panel design
  onPanelReady: (experts: Expert[]) => void;
  onBack: () => void;
  onExpertDocIngested: (doc: RagDoc, chunks: DocChunk[]) => Promise<void>;
  onRemoveDoc: (docId: string) => void;
  onResetExpertDocs: () => void;
  onSavePanel: (name: string, experts: Expert[]) => void;
}) {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [streaming, setStreaming] = useState("");
  const [status, setStatus] = useState<Status>("thinking");
  const [experts, setExperts] = useState<Expert[]>([]);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");

  // Number of shared docs the Facilitator read before designing the panel (0 = none).
  const [readDocCount, setReadDocCount] = useState(0);

  // The Anthropic message history drives the conversation; kept in a ref so async
  // turns always see the latest without re-rendering on every append.
  const messages = useRef<Anthropic.MessageParam[]>([]);
  const client = useRef<Anthropic | null>(null);
  const corpusContext = useRef<string | undefined>(undefined);
  const started = useRef(false);

  // Give the Facilitator a view of the shared corpus: the doc names plus the passages
  // most relevant to the brief. Non-fatal — on retrieval failure it falls back to doc
  // names alone, and with no corpus at all it stays undefined.
  async function buildCorpusContext(): Promise<void> {
    if (!voyageKey || sharedChunks.length === 0) return;
    const docNames = [...new Set(sharedChunks.map((c) => c.docName))];
    let context = `Documents provided: ${docNames.join(", ")}.`;
    try {
      const retrieved = await retrieve(voyageKey, brief, sharedChunks, FACILITATOR_TOP_K);
      const sources = formatSources(retrieved);
      if (sources) context += `\n\n${sources}`;
    } catch {
      // doc names alone are still useful context
    }
    corpusContext.current = context;
    setReadDocCount(docNames.length);
  }

  async function runTurn() {
    setStatus("thinking");
    setStreaming("");
    setError("");
    try {
      const result = await facilitatorTurn(
        client.current!,
        messages.current,
        expertCount,
        { onText: (delta) => setStreaming((s) => s + delta) },
        corpusContext.current
      );
      messages.current.push(result.assistant);

      if (result.type === "panel") {
        // The panel came back as a tool_use; append its tool_result so the history stays
        // valid for later turns (e.g. "Regenerate panel").
        messages.current.push(result.toolResult);
        // A fresh panel means new expert ids — drop any docs attached to a prior panel
        // so stale (or id-colliding) experts can't inherit them.
        onResetExpertDocs();
        setStreaming("");
        setExperts(result.experts);
        setStatus("review");
      } else {
        setLog((l) => [...l, { speaker: "facilitator", text: result.text }]);
        setStreaming("");
        setStatus("asking");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  // Kick off the interview with the user's brief as the opening message, after letting
  // the Facilitator read the shared corpus.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    client.current = makeClient(apiKey);
    messages.current = [{ role: "user", content: brief }];
    setLog([{ speaker: "you", text: brief }]);
    void buildCorpusContext().then(runTurn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function sendAnswer() {
    const text = answer.trim();
    if (!text) return;
    messages.current.push({ role: "user", content: text });
    setLog((l) => [...l, { speaker: "you", text }]);
    setAnswer("");
    void runTurn();
  }

  function regenerate() {
    messages.current.push({
      role: "user",
      content:
        "Propose a different panel — different experts, different angles of disagreement.",
    });
    setLog((l) => [...l, { speaker: "you", text: "(asked for a different panel)" }]);
    setExperts([]);
    void runTurn();
  }

  return (
    <div className="space-y-6">
      {readDocCount > 0 && (
        <p className="text-xs text-emerald-400">
          The Facilitator has read your {readDocCount} source document
          {readDocCount === 1 ? "" : "s"} and will design the panel around them.
        </p>
      )}

      {/* Conversation transcript */}
      <div className="space-y-4">
        {log.map((entry, i) => (
          <div key={i}>
            <div
              className={`text-xs font-semibold uppercase tracking-widest ${
                entry.speaker === "facilitator" ? "text-violet-400" : "text-neutral-500"
              }`}
            >
              {entry.speaker === "facilitator" ? "Facilitator" : "You"}
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-neutral-200">
              {entry.text}
            </p>
          </div>
        ))}

        {status === "thinking" && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-violet-400">
              Facilitator
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-neutral-200">
              {streaming || <span className="text-neutral-600">thinking…</span>}
            </p>
          </div>
        )}
      </div>

      {/* Answer box while the facilitator is interviewing */}
      {status === "asking" && (
        <div className="space-y-2">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendAnswer();
            }}
            rows={3}
            placeholder="Your answer… (⌘/Ctrl+Enter to send)"
            className="w-full rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 text-sm text-white outline-none focus:border-violet-500"
          />
          <button
            onClick={sendAnswer}
            disabled={!answer.trim()}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40"
          >
            Send
          </button>
        </div>
      )}

      {/* Editable panel review */}
      {status === "review" && (
        <PanelReview
          experts={experts}
          onExpertsChange={setExperts}
          voyageKey={voyageKey}
          expertDocs={expertDocs}
          onExpertDocIngested={onExpertDocIngested}
          onRemoveDoc={onRemoveDoc}
          onStart={() => onPanelReady(experts)}
          onRegenerate={regenerate}
          onSavePanel={(name) => onSavePanel(name, experts)}
        />
      )}

      {status === "error" && (
        <div className="space-y-2">
          <p className="rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
            {error}
          </p>
          <button
            onClick={() => void runTurn()}
            className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:border-neutral-500"
          >
            Retry
          </button>
        </div>
      )}

      <button
        onClick={onBack}
        className="text-xs text-neutral-500 hover:text-neutral-300"
      >
        ← new brief
      </button>
    </div>
  );
}
