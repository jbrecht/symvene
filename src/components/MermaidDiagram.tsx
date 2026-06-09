import { useEffect, useId, useState } from "react";

// Renders a Mermaid diagram. mermaid is lazy-imported so its weight only loads when a debate
// actually produces a diagram. A bad spec degrades to an inline error, never a thrown render.
let initialized = false;

export function MermaidDiagram({ spec }: { spec: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const rawId = useId();
  const id = `mermaid-${rawId.replace(/[^a-zA-Z0-9-]/g, "")}`; // mermaid needs a valid DOM id

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        if (!initialized) {
          mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "dark" });
          initialized = true;
        }
        const { svg } = await mermaid.render(id, spec);
        if (!cancelled) {
          setSvg(svg);
          setError(false);
        }
      } catch {
        if (!cancelled) {
          setSvg(null);
          setError(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [spec, id]);

  if (error) {
    return <p className="text-xs text-amber-400">Couldn't render this diagram.</p>;
  }
  if (!svg) {
    return <p className="text-xs text-neutral-600">Rendering…</p>;
  }
  return (
    <div
      className="overflow-x-auto [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
