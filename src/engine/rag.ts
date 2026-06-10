// RAG orchestration: turn a raw document into embedded chunks, and retrieve the
// most relevant chunks for a query. Framework-agnostic — the Voyage key is passed in
// by the caller; persistence and UI live elsewhere.
import { chunkText } from "./chunk";
import { embed, rerank } from "./voyage";
import { search } from "./retrieval";
import type { DocChunk, DocKind, RagDoc, RetrievedChunk } from "./retrieval";

export interface IngestInput {
  name: string;
  kind: DocKind;
  text: string;
  expertId?: string; // omit for a shared "problem" doc; set to scope to one expert
}

export interface IngestResult {
  doc: RagDoc;
  chunks: DocChunk[];
}

// How many chunks to inject into the debate as source material.
export const DEFAULT_TOP_K = 6;

// Over-retrieval factor: cosine search casts a net this many times wider than top-k,
// and the reranker picks the best k from it.
export const RERANK_OVERSAMPLE = 4;

// Chunk a document, embed every chunk as "document", and assemble the stored shape.
// Throws if the document has no extractable text (e.g. a scanned PDF).
export async function ingestDocument(
  voyageKey: string,
  input: IngestInput
): Promise<IngestResult> {
  const texts = chunkText(input.text);
  if (texts.length === 0) {
    throw new Error("No extractable text found in this document.");
  }

  const embeddings = await embed(voyageKey, texts, "document");
  const docId = crypto.randomUUID();
  const addedAt = Date.now();

  const chunks: DocChunk[] = texts.map((text, index) => ({
    id: `${docId}#${index}`,
    docId,
    docName: input.name,
    index,
    text,
    embedding: embeddings[index],
    expertId: input.expertId,
  }));

  const doc: RagDoc = {
    id: docId,
    name: input.name,
    kind: input.kind,
    addedAt,
    charCount: input.text.length,
    chunkCount: chunks.length,
    expertId: input.expertId,
  };

  return { doc, chunks };
}

// Retrieve the k chunks most relevant to the query: embed the query, over-retrieve
// candidates by cosine similarity, then rerank them down to k with Voyage's
// cross-encoder. Rerank failure degrades gracefully to the cosine order.
export async function retrieve(
  voyageKey: string,
  query: string,
  chunks: DocChunk[],
  k: number = DEFAULT_TOP_K
): Promise<RetrievedChunk[]> {
  if (chunks.length === 0 || !query.trim()) return [];
  const [queryEmbedding] = await embed(voyageKey, [query], "query");
  const candidates = search(queryEmbedding, chunks, k * RERANK_OVERSAMPLE);

  // With k or fewer candidates the reranker can't change membership, only order —
  // not worth a second API call.
  if (candidates.length <= k) return candidates;

  try {
    const ranked = await rerank(
      voyageKey,
      query,
      candidates.map((c) => c.chunk.text),
      k
    );
    return ranked.map((r) => ({
      chunk: candidates[r.index].chunk,
      score: r.relevanceScore,
    }));
  } catch (err) {
    console.warn("Voyage rerank failed; falling back to cosine order", err);
    return candidates.slice(0, k);
  }
}
