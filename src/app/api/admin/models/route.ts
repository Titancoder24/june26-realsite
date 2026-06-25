import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { env } from "@/lib/env";

export async function GET() {
  return withAuth(async () => {
    return NextResponse.json({
      openrouter: {
        primary: env.server.OPENROUTER_PRIMARY_MODEL,
        planner: env.server.OPENROUTER_PLANNER_MODEL,
        image: env.server.OPENROUTER_IMAGE_MODEL,
        fallback: "google/gemini-3.5-flash",
        premium: "anthropic/claude-sonnet-4",
        lowCost: "google/gemini-3.5-flash",
      },
      elevenlabs: {
        voiceId: env.server.ELEVENLABS_VOICE_ID,
        ttsModel: env.server.ELEVENLABS_TTS_MODEL,
        sttModel: env.server.ELEVENLABS_STT_MODEL,
      },
    });
  }, "platform_admin");
}
