// IndexedDB persistence for the RAG corpus, so uploaded documents and their
// embeddings survive page reloads. Browser-specific (like storage.ts); the pure
// retrieval logic stays in engine/. Float32Array embeddings are persisted directly
// via structured clone — no manual serialisation needed.
import { openDB } from "idb";
import type { DBSchema, IDBPDatabase } from "idb";
import type { DocChunk, RagDoc } from "../engine/retrieval";

interface RagDB extends DBSchema {
  docs: { key: string; value: RagDoc };
  chunks: { key: string; value: DocChunk; indexes: { docId: string } };
}

let dbPromise: Promise<IDBPDatabase<RagDB>> | null = null;

function db(): Promise<IDBPDatabase<RagDB>> {
  if (!dbPromise) {
    dbPromise = openDB<RagDB>("symvene-rag", 1, {
      upgrade(database) {
        database.createObjectStore("docs", { keyPath: "id" });
        const chunks = database.createObjectStore("chunks", { keyPath: "id" });
        chunks.createIndex("docId", "docId");
      },
    });
  }
  return dbPromise;
}

// Load the whole corpus into memory (docs sorted oldest-first, plus every chunk).
export async function loadCorpus(): Promise<{ docs: RagDoc[]; chunks: DocChunk[] }> {
  const d = await db();
  const [docs, chunks] = await Promise.all([d.getAll("docs"), d.getAll("chunks")]);
  docs.sort((a, b) => a.addedAt - b.addedAt);
  return { docs, chunks };
}

// Persist a document and all of its chunks atomically.
export async function addDocument(doc: RagDoc, chunks: DocChunk[]): Promise<void> {
  const d = await db();
  const tx = d.transaction(["docs", "chunks"], "readwrite");
  await tx.objectStore("docs").put(doc);
  const store = tx.objectStore("chunks");
  await Promise.all(chunks.map((chunk) => store.put(chunk)));
  await tx.done;
}

// Remove a document and its chunks.
export async function deleteDocument(docId: string): Promise<void> {
  const d = await db();
  const tx = d.transaction(["docs", "chunks"], "readwrite");
  await tx.objectStore("docs").delete(docId);
  const index = tx.objectStore("chunks").index("docId");
  let cursor = await index.openCursor(IDBKeyRange.only(docId));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function clearCorpus(): Promise<void> {
  const d = await db();
  const tx = d.transaction(["docs", "chunks"], "readwrite");
  await Promise.all([tx.objectStore("docs").clear(), tx.objectStore("chunks").clear()]);
  await tx.done;
}
