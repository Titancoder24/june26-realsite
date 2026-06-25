import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { samvaadService } from "@/services/samvaad.service";

/**
 * Proxies Samvaad runtime signed-URL requests so the browser never needs SARVAM_API_KEY.
 * Path mirrors apps.sarvam.ai/api/app-runtime/orgs/.../apps/.../url
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  try {
    if (!samvaadService.isApiConfigured()) {
      return NextResponse.json({ error: "SARVAM_API_KEY is not configured" }, { status: 503 });
    }

    const { path } = await ctx.params;
    const suffix = path.join("/");
    const search = new URL(req.url).search;
    const target = `${env.server.SARVAM_SAMVAAD_RUNTIME_BASE.replace(/\/$/, "")}/${suffix}${search}`;

    const signed = await samvaadService.fetchSignedUrl(target);
    return NextResponse.json(signed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Samvaad proxy failed";
    const status = message.includes("401") ? 401 : message.includes("404") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
