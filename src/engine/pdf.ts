// Client-side PDF text extraction via pdfjs. Runs entirely in the browser — the PDF
// bytes never leave the machine. Scanned/image-only PDFs yield little or no text
// (there's no OCR); callers should surface that to the user.
import * as pdfjs from "pdfjs-dist";
// Vite resolves this to a hashed URL for the worker bundle.
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export async function extractPdfText(data: ArrayBuffer): Promise<string> {
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;
  const pages: string[] = [];

  try {
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");
      pages.push(text);
    }
  } finally {
    await loadingTask.destroy();
  }

  return pages.join("\n\n");
}
