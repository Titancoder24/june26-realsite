import { NextResponse } from "next/server";
import { z } from "zod";
import { sarvamRealtimeService } from "@/services/sarvam-realtime.service";

const schema = z.object({
  sessionId: z.string().min(1),
  pcmBase64: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const result = sarvamRealtimeService.pushAudio(body.sessionId, body.pcmBase64);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to push realtime audio";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
