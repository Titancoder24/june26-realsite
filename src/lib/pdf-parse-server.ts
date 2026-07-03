/** Server-only pdf-parse loader — avoids index.js debug block that reads missing test files. */

export type PdfParseResult = {
  numpages: number;
  numrender: number;
  info: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
  text: string;
  version: string;
};

type PdfParseFn = (data: Buffer, options?: Record<string, unknown>) => Promise<PdfParseResult>;

let cached: PdfParseFn | null = null;

export async function parsePdfBuffer(buffer: Buffer): Promise<PdfParseResult> {
  if (!cached) {
    const mod = await import("pdf-parse/lib/pdf-parse.js");
    const fn = (mod as { default?: PdfParseFn }).default ?? (mod as unknown as PdfParseFn);
    if (typeof fn !== "function") {
      throw new Error("pdf-parse loader failed");
    }
    cached = fn;
  }
  return cached(buffer);
}
