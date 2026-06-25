import { NextResponse } from "next/server";
import { withAuth, jsonError } from "@/lib/api-utils";
import { ELEVENLABS_CONVAI_MODEL_OPTIONS } from "@/lib/elevenlabs-studio-voice";
import { elevenLabsVoicesService } from "@/services/elevenlabs-voices.service";

/** List ElevenLabs TTS + ConvAI models for studio configuration. */
export async function GET() {
  return withAuth(async () => {
    if (!elevenLabsVoicesService.isConfigured()) {
      return jsonError("ELEVENLABS_API_KEY is not configured", 503);
    }

    try {
      const ttsModels = await elevenLabsVoicesService.listTtsModels();
      return NextResponse.json({
        convaiModels: ELEVENLABS_CONVAI_MODEL_OPTIONS,
        ttsModels,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to list ElevenLabs models";
      return jsonError(message, 500);
    }
  });
}
