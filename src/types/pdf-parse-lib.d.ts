declare module "pdf-parse/lib/pdf-parse.js" {
  import type { PdfParseResult } from "@/lib/pdf-parse-server";

  function pdfParse(data: Buffer, options?: Record<string, unknown>): Promise<PdfParseResult>;
  export default pdfParse;
}
