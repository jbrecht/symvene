import { useState } from "react";
import { MIN_EXPERTS, MAX_EXPERTS } from "../engine/facilitator";
import { MODELS, type Expert } from "../engine/types";
import { DocUploader } from "./DocUploader";
import type { DocChunk, RagDoc } from "../engine/retrieval";

// The editable panel-review screen: tweak personas, see each expert's information needs, and
// attach per-expert documents. Shared by the Facilitator path (with Regenerate) and the
// saved-panel load path. Presentational/controlled — the owner holds the experts.
export function PanelReview({
  experts,
  onExpertsChange,
  voyageKey,
  expertDocs,
  onExpertDocIngested,
  onRemoveDoc,
  onStart,
  onRegenerate,
  onSavePanel,
  initiallySaved = false,
}: {
  experts: Expert[];
  onExpertsChange: (experts: Expert[]) => void;
  voyageKey: string | null;
  expertDocs: RagDoc[];
  onExpertDocIngested: (doc: RagDoc, chunks: DocChunk[]) => Promise<void>;
  onRemoveDoc: (docId: string) => void;
  onStart: () => void;
  onRegenerate?: () => void;
  onSavePanel?: (name: string) => void;
  initiallySaved?: boolean; // true when the panel was loaded from the store (already saved)
}) {
  const [panelName, setPanelName] = useState("");
  const [saved, setSaved] = useState(false);
  // Sticky: have we saved this panel at least once? A panel loaded from the store counts.
  const [hasSaved, setHasSaved] = useState(initiallySaved);
  const [confirmingStart, setConfirmingStart] = useState(false); // "save before running?" nag

  function updateExpert(index: number, patch: Partial<Expert>) {
    onExpertsChange(experts.map((x, i) => (i === index ? { ...x, ...patch } : x)));
  }

  function removeExpert(index: number) {
    onExpertsChange(experts.filter((_, i) => i !== index));
  }

  function addExpert() {
    onExpertsChange([
      ...experts,
      {
        id: `expert-${crypto.randomUUID().slice(0, 8)}`,
        displayName: "NEW EXPERT",
        model: MODELS.expert,
        systemPrompt: "",
        informationNeeds: [],
      },
    ]);
  }

  function save() {
    const name = panelName.trim();
    if (!name || !onSavePanel) return;
    onSavePanel(name);
    setHasSaved(true);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    // If the user hit "Start" on an unsaved panel and is saving in response to the nag,
    // proceed into the roundtable once it's saved.
    if (confirmingStart) {
      setConfirmingStart(false);
      onStart();
    }
  }

  // Guardrail: don't let an unsaved panel run off into a roundtable and get lost.
  function handleStart() {
    if (!onSavePanel || hasSaved) {
      onStart();
      return;
    }
    setConfirmingStart(true);
  }

  const canStart =
    experts.length >= MIN_EXPERTS &&
    experts.length <= MAX_EXPERTS &&
    experts.every((e) => e.displayName.trim() && e.systemPrompt.trim());

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
          Panel — review &amp; edit
        </h2>
        <span className="text-xs text-neutral-500">
          {experts.length} expert{experts.length === 1 ? "" : "s"} ({MIN_EXPERTS}–{MAX_EXPERTS})
        </span>
      </div>

      {experts.map((expert, i) => (
        <article
          key={expert.id}
          className="space-y-2 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4"
        >
          <div className="flex items-center gap-2">
            <input
              value={expert.displayName}
              onChange={(e) => updateExpert(i, { displayName: e.target.value })}
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
            onChange={(e) => updateExpert(i, { systemPrompt: e.target.value })}
            rows={5}
            placeholder="This expert's persona / system prompt…"
            className="w-full rounded-lg border border-neutral-800 bg-neutral-950 p-3 text-xs leading-relaxed text-neutral-300 outline-none focus:border-violet-500"
          />

          {expert.informationNeeds && expert.informationNeeds.length > 0 && (
            <div className="rounded-lg border border-neutral-800/80 bg-neutral-950/40 p-3">
              <div className="text-xs font-medium text-neutral-400">Wants documents on:</div>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-neutral-400">
                {expert.informationNeeds.map((need, n) => (
                  <li key={n}>{need}</li>
                ))}
              </ul>
            </div>
          )}

          {voyageKey ? (
            <div className="space-y-2 rounded-lg border border-neutral-800/80 p-3">
              <div className="text-xs font-medium text-neutral-400">
                {expert.displayName.trim() || "This expert"}'s documents
                <span className="text-neutral-600"> (private to this expert)</span>
              </div>
              <DocUploader
                voyageKey={voyageKey}
                expertId={expert.id}
                onIngested={onExpertDocIngested}
              />
              {expertDocs.filter((d) => d.expertId === expert.id).length > 0 && (
                <ul className="space-y-1">
                  {expertDocs
                    .filter((d) => d.expertId === expert.id)
                    .map((doc) => (
                      <li
                        key={doc.id}
                        className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-1.5"
                      >
                        <span className="min-w-0 flex-1 truncate text-xs text-neutral-300">
                          <span className="uppercase text-neutral-600">{doc.kind}</span>{" "}
                          {doc.name}{" "}
                          <span className="text-neutral-600">
                            · {doc.chunkCount} chunk{doc.chunkCount === 1 ? "" : "s"}
                          </span>
                        </span>
                        <button
                          onClick={() => onRemoveDoc(doc.id)}
                          className="ml-2 text-xs text-neutral-500 hover:text-red-400"
                        >
                          remove
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-xs text-neutral-600">
              Add a Voyage key under “Source material” to give this expert its own documents.
            </p>
          )}
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
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:border-neutral-500"
          >
            Regenerate panel
          </button>
        )}
        <button
          onClick={handleStart}
          disabled={!canStart}
          className="ml-auto rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
        >
          Start roundtable →
        </button>
      </div>

      {confirmingStart && (
        <div className="space-y-2 rounded-lg border border-amber-900 bg-amber-950/20 p-3">
          <p className="text-xs text-amber-200">
            This panel isn’t saved — it and its documents will be lost once you leave. Name and
            save it below to reuse it later, or run it anyway.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onStart}
              className="rounded-lg border border-amber-800 px-3 py-1.5 text-xs text-amber-200 hover:border-amber-600"
            >
              Start without saving
            </button>
            <button
              onClick={() => setConfirmingStart(false)}
              className="text-xs text-neutral-500 hover:text-neutral-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {onSavePanel && (
        <div className="flex items-center gap-2">
          <input
            value={panelName}
            onChange={(e) => setPanelName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="Name this panel to save it (with its documents)…"
            className={`flex-1 rounded-lg border bg-neutral-950 px-3 py-1.5 text-xs text-white outline-none focus:border-violet-500 ${
              confirmingStart ? "border-amber-700" : "border-neutral-800"
            }`}
          />
          <button
            onClick={save}
            disabled={!panelName.trim()}
            className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-500 disabled:opacity-40"
          >
            {saved ? "Saved ✓" : confirmingStart ? "Save & start" : "Save panel"}
          </button>
        </div>
      )}

      {!canStart && (
        <p className="text-xs text-neutral-500">
          Each expert needs a name and a persona, and the panel must have {MIN_EXPERTS}–
          {MAX_EXPERTS} experts.
        </p>
      )}
    </div>
  );
}
