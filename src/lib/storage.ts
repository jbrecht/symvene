// API keys are stored only in the user's browser. They are never sent anywhere
// except directly to the API they belong to (Anthropic, or Voyage for embeddings).
const KEY_STORAGE = "symvene.anthropic_key";
const VOYAGE_KEY_STORAGE = "symvene.voyage_key";

function load(name: string): string | null {
  try {
    return localStorage.getItem(name);
  } catch {
    return null;
  }
}

function save(name: string, value: string): void {
  try {
    localStorage.setItem(name, value);
  } catch {
    // ignore (private mode etc.) — value just won't persist
  }
}

function clear(name: string): void {
  try {
    localStorage.removeItem(name);
  } catch {
    // ignore
  }
}

export const loadKey = () => load(KEY_STORAGE);
export const saveKey = (key: string) => save(KEY_STORAGE, key);
export const clearKey = () => clear(KEY_STORAGE);

// The Voyage key powers client-side RAG embeddings. Optional — only set when the
// user wants to add source material.
export const loadVoyageKey = () => load(VOYAGE_KEY_STORAGE);
export const saveVoyageKey = (key: string) => save(VOYAGE_KEY_STORAGE, key);
export const clearVoyageKey = () => clear(VOYAGE_KEY_STORAGE);
