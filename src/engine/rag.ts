// RAG orchestration: turn a raw document into embedded chunks, and retrieve the
// most relevant chunks for a query. Framework-agnostic — the Voyage key is passed in
// by the caller; persistence and UI live elsewhere.
import { chunkText } from "./chunk";
import { embed } from "./voyage";
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

// Embed the query and return the top-k most similar chunks from the corpus.
export async function retrieve(
  voyageKey: string,
  query: string,
  chunks: DocChunk[],
  k: number = DEFAULT_TOP_K
): Promise<RetrievedChunk[]> {
  if (chunks.length === 0 || !query.trim()) return [];
  const [queryEmbedding] = await embed(voyageKey, [query], "query");
  return search(queryEmbedding, chunks, k);
}
