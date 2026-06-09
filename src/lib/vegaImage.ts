// Render a Vega-Lite spec to a self-contained PNG data URL, for embedding in the exported
// Markdown (Vega-Lite has no native Markdown renderer the way Mermaid does, so a static image
// is what makes the chart show up in GitHub/VS Code/etc.). Browser-only. Returns null on failure.
export async function vegaSpecToPng(spec: string): Promise<string | null> {
  let container: HTMLDivElement | null = null;
  try {
    const parsed = JSON.parse(spec);
    const embed = (await import("vega-embed")).default;

    // Render offscreen.
    container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-99999px";
    container.style.top = "0";
    document.body.appendChild(container);

    const result = await embed(container, parsed, {
      actions: false,
      renderer: "canvas",
      theme: "dark",
    });
    const canvas = await result.view.toCanvas(2); // 2x for crispness
    const dataUrl = canvas.toDataURL("image/png");
    result.finalize();
    return dataUrl;
  } catch {
    return null;
  } finally {
    container?.remove();
  }
}
