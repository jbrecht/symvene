import Anthropic from "@anthropic-ai/sdk";

// The user's key never leaves the browser. We talk to the Anthropic API directly,
// which requires the explicit browser-access opt-in.
export function makeClient(apiKey: string): Anthropic {
  return new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });
}

// Cheap call used to verify a pasted key actually works before we let the user in.
export async function validateKey(apiKey: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const client = makeClient(apiKey);
    await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4,
      messages: [{ role: "user", content: "ping" }],
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
