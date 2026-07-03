/** Shared PDF.js loader for brochure PDF + flipbook viewers. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PdfDocument = any;

let workerConfigured = false;

function withPdfTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), 12000);
    }),
  ]);
}

export async function loadBrochurePdf(fileUrl: string): Promise<PdfDocument> {
  const pdfjs = await import("pdfjs-dist");
  if (!workerConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    workerConfigured = true;
  }
  try {
    return await withPdfTimeout(
      pdfjs.getDocument({ url: fileUrl, withCredentials: false }).promise,
      "PDF preview timed out. Open the original PDF to confirm the file is reachable.",
    );
  } catch (err) {
    console.warn("PDF worker load failed, retrying without worker", err);
    return withPdfTimeout(
      pdfjs.getDocument({ url: fileUrl, disableWorker: true, withCredentials: false } as unknown as string).promise,
      "PDF preview timed out without worker. Check the storage URL and CORS settings.",
    );
  }
}

export async function renderPdfPageToCanvas(
  pdf: PdfDocument,
  pageNumber: number,
  scale: number,
  canvas: HTMLCanvasElement,
): Promise<{ width: number; height: number }> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  await page.render({ canvasContext: ctx, viewport }).promise;
  return { width: viewport.width, height: viewport.height };
}

export async function renderPdfPageToDataUrl(
  pdf: PdfDocument,
  pageNumber: number,
  scale = 1.5,
): Promise<string> {
  const canvas = document.createElement("canvas");
  await renderPdfPageToCanvas(pdf, pageNumber, scale, canvas);
  return canvas.toDataURL("image/jpeg", 0.92);
}
