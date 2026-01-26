let katexLoaded = false;

async function loadKatex() {
  if (katexLoaded) return;
  if ((window as any).katex) {
    katexLoaded = true;
    return;
  }
  // Check if script is already present
  // In demo execution, it is present in index.html.
  // But for safety:
  await new Promise<void>((resolve, reject) => {
    // Assuming it's loaded via tag in index.html as per recent edits.
    // If not, we could inject it.
    if ((window as any).katex) {
      katexLoaded = true;
      resolve();
    } else {
      // If explicitly requested to load
      // But usually we assume environment has it or we load it.
      // Let's assume global katex is available.
      // If not, wait for it?
      const check = setInterval(() => {
        if ((window as any).katex) {
          clearInterval(check);
          katexLoaded = true;
          resolve();
        }
      }, 50);
      setTimeout(() => {
        clearInterval(check);
        if (!(window as any).katex) console.warn("Katex not found");
        resolve();
      }, 2000);
    }
  });
}

const cache = new Map<string, HTMLImageElement | null>();

/**
 * Returns a Promise that resolves to an HTMLImageElement containing the rendered LaTeX.
 */
export function getLatexImage(
  latex: string,
  fontSizePx: number,
  color: string
): Promise<HTMLImageElement | null> | HTMLImageElement | null {
  const key = `${latex}-${fontSizePx}-${color}`;
  if (cache.has(key)) {
    return cache.get(key)!;
  }

  // Return promise if not cached
  return loadAndRenderLatex(latex, fontSizePx, color).then((img) => {
    cache.set(key, img);
    return img;
  });
}

export function getCachedLatexImage(
  latex: string,
  fontSizePx: number,
  color: string
): HTMLImageElement | undefined {
  const key = `${latex}-${fontSizePx}-${color}`;
  const item = cache.get(key);
  if (item instanceof HTMLImageElement) return item;
  return undefined;
}

async function loadAndRenderLatex(
  latex: string,
  fontSizePx: number,
  color: string
): Promise<HTMLImageElement | null> {
  await loadKatex();
  const katex = (window as any).katex;
  if (!katex) return null;

  let html = "";
  try {
    html = katex.renderToString(latex, {
      output: "mathml",
      throwOnError: false,
      displayMode: true, // Use display mode for figures usually? Or inline? User said "equation", imply display.
    });
  } catch (e) {
    console.error("KaTeX error:", e);
    return null;
  }

  // Measure
  const measureDiv = document.createElement("div");
  measureDiv.style.position = "absolute";
  measureDiv.style.visibility = "hidden";
  measureDiv.style.display = "inline-block";
  measureDiv.style.width = "max-content";
  // Add katex css if needed for measurement context?
  // We assume document has styles.
  measureDiv.innerHTML = html;

  document.body.appendChild(measureDiv);
  // Apply font size to the math container
  // KaTeX usually scales with ems, so parent font size matters if we want pixels.
  // We can set style on the div.
  // Actually, KaTeX generates HTML with defined sizes.
  // If we set font-size on container, it scales.
  measureDiv.style.fontSize = `${fontSizePx}px`;

  const rect = measureDiv.getBoundingClientRect();
  const width = Math.ceil(rect.width) + 5; // Padding
  const height = Math.ceil(rect.height) + 20;
  document.body.removeChild(measureDiv);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" viewBox="0 0 ${width} ${height}">
        <style>
            .katex { font-size: ${fontSizePx}px; color: ${color}; }
            .katex-html { display: none; }
        </style>
        <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml" style="color: ${color}; display: inline-block; width: max-content; padding: 10px;">
                ${html}
            </div>
        </foreignObject>
    </svg>
    `;

  const img = new Image();
  const svg64 = btoa(unescape(encodeURIComponent(svg)));
  img.src = `data:image/svg+xml;base64,${svg64}`;

  return new Promise((resolve) => {
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
  });
}
