import { useRef, useState } from "react";
import { ingestDocument } from "../engine/rag";
import { validateVoyageKey } from "../engine/voyage";
import type { DocChunk, DocKind, RagDoc } from "../engine/retrieval";

const ACCEPT = ".txt,.md,.markdown,.pdf,text/plain,text/markdown,application/pdf";

function kindForFile(file: File): DocKind {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") return "pdf";
  if (name.endsWith(".md") || name.endsWith(".markdown")) return "markdown";
  return "text";
}

async function readFileText(file: File): Promise<string> {
  if (kindForFile(file) === "pdf") {
    // Lazy-load pdfjs so it (and its worker) stay out of the initial bundle.
    const { extractPdfText } = await import("../engine/pdf");
    return extractPdfText(await file.arrayBuffer());
  }
  return file.text();
}

// Optional, collapsible "source material" section on the compose screen. Handles the
// Voyage key gate and document ingestion; persistence + corpus state live in App.
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

  // Voyage key entry
  const [keyInput, setKeyInput] = useState("");
  const [keyStatus, setKeyStatus] = useState<"idle" | "checking" | "error">("idle");
  const [keyError, setKeyError] = useState("");

  // Ingestion
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [paste, setPaste] = useState("");
  const [pasteName, setPasteName] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

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

  async function ingest(name: string, kind: DocKind, text: string) {
    const result = await ingestDocument(voyageKey!, { name, kind, text });
    await onDocIngested(result.doc, result.chunks);
  }

  async function handleFiles(files: FileList) {
    setErrors([]);
    for (const file of Array.from(files)) {
      try {
        setBusy(`Reading ${file.name}…`);
        const text = await readFileText(file);
        setBusy(`Embedding ${file.name}…`);
        await ingest(file.name, kindForFile(file), text);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrors((e) => [...e, `${file.name}: ${msg}`]);
      }
    }
    setBusy(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function addPaste() {
    const text = paste.trim();
    if (!text) return;
    setErrors([]);
    try {
      setBusy("Embedding pasted text…");
      await ingest(pasteName.trim() || "Pasted text", "pasted", text);
      setPaste("");
      setPasteName("");
    } catch (err) {
      setErrors((e) => [...e, err instanceof Error ? err.message : String(err)]);
    }
    setBusy(null);
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
            (optional{docs.length ? ` — ${docs.length} doc${docs.length === 1 ? "" : "s"}` : ""})
          </span>
        </span>
        <span className="text-xs text-neutral-500">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-neutral-800 p-4">
          <p className="text-xs leading-relaxed text-neutral-500">
            Add documents to ground the experts in your own material. Text is embedded with
            Voyage AI (a separate key) and stored only in this browser; retrieval happens
            locally at debate time.
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
              {/* Add controls */}
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  accept={ACCEPT}
                  disabled={!!busy}
                  onChange={(e) => e.target.files && handleFiles(e.target.files)}
                  className="text-xs text-neutral-400 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-800 file:px-3 file:py-2 file:text-xs file:text-neutral-200 hover:file:bg-neutral-700"
                />
                <span className="text-xs text-neutral-600">.txt, .md, .pdf</span>
              </div>

              <div className="space-y-2">
                <input
                  value={pasteName}
                  onChange={(e) => setPasteName(e.target.value)}
                  placeholder="Name (optional)"
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-xs text-white outline-none focus:border-violet-500"
                />
                <textarea
                  value={paste}
                  onChange={(e) => setPaste(e.target.value)}
                  rows={3}
                  placeholder="…or paste text to add as a source"
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950 p-3 text-xs text-white outline-none focus:border-violet-500"
                />
                <button
                  onClick={addPaste}
                  disabled={!!busy || !paste.trim()}
                  className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-500 disabled:opacity-40"
                >
                  Add pasted text
                </button>
              </div>

              {busy && <p className="text-xs text-violet-400">{busy}</p>}
              {errors.map((e, i) => (
                <p key={i} className="text-xs text-red-400 break-words">
                  {e}
                </p>
              ))}

              {/* Doc list */}
              {docs.length > 0 && (
                <ul className="space-y-1">
                  {docs.map((doc) => (
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
                {docs.length > 0 && (
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
