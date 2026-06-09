import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Renders model output (expert turns, synthesis) as Markdown instead of raw text.
// Styled with Tailwind's typography plugin, tuned compact for the dark theme.
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-sm prose-invert max-w-none leading-relaxed prose-headings:font-semibold prose-headings:text-white prose-headings:mt-3 prose-headings:mb-1 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-strong:text-white prose-hr:my-3 prose-hr:border-neutral-800 prose-a:text-violet-400">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
