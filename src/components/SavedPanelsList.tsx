import type { SavedPanel } from "../lib/panelStore";

// Compact list of saved panels on the compose screen. "Use" loads a panel into the review
// screen (disabled until a brief is typed); "Delete" removes it.
export function SavedPanelsList({
  panels,
  canUse,
  onUse,
  onDelete,
}: {
  panels: SavedPanel[];
  canUse: boolean;
  onUse: (panel: SavedPanel) => void;
  onDelete: (id: string) => void;
}) {
  if (panels.length === 0) return null;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
        Saved panels
      </div>
      <ul className="mt-2 space-y-1">
        {panels.map((panel) => (
          <li
            key={panel.id}
            className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2"
          >
            <span className="min-w-0 flex-1 truncate text-sm text-neutral-200">
              {panel.name}{" "}
              <span className="text-xs text-neutral-500">
                · {panel.experts.length} expert{panel.experts.length === 1 ? "" : "s"}
                {panel.docs.length > 0
                  ? ` · ${panel.docs.length} doc${panel.docs.length === 1 ? "" : "s"}`
                  : ""}
              </span>
            </span>
            <div className="ml-2 flex items-center gap-2">
              <button
                onClick={() => onUse(panel)}
                disabled={!canUse}
                title={canUse ? undefined : "Type a brief first"}
                className="rounded-lg border border-neutral-700 px-3 py-1 text-xs text-neutral-200 hover:border-neutral-500 disabled:opacity-40"
              >
                Use
              </button>
              <button
                onClick={() => onDelete(panel.id)}
                className="text-xs text-neutral-500 hover:text-red-400"
              >
                delete
              </button>
            </div>
          </li>
        ))}
      </ul>
      {!canUse && (
        <p className="mt-2 text-xs text-neutral-600">Type a brief above to use a saved panel.</p>
      )}
    </div>
  );
}
