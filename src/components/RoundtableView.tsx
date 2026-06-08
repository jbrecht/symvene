import { useRef, useState } from "react";
import { makeClient } from "../engine/client";
import { runRoundtable, ROUND_TITLES } from "../engine/roundtable";
import { runSynthesis } from "../engine/synthesizer";
import { retrieve } from "../engine/rag";
import { formatSources, scopedChunks } from "../engine/retrieval";
import type { DocChunk } from "../engine/retrieval";
import type { Expert, ExpertResponse } from "../engine/types";

type RunState = {
  rounds: ExpertResponse[][];
  synthesis: string;
  status: "idle" | "retrieving" | "running" | "synthesizing" | "done" | "error";
  error: string;
  retrievedCount: number;
  sourcesNote: string; // non-fatal warning if retrieval failed
};

const INITIAL: RunState = {
  rounds: [],
  synthesis: "",
  status: "idle",
  error: "",
  retrievedCount: 0,
  sourcesNote: "",
};

export function RoundtableView({
  apiKey,
  experts,
  brief,
  voyageKey,
  chunks,
}: {
  apiKey: string;
  experts: Expert[];
  brief: string;
  voyageKey: string | null;
  chunks: DocChunk[];
}) {
  const [state, setState] = useState<RunState>(INITIAL);
  const started = useRef(false);

  const hasCorpus = !!voyageKey && chunks.length > 0;

  async function run() {
    if (started.current) return;
    started.current = true;
    setState({ ...INITIAL, status: "running" });

    try {
      const client = makeClient(apiKey);

      // Retrieve grounding material per expert: each draws from its own private docs plus
      // the shared corpus. One expert's retrieval failing leaves only that expert ungrounded.
      const sourcesByExpert: Record<string, string> = {};
      if (hasCorpus) {
        setState((s) => ({ ...s, status: "retrieving" }));
        let total = 0;
        let note = "";
        for (const expert of experts) {
          const scoped = scopedChunks(chunks, expert.id);
          if (scoped.length === 0) continue;
          try {
            const retrieved = await retrieve(voyageKey!, brief, scoped);
            sourcesByExpert[expert.id] = formatSources(retrieved);
            total += retrieved.length;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            note = `Some source retrieval failed (${msg}). Affected experts run without it.`;
          }
        }
        setState((s) => ({ ...s, status: "running", retrievedCount: total, sourcesNote: note }));
      }

      const session = await runRoundtable(
        client,
        brief,
        experts,
        {
          onTurnStart: (expert, round) => {
            setState((s) => {
              const rounds = s.rounds.map((r) => [...r]);
              while (rounds.length < round) rounds.push([]);
              rounds[round - 1].push({
                expertId: expert.id,
                displayName: expert.displayName,
                round,
                content: "",
              });
              return { ...s, rounds };
            });
          },
          onText: (_expert, round, delta) => {
            setState((s) => {
              const rounds = s.rounds.map((r) => [...r]);
              const turn = rounds[round - 1][rounds[round - 1].length - 1];
              rounds[round - 1][rounds[round - 1].length - 1] = {
                ...turn,
                content: turn.content + delta,
              };
              return { ...s, rounds };
            });
          },
        },
        { sourcesFor: (id) => sourcesByExpert[id] ?? "" }
      );

      setState((s) => ({ ...s, status: "synthesizing" }));
      await runSynthesis(client, session, {
        onText: (delta) => setState((s) => ({ ...s, synthesis: s.synthesis + delta })),
      });

      setState((s) => ({ ...s, status: "done" }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState((s) => ({ ...s, status: "error", error: message }));
      started.current = false;
    }
  }

  if (state.status === "idle") {
    return (
      <div className="space-y-2">
        <button
          onClick={run}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
        >
          Start roundtable
        </button>
        {hasCorpus && (
          <p className="text-xs text-neutral-500">
            Experts will be grounded in your {chunks.length} source chunk
            {chunks.length === 1 ? "" : "s"}.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {state.status === "retrieving" && (
        <p className="text-xs text-violet-400">Retrieving source material…</p>
      )}
      {state.retrievedCount > 0 && (
        <p className="text-xs text-emerald-400">
          Grounded the panel in {state.retrievedCount} source passage
          {state.retrievedCount === 1 ? "" : "s"}.
        </p>
      )}
      {state.sourcesNote && (
        <p className="rounded-lg border border-amber-900 bg-amber-950/30 p-2 text-xs text-amber-300">
          {state.sourcesNote}
        </p>
      )}

      {state.rounds.map((round, i) => (
        <section key={i}>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-violet-400">
            Round {i + 1} — {ROUND_TITLES[i] ?? ""}
          </h2>
          <div className="space-y-4">
            {round.map((turn, j) => (
              <article
                key={j}
                className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4"
              >
                <div className="text-sm font-semibold text-white">{turn.displayName}</div>
                <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-300">
                  {turn.content || <span className="text-neutral-600">…</span>}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      {(state.status === "synthesizing" || state.synthesis) && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-emerald-400">
            Synthesis
          </h2>
          <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4 whitespace-pre-wrap text-sm leading-relaxed text-neutral-200">
            {state.synthesis || <span className="text-neutral-600">…</span>}
          </div>
        </section>
      )}

      {state.status === "error" && (
        <p className="rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
          {state.error}
        </p>
      )}

      {state.status === "done" && <p className="text-xs text-neutral-500">Done.</p>}
    </div>
  );
}
