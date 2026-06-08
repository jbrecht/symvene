import { useRef, useState } from "react";
import { ingestDocument } from "../engine/rag";
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

// File + paste ingestion, scoped by `expertId` (omit for a shared/problem doc). Embeds via
// Voyage and hands the resulting doc + chunks to the caller, which owns persistence/state.
export function DocUploader({
  voyageKey,
  expertId,
  onIngested,
}: {
  voyageKey: string;
  expertId?: string;
  onIngested: (doc: RagDoc, chunks: DocChunk[]) => void | Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [paste, setPaste] = useState("");
  const [pasteName, setPasteName] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  async function ingest(name: string, kind: DocKind, text: string) {
    const result = await ingestDocument(voyageKey, { name, kind, text, expertId });
    await onIngested(result.doc, result.chunks);
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
    <div className="space-y-2">
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

      <div className="flex items-start gap-2">
        <textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          rows={2}
          placeholder="…or paste text"
          className="flex-1 rounded-lg border border-neutral-800 bg-neutral-950 p-2 text-xs text-white outline-none focus:border-violet-500"
        />
        <div className="flex flex-col gap-1">
          <input
            value={pasteName}
            onChange={(e) => setPasteName(e.target.value)}
            placeholder="Name"
            className="w-24 rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs text-white outline-none focus:border-violet-500"
          />
          <button
            onClick={addPaste}
            disabled={!!busy || !paste.trim()}
            className="rounded-lg border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:border-neutral-500 disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>

      {busy && <p className="text-xs text-violet-400">{busy}</p>}
      {errors.map((e, i) => (
        <p key={i} className="text-xs text-red-400 break-words">
          {e}
        </p>
      ))}
    </div>
  );
}
