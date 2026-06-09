import { useEffect, useRef, useState } from "react";
import type Anthropic from "@anthropic-ai/sdk";
import { makeClient } from "../engine/client";
import { facilitatorTurn } from "../engine/facilitator";
import type { Expert } from "../engine/types";
import { PanelReview } from "./PanelReview";
import type { DocChunk, RagDoc } from "../engine/retrieval";

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

  // The Anthropic message history drives the conversation; kept in a ref so async
  // turns always see the latest without re-rendering on every append.
  const messages = useRef<Anthropic.MessageParam[]>([]);
  const client = useRef<Anthropic | null>(null);
  const started = useRef(false);

  async function runTurn() {
    setStatus("thinking");
    setStreaming("");
    setError("");
    try {
      const result = await facilitatorTurn(
        client.current!,
        messages.current,
        expertCount,
        { onText: (delta) => setStreaming((s) => s + delta) }
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

  // Kick off the interview with the user's brief as the opening message.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    client.current = makeClient(apiKey);
    messages.current = [{ role: "user", content: brief }];
    setLog([{ speaker: "you", text: brief }]);
    void runTurn();
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
