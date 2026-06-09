import { useEffect, useRef, useState } from "react";

// Renders a Vega-Lite chart from a JSON spec string. vega-embed is lazy-imported so its
// (substantial) weight only loads when a debate actually produces a data chart. Parse or
// embed failures degrade to an inline error.
export function VegaChart({ spec }: { spec: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let result: { finalize: () => void } | null = null;
    (async () => {
      try {
        const parsed = JSON.parse(spec);
        const embed = (await import("vega-embed")).default;
        if (cancelled || !ref.current) return;
        result = await embed(ref.current, parsed, {
          actions: false,
          renderer: "svg",
          theme: "dark",
        });
        if (!cancelled) setError(false);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
      result?.finalize();
    };
  }, [spec]);

  if (error) {
    return <p className="text-xs text-amber-400">Couldn't render this chart.</p>;
  }
  return <div ref={ref} className="overflow-x-auto" />;
}
