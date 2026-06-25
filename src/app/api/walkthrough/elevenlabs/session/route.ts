import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isWalkthroughVoiceProfile,
} from "@/lib/walkthrough-voice-providers";
import {
  parseElevenLabsConvaiViewerConfig,
} from "@/lib/elevenlabs-convai";
import {
  elevenLabsConvaiService,
  loadWalkthroughNavScenes,
} from "@/services/elevenlabs-convai.service";

const schema = z.object({
  organizationId: z.string().min(1),
  propertyId: z.string().min(1),
  experienceId: z.string().min(1),
  sessionId: z.string().optional(),
  propertyName: z.string().min(1),
  projectName: z.string().optional(),
  activeSceneId: z.string().optional(),
  speechLanguageCode: z.string().optional(),
  voiceProfile: z.string().optional(),
  viewerConfig: z.record(z.unknown()).optional(),
  skipGreeting: z.boolean().optional(),
});

/** Bootstrap ElevenLabs ConvAI WebRTC session with property RAG context. */
export async function POST(req: Request) {
  try {
    if (!elevenLabsConvaiService.isConfigured()) {
      return NextResponse.json({ error: "ELEVENLABS_API_KEY is not configured" }, { status: 503 });
    }

    const body = schema.parse(await req.json());
    const convai = parseElevenLabsConvaiViewerConfig(body.viewerConfig);
    if (!convai?.enabled) {
      return NextResponse.json(
        {
          error:
            "ElevenLabs ConvAI is not configured. Set ELEVENLABS_AGENT_ID or create an agent in ElevenLabs.",
        },
        { status: 503 },
      );
    }

    const voiceProfile = body.voiceProfile && isWalkthroughVoiceProfile(body.voiceProfile)
      ? body.voiceProfile
      : "global-voice";
    if (voiceProfile !== "global-voice") {
      return NextResponse.json(
        { error: "ElevenLabs ConvAI is only used for Global Voice profile" },
        { status: 400 },
      );
    }

    const scenes = await loadWalkthroughNavScenes(body.experienceId);
    const speechLanguageCode = body.speechLanguageCode ?? "en";

    const bundle = await elevenLabsConvaiService.buildSessionBundle({
      organizationId: body.organizationId,
      propertyId: body.propertyId,
      experienceId: body.experienceId,
      sessionId: body.sessionId,
      propertyName: body.propertyName,
      projectName: body.projectName,
      speechLanguageCode,
      activeSceneId: body.activeSceneId,
      scenes,
      convai,
      viewerConfig: body.viewerConfig,
      skipGreeting: body.skipGreeting ?? false,
    });

    return NextResponse.json({
      available: true,
      provider: "elevenlabs-convai",
      ...bundle,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "ElevenLabs session failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
