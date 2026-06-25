import { NextResponse } from "next/server";
import { withAuth, jsonError } from "@/lib/api-utils";
import { elevenLabsVoicesService } from "@/services/elevenlabs-voices.service";

/** List ElevenLabs voices for walkthrough studio voice picker. */
export async function GET(req: Request) {
  return withAuth(async () => {
    if (!elevenLabsVoicesService.isConfigured()) {
      return jsonError("ELEVENLABS_API_KEY is not configured", 503);
    }

    const search = new URL(req.url).searchParams.get("search") ?? undefined;
    const language = new URL(req.url).searchParams.get("language") ?? undefined;
    const walkthroughCode = new URL(req.url).searchParams.get("walkthroughCode") ?? undefined;
    const catalogOnly = new URL(req.url).searchParams.get("catalog") === "1";

    try {
      if (catalogOnly) {
        const catalog = await elevenLabsVoicesService.listVoiceCatalog(walkthroughCode);
        return NextResponse.json({ voices: catalog });
      }

      const voices = await elevenLabsVoicesService.listVoices(search, language, walkthroughCode);
      return NextResponse.json({ voices });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to list ElevenLabs voices";
      return jsonError(message, 500);
    }
  });
}
