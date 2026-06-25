import { NextResponse } from "next/server";
import { z } from "zod";
import { sarvamRealtimeService } from "@/services/sarvam-realtime.service";
import { resolveIndianSpeechLanguage } from "@/lib/walkthrough-voice-providers";

const createSchema = z.object({
  speechLanguageCode: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    if (!sarvamRealtimeService.isConfigured()) {
      return NextResponse.json({ error: "Sarvam API key not configured" }, { status: 503 });
    }
    const body = createSchema.parse(await req.json().catch(() => ({})));
    const languageCode = resolveIndianSpeechLanguage(body.speechLanguageCode ?? "en-IN");
    const { sessionId } = await sarvamRealtimeService.createSession(languageCode);
    return NextResponse.json({ sessionId, provider: "sarvam-realtime" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start Sarvam realtime session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const sessionId = new URL(req.url).searchParams.get("sessionId");
    if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    sarvamRealtimeService.closeSession(sessionId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to close session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
