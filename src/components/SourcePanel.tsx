import { useState } from "react";
import { validateVoyageKey } from "../engine/voyage";
import { DocUploader } from "./DocUploader";
import type { DocChunk, RagDoc } from "../engine/retrieval";

// Collapsible "source material" section on the compose screen. Owns the Voyage key gate
// and the SHARED (problem) corpus; per-expert documents are handled on the panel cards.
// Persistence + corpus state live in App.
export function SourcePanel({
  voyageKey,
  docs,
  onVoyageKey,
  onForgetVoyageKey,
  onDocIngested,
  onRemoveDoc,
  onClear,
}: {
  voyageKey: string | null;
  docs: RagDoc[];
  onVoyageKey: (key: string) => void;
  onForgetVoyageKey: () => void;
  onDocIngested: (doc: RagDoc, chunks: DocChunk[]) => Promise<void>;
  onRemoveDoc: (docId: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [keyStatus, setKeyStatus] = useState<"idle" | "checking" | "error">("idle");
  const [keyError, setKeyError] = useState("");

  const sharedDocs = docs.filter((d) => d.expertId == null);

  async function submitKey() {
    const key = keyInput.trim();
    if (!key) return;
    setKeyStatus("checking");
    setKeyError("");
    const result = await validateVoyageKey(key);
    if (result.ok) {
      onVoyageKey(key);
      setKeyInput("");
      setKeyStatus("idle");
    } else {
      setKeyStatus("error");
      setKeyError(result.error);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm text-neutral-300">
          Source material{" "}
          <span className="text-neutral-500">
            (optional
            {sharedDocs.length ? ` — ${sharedDocs.length} doc${sharedDocs.length === 1 ? "" : "s"}` : ""}
            )
          </span>
        </span>
        <span className="text-xs text-neutral-500">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-neutral-800 p-4">
          <p className="text-xs leading-relaxed text-neutral-500">
            Shared documents that frame the problem — every expert can draw on them. (Each
            expert can also be given its own private documents on the next screen.) Text is
            embedded with Voyage AI (a separate key) and stored only in this browser;
            retrieval happens locally at debate time.
          </p>

          {!voyageKey ? (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-neutral-300">
                Voyage API key
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitKey()}
                  placeholder="pa-..."
                  className="flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                />
                <button
                  onClick={submitKey}
                  disabled={keyStatus === "checking" || !keyInput.trim()}
                  className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40"
                >
                  {keyStatus === "checking" ? "Verifying…" : "Add key"}
                </button>
              </div>
              {keyStatus === "error" && (
                <p className="text-xs text-red-400 break-words">{keyError}</p>
              )}
              <p className="text-xs text-neutral-500">
                Get one at{" "}
                <a
                  href="https://dashboard.voyageai.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-violet-400 underline"
                >
                  dashboard.voyageai.com
                </a>
                .
              </p>
            </div>
          ) : (
            <>
              <DocUploader voyageKey={voyageKey} onIngested={onDocIngested} />

              {sharedDocs.length > 0 && (
                <ul className="space-y-1">
                  {sharedDocs.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2"
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

              <div className="flex items-center gap-4 text-xs">
                {sharedDocs.length > 0 && (
                  <button onClick={onClear} className="text-neutral-500 hover:text-red-400">
                    Clear all
                  </button>
                )}
                <button
                  onClick={onForgetVoyageKey}
                  className="ml-auto text-neutral-600 hover:text-neutral-400"
                >
                  forget Voyage key
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
