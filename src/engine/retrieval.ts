// Vector-store types and similarity search for client-side RAG. Pure and
// framework-agnostic: no network, no storage, no DOM. The embeddings themselves
// come from voyage.ts; persistence lives in lib/ragStore.ts.

// How a document entered the corpus. Drives the icon/label in the UI.
export type DocKind = "text" | "markdown" | "pdf" | "pasted";

// A source document the user added. The text itself lives in its chunks.
export interface RagDoc {
  id: string;
  name: string;
  kind: DocKind;
  addedAt: number; // epoch ms
  charCount: number;
  chunkCount: number;
}

// One embedded slice of a document.
export interface DocChunk {
  id: string; // `${docId}#${index}`
  docId: string;
  docName: string;
  index: number;
  text: string;
  embedding: Float32Array;
}

export interface RetrievedChunk {
  chunk: DocChunk;
  score: number; // cosine similarity in [-1, 1]
}

// Cosine similarity. Voyage embeddings are L2-normalised, so this is effectively
// a dot product — but we normalise anyway so the function is correct for any input.
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// Top-k chunks most similar to the query embedding. `minScore` drops weak matches
// so an off-topic corpus contributes nothing rather than noise.
export function search(
  queryEmbedding: Float32Array,
  chunks: DocChunk[],
  k: number,
  minScore = 0.2
): RetrievedChunk[] {
  const scored: RetrievedChunk[] = [];
  for (const chunk of chunks) {
    const score = cosineSimilarity(queryEmbedding, chunk.embedding);
    if (score >= minScore) scored.push({ chunk, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

// Render retrieved chunks into a prompt block the experts can ground their claims in.
// Returns "" when nothing was retrieved, so callers can simply check truthiness.
export function formatSources(retrieved: RetrievedChunk[]): string {
  if (retrieved.length === 0) return "";
  const blocks = retrieved.map((r, i) => {
    return `[Source ${i + 1} — ${r.chunk.docName}]\n${r.chunk.text.trim()}`;
  });
  return blocks.join("\n\n");
}
