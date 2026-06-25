/** Extract plain text from a PDF buffer (server-side only). */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  // pdf-parse is Node-only; dynamic import keeps it out of client bundles.
  const pdfParse = (await import("pdf-parse")).default as (
    data: Buffer,
  ) => Promise<{ text: string; numpages: number }>;

  const result = await pdfParse(buffer);
  const text = result.text?.replace(/\s+/g, " ").trim() ?? "";
  if (!text) {
    throw new Error("No readable text found in this PDF. Try a text-based brochure or paste the content manually.");
  }
  return text.slice(0, 120_000);
}

export async function extractAttachmentText(attachment: {
  name: string;
  mime?: string;
  text?: string;
  data_base64?: string;
}): Promise<string> {
  if (attachment.text?.trim()) {
    return attachment.text.trim().slice(0, 120_000);
  }

  if (!attachment.data_base64) return "";

  const buffer = Buffer.from(attachment.data_base64, "base64");
  const name = attachment.name.toLowerCase();
  const mime = attachment.mime?.toLowerCase() ?? "";

  if (mime === "application/pdf" || name.endsWith(".pdf")) {
    return extractPdfText(buffer);
  }

  if (
    mime.startsWith("text/")
    || name.endsWith(".txt")
    || name.endsWith(".md")
    || name.endsWith(".csv")
    || name.endsWith(".json")
  ) {
    return buffer.toString("utf-8").trim().slice(0, 120_000);
  }

  throw new Error(`Unsupported file type: ${attachment.name}. Use PDF or plain text for now.`);
}
