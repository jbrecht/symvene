import { useState } from "react";
import { validateKey } from "../engine/client";
import { saveKey } from "../lib/storage";

export function KeyEntry({ onReady }: { onReady: (key: string) => void }) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "error">("idle");
  const [error, setError] = useState("");

  async function submit() {
    const key = value.trim();
    if (!key) return;
    setStatus("checking");
    setError("");
    const result = await validateKey(key);
    if (result.ok) {
      saveKey(key);
      onReady(key);
    } else {
      setStatus("error");
      setError(result.error);
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-semibold tracking-tight text-white">symvene</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Assemble a panel of AI experts and have them debate your question.
        </p>

        <div className="mt-8 rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
          <label className="block text-sm font-medium text-neutral-200">Anthropic API key</label>
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="sk-ant-..."
            className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
          />
          <button
            onClick={submit}
            disabled={status === "checking" || !value.trim()}
            className="mt-3 w-full rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40"
          >
            {status === "checking" ? "Verifying…" : "Continue"}
          </button>

          {status === "error" && (
            <p className="mt-3 text-sm text-red-400 break-words">{error}</p>
          )}

          <p className="mt-4 text-xs leading-relaxed text-neutral-500">
            Your key stays in this browser (localStorage) and is sent only to Anthropic.
            It never touches a symvene server — there isn't one. Get a key at{" "}
            <a
              href="https://console.anthropic.com"
              target="_blank"
              rel="noreferrer"
              className="text-violet-400 underline"
            >
              console.anthropic.com
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
