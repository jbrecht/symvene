import { MermaidDiagram } from "./MermaidDiagram";
import { VegaChart } from "./VegaChart";
import type { Visualization } from "../engine/visualize";

// Renders a list of model-proposed visualizations, dispatching each to the right renderer.
export function Visuals({ items }: { items: Visualization[] }) {
  return (
    <div className="space-y-4">
      {items.map((v, i) => (
        <figure
          key={i}
          className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4"
        >
          {v.title && (
            <figcaption className="text-sm font-semibold text-white">{v.title}</figcaption>
          )}
          <div className="mt-3">
            {v.type === "mermaid" ? (
              <MermaidDiagram spec={v.spec} />
            ) : (
              <VegaChart spec={v.spec} />
            )}
          </div>
          {v.caption && (
            <figcaption className="mt-2 text-xs text-neutral-500">{v.caption}</figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}
