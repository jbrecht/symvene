import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// `[Source N]` as the experts are instructed to cite (see roundtable.ts).
const CITATION = /\[Source (\d+)\]/g;
const CITE_HREF = /^#cite-(\d+)$/;

// Renders model output (expert turns, synthesis) as Markdown instead of raw text.
// Styled with Tailwind's typography plugin, tuned compact for the dark theme.
// When `onCitation` is given, `[Source N]` mentions become clickable and report the
// cited source number; without it they stay plain text.
export function Markdown({
  children,
  onCitation,
}: {
  children: string;
  onCitation?: (n: number) => void;
}) {
  // Markdown-level rewrite: `[Source 3]` → `[Source 3](#cite-3)` so the citation
  // becomes a link node we can intercept below. Without onCitation it renders as-is.
  const source = onCitation ? children.replace(CITATION, "[Source $1](#cite-$1)") : children;

  return (
    <div className="prose prose-sm prose-invert max-w-none leading-relaxed prose-headings:font-semibold prose-headings:text-white prose-headings:mt-3 prose-headings:mb-1 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-strong:text-white prose-hr:my-3 prose-hr:border-neutral-800 prose-a:text-violet-400">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={
          !onCitation ? undefined : {
            a({ href, title, children: label }) {
              const cite = href?.match(CITE_HREF);
              if (!cite) {
                return (
                  <a href={href} title={title}>
                    {label}
                  </a>
                );
              }
              const n = Number(cite[1]);
              return (
                <a
                  href={href}
                  title="Show this source"
                  className="cursor-pointer no-underline decoration-dotted underline-offset-2 hover:underline"
                  onClick={(e) => {
                    e.preventDefault();
                    onCitation(n);
                  }}
                >
                  {label}
                </a>
              );
            },
          }
        }
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
