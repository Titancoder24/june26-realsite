import { NextResponse } from "next/server";
import { z } from "zod";
import { elevenLabsService } from "@/services/elevenlabs.service";

const schema = z.object({
  organizationId: z.string().optional(),
});

/** Single-use token for ElevenLabs Scribe v2 realtime (browser mic STT). */
export async function POST(req: Request) {
  try {
    if (!elevenLabsService.isConfigured()) {
      return NextResponse.json({ error: "ELEVENLABS_API_KEY is not configured" }, { status: 503 });
    }

    const body = schema.parse(await req.json().catch(() => ({})));
    const token = await elevenLabsService.createScribeRealtimeToken(body.organizationId);

    return NextResponse.json({
      token,
      modelId: "scribe_v2_realtime",
      provider: "elevenlabs-scribe",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scribe token failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
