// Boundary-aware text chunking for embedding. Splits on paragraph boundaries and
// greedily packs them toward a target size, carrying a small overlap between chunks
// so context isn't lost at the seams. Oversized paragraphs are hard-windowed.

export interface ChunkOptions {
  maxChars?: number; // soft target for chunk size
  overlap?: number; // characters of trailing context carried into the next chunk
}

// Last `overlap` chars of `text`, trimmed to a word boundary so we don't slice a word.
function tail(text: string, overlap: number): string {
  if (overlap <= 0 || text.length <= overlap) return text.length <= overlap ? text : "";
  const slice = text.slice(text.length - overlap);
  const space = slice.indexOf(" ");
  return space === -1 ? slice : slice.slice(space + 1);
}

// Hard-split a single oversized block into windows with overlap.
function windowSplit(block: string, maxChars: number, overlap: number): string[] {
  const out: string[] = [];
  const step = Math.max(1, maxChars - overlap);
  for (let i = 0; i < block.length; i += step) {
    out.push(block.slice(i, i + maxChars));
    if (i + maxChars >= block.length) break;
  }
  return out;
}

export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const maxChars = options.maxChars ?? 1200;
  const overlap = options.overlap ?? 150;

  // Normalise line endings and collapse runs of blank lines into paragraph breaks.
  const normalized = text.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!normalized) return [];

  const blocks = normalized
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    const trimmed = current.trim();
    if (trimmed) chunks.push(trimmed);
    current = "";
  };

  for (const block of blocks) {
    // A single block bigger than the target gets hard-windowed on its own.
    if (block.length > maxChars) {
      flush();
      for (const piece of windowSplit(block, maxChars, overlap)) chunks.push(piece);
      // Seed the next chunk with overlap from the last window piece.
      current = tail(chunks[chunks.length - 1] ?? "", overlap);
      continue;
    }

    if (current && current.length + block.length + 2 > maxChars) {
      const carry = tail(current, overlap);
      flush();
      current = carry;
    }

    current = current ? `${current}\n\n${block}` : block;
  }

  flush();
  return chunks;
}
