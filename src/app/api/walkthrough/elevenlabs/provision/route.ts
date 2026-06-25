import { NextResponse } from "next/server";
import { withAuth, jsonError } from "@/lib/api-utils";
import { parseElevenLabsStudioVoiceConfig } from "@/lib/elevenlabs-studio-voice";
import { elevenLabsConvaiProvisionService } from "@/services/elevenlabs-convai-provision.service";
import { elevenLabsConvaiService } from "@/services/elevenlabs-convai.service";

/**
 * Provision ElevenLabs ConvAI agent + RAG webhook tool entirely via API.
 * Creates or updates "Realsite Property Tour" with Scribe realtime ASR + client nav tools.
 */
export async function POST(req: Request) {
  return withAuth(async (profile) => {
    if (!profile.organization_id) return jsonError("No organization", 400);
    if (!elevenLabsConvaiService.isConfigured()) {
      return jsonError("ELEVENLABS_API_KEY is not configured", 503);
    }

    try {
      const body = await req.json().catch(() => ({})) as { voice?: Record<string, unknown> };
      const studioVoice = body.voice
        ? parseElevenLabsStudioVoiceConfig({ elevenlabs_voice: body.voice })
        : undefined;
      const result = await elevenLabsConvaiProvisionService.provisionWalkthroughAgent(studioVoice);
      return NextResponse.json({
        ok: true,
        agentId: result.agentId,
        created: result.created,
        ragToolId: result.ragToolId,
        message: result.created
          ? "Created ElevenLabs walkthrough agent via API"
          : "Updated existing ElevenLabs walkthrough agent via API",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "ElevenLabs provision failed";
      return jsonError(message, 500);
    }
  });
}

export async function GET() {
  return withAuth(async () => {
    if (!elevenLabsConvaiService.isConfigured()) {
      return jsonError("ELEVENLABS_API_KEY is not configured", 503);
    }
    try {
      const agentId = await elevenLabsConvaiProvisionService.findWalkthroughAgentId();
      return NextResponse.json({
        configured: true,
        agentId,
        ragToolUrl: `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")}/api/walkthrough/elevenlabs/rag`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to check ElevenLabs agent";
      return jsonError(message, 500);
    }
  });
}
