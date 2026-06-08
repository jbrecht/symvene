import { useEffect, useRef, useState } from "react";
import type Anthropic from "@anthropic-ai/sdk";
import { makeClient } from "../engine/client";
import { facilitatorTurn, MIN_EXPERTS, MAX_EXPERTS } from "../engine/facilitator";
import { MODELS, type Expert } from "../engine/types";

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
  onPanelReady,
  onBack,
}: {
  apiKey: string;
  brief: string;
  expertCount: number | null;
  onPanelReady: (experts: Expert[]) => void;
  onBack: () => void;
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
    setLog((l) => [
      ...l,
      { speaker: "you", text: "(asked for a different panel)" },
    ]);
    setExperts([]);
    void runTurn();
  }

  function updateExpert(index: number, patch: Partial<Expert>) {
    setExperts((xs) => xs.map((x, i) => (i === index ? { ...x, ...patch } : x)));
  }

  function removeExpert(index: number) {
    setExperts((xs) => xs.filter((_, i) => i !== index));
  }

  function addExpert() {
    setExperts((xs) => [
      ...xs,
      {
        id: `expert-${xs.length + 1}`,
        displayName: "NEW EXPERT",
        model: MODELS.expert,
        systemPrompt: "",
      },
    ]);
  }

  const canStart =
    experts.length >= MIN_EXPERTS &&
    experts.length <= MAX_EXPERTS &&
    experts.every((e) => e.displayName.trim() && e.systemPrompt.trim());

  return (
    <div className="space-y-6">
      {/* Conversation transcript */}
      <div className="space-y-4">
        {log.map((entry, i) => (
          <div key={i}>
            <div
              className={`text-xs font-semibold uppercase tracking-widest ${
                entry.speaker === "facilitator"
                  ? "text-violet-400"
                  : "text-neutral-500"
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
        <div className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
              Proposed panel — review &amp; edit
            </h2>
            <span className="text-xs text-neutral-500">
              {experts.length} expert{experts.length === 1 ? "" : "s"} (
              {MIN_EXPERTS}–{MAX_EXPERTS})
            </span>
          </div>

          {experts.map((expert, i) => (
            <article
              key={i}
              className="space-y-2 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4"
            >
              <div className="flex items-center gap-2">
                <input
                  value={expert.displayName}
                  onChange={(e) =>
                    updateExpert(i, { displayName: e.target.value })
                  }
                  className="flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm font-semibold text-white outline-none focus:border-violet-500"
                />
                <button
                  onClick={() => removeExpert(i)}
                  disabled={experts.length <= MIN_EXPERTS}
                  className="rounded-lg px-2 py-1 text-xs text-neutral-500 hover:text-red-400 disabled:opacity-30"
                  title="Remove expert"
                >
                  remove
                </button>
              </div>
              <textarea
                value={expert.systemPrompt}
                onChange={(e) =>
                  updateExpert(i, { systemPrompt: e.target.value })
                }
                rows={5}
                placeholder="This expert's persona / system prompt…"
                className="w-full rounded-lg border border-neutral-800 bg-neutral-950 p-3 text-xs leading-relaxed text-neutral-300 outline-none focus:border-violet-500"
              />
            </article>
          ))}

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={addExpert}
              disabled={experts.length >= MAX_EXPERTS}
              className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:border-neutral-500 disabled:opacity-30"
            >
              + Add expert
            </button>
            <button
              onClick={regenerate}
              className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:border-neutral-500"
            >
              Regenerate panel
            </button>
            <button
              onClick={() => onPanelReady(experts)}
              disabled={!canStart}
              className="ml-auto rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
            >
              Start roundtable →
            </button>
          </div>
          {!canStart && (
            <p className="text-xs text-neutral-500">
              Each expert needs a name and a persona, and the panel must have{" "}
              {MIN_EXPERTS}–{MAX_EXPERTS} experts.
            </p>
          )}
        </div>
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
