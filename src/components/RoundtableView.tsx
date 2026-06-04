import { useRef, useState } from "react";
import { makeClient } from "../engine/client";
import { runRoundtable, ROUND_TITLES } from "../engine/roundtable";
import { runSynthesis } from "../engine/synthesizer";
import type { Expert, ExpertResponse } from "../engine/types";

type RunState = {
  rounds: ExpertResponse[][];
  synthesis: string;
  status: "idle" | "running" | "synthesizing" | "done" | "error";
  error: string;
};

const INITIAL: RunState = { rounds: [], synthesis: "", status: "idle", error: "" };

export function RoundtableView({
  apiKey,
  experts,
  brief,
}: {
  apiKey: string;
  experts: Expert[];
  brief: string;
}) {
  const [state, setState] = useState<RunState>(INITIAL);
  const started = useRef(false);

  async function run() {
    if (started.current) return;
    started.current = true;
    setState({ ...INITIAL, status: "running" });

    try {
      const client = makeClient(apiKey);

      const session = await runRoundtable(client, brief, experts, {
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
      });

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
      <button
        onClick={run}
        className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
      >
        Start roundtable
      </button>
    );
  }

  return (
    <div className="space-y-8">
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

      {state.status === "done" && (
        <p className="text-xs text-neutral-500">Done.</p>
      )}
    </div>
  );
}
