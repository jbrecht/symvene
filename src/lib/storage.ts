// The API key is stored only in the user's browser. It is never sent anywhere
// except directly to the Anthropic API.
const KEY_STORAGE = "symvene.anthropic_key";

export function loadKey(): string | null {
  try {
    return localStorage.getItem(KEY_STORAGE);
  } catch {
    return null;
  }
}

export function saveKey(key: string): void {
  try {
    localStorage.setItem(KEY_STORAGE, key);
  } catch {
    // ignore (private mode etc.) — key just won't persist
  }
}

export function clearKey(): void {
  try {
    localStorage.removeItem(KEY_STORAGE);
  } catch {
    // ignore
  }
}
