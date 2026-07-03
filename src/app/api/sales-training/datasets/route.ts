import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api-utils";
import { extractAttachmentText } from "@/lib/pdf-extract";
import { salesTrainingService } from "@/services/sales-training.service";

export const runtime = "nodejs";

const jsonSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  sourceType: z.enum(["text", "url"]).default("text"),
  content: z.string().optional(),
  url: z.string().url().optional(),
});

function isBlockedHost(hostname: string) {
  const host = hostname.toLowerCase();
  return host === "localhost"
    || host === "0.0.0.0"
    || host === "127.0.0.1"
    || host.startsWith("10.")
    || host.startsWith("192.168.")
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    || host.endsWith(".local");
}

function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120_000);
}

async function fetchUrlText(url: string) {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Only HTTP or HTTPS URLs are supported");
  if (isBlockedHost(parsed.hostname)) throw new Error("Private or local URLs are not allowed");
  const res = await fetch(parsed.toString(), {
    headers: { "User-Agent": "RealSite-SalesTraining/1.0" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error("Could not read that URL");
  const contentType = res.headers.get("content-type") ?? "";
  const body = await res.text();
  return contentType.includes("text/html") ? htmlToText(body) : body.replace(/\s+/g, " ").trim().slice(0, 120_000);
}

export async function GET() {
  return withAuth(async (profile) => {
    const datasets = await salesTrainingService.listDatasets(profile);
    return NextResponse.json({ datasets });
  }, "sales_agent");
}

export async function POST(req: Request) {
  return withAuth(async (profile) => {
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file") as File | null;
      const title = ((form.get("title") as string | null) ?? file?.name ?? "Training dataset").trim();
      if (!file) throw new Error("No file uploaded");
      const dataBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
      const text = await extractAttachmentText({
        name: file.name,
        mime: file.type,
        data_base64: dataBase64,
      });
      const dataset = await salesTrainingService.createDataset(profile, {
        title,
        sourceType: file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "file",
        textContent: text,
        fileName: file.name,
        mimeType: file.type,
      });
      return NextResponse.json({ dataset }, { status: 201 });
    }

    const body = jsonSchema.parse(await req.json());
    const text = body.sourceType === "url"
      ? await fetchUrlText(body.url ?? "")
      : body.content?.trim();
    if (!text) throw new Error("Dataset content is empty");
    const dataset = await salesTrainingService.createDataset(profile, {
      title: body.title ?? (body.sourceType === "url" ? body.url ?? "Website context" : "Pasted training context"),
      sourceType: body.sourceType,
      textContent: text,
      sourceUrl: body.url,
    });
    return NextResponse.json({ dataset }, { status: 201 });
  }, "sales_agent");
}
