// Voyage AI embeddings client. Called directly from the browser — the Voyage API
// returns permissive CORS headers (access-control-allow-origin: *), so no backend
// is needed. The user's Voyage key, like the Anthropic key, never leaves the browser
// except to Voyage's own API.

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";

// Default general-purpose retrieval model (1024 dims). Change here to switch the
// whole app; voyage-4-lite is a cheaper option, voyage-4-large a higher-quality one.
export const VOYAGE_MODEL = "voyage-4";

// Voyage accepts up to 1000 inputs per request, but there's also a per-request token
// cap. Batching by count keeps us comfortably under it for typical chunk sizes.
const BATCH_SIZE = 96;

export type EmbedInputType = "document" | "query";

interface VoyageEmbedItem {
  embedding: number[];
  index: number;
}

interface VoyageEmbedResponse {
  data?: VoyageEmbedItem[];
  // Some docs show a flattened `embeddings` shape; handle it defensively.
  embeddings?: number[][];
}

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body?.detail || body?.error?.message || body?.error || JSON.stringify(body);
  } catch {
    return res.statusText;
  }
}

// Embed a batch of texts. `inputType` should be "document" when indexing the corpus
// and "query" when embedding a search query — Voyage uses it to specialise the vector.
export async function embed(
  apiKey: string,
  texts: string[],
  inputType: EmbedInputType,
  model: string = VOYAGE_MODEL
): Promise<Float32Array[]> {
  const out: Float32Array[] = [];

  for (let start = 0; start < texts.length; start += BATCH_SIZE) {
    const batch = texts.slice(start, start + BATCH_SIZE);
    const res = await fetch(VOYAGE_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, input: batch, input_type: inputType }),
    });

    if (!res.ok) {
      throw new Error(`Voyage API error (${res.status}): ${await readError(res)}`);
    }

    const json: VoyageEmbedResponse = await res.json();

    if (json.data) {
      // Sort by index so results line up with the input order regardless of API ordering.
      const sorted = [...json.data].sort((a, b) => a.index - b.index);
      for (const item of sorted) out.push(Float32Array.from(item.embedding));
    } else if (json.embeddings) {
      for (const vec of json.embeddings) out.push(Float32Array.from(vec));
    } else {
      throw new Error("Voyage API returned an unrecognised response shape");
    }
  }

  return out;
}

// Cheap call to verify a pasted Voyage key (and the configured model) actually work.
export async function validateVoyageKey(
  apiKey: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await embed(apiKey, ["ping"], "query");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
