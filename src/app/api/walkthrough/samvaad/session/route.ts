import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isWalkthroughVoiceProfile,
  resolveIndianSpeechLanguage,
} from "@/lib/walkthrough-voice-providers";
import { parseSamvaadViewerConfig } from "@/lib/sarvam-samvaad";
import {
  loadWalkthroughNavScenes,
  samvaadService,
} from "@/services/samvaad.service";

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
});

/** Bootstrap a Samvaad voice session with per-property RAG context in agent_variables. */
export async function POST(req: Request) {
  try {
    if (!samvaadService.isApiConfigured()) {
      return NextResponse.json({ error: "SARVAM_API_KEY is not configured" }, { status: 503 });
    }

    const body = schema.parse(await req.json());
    const samvaad = parseSamvaadViewerConfig(body.viewerConfig);
    if (!samvaad?.enabled) {
      return NextResponse.json(
        {
          error:
            "Samvaad is not configured. Set SARVAM_SAMVAAD_ORG_ID, SARVAM_SAMVAAD_WORKSPACE_ID, and SARVAM_SAMVAAD_APP_ID.",
        },
        { status: 503 },
      );
    }

    const voiceProfile = body.voiceProfile && isWalkthroughVoiceProfile(body.voiceProfile)
      ? body.voiceProfile
      : "indian-languages";
    if (voiceProfile !== "indian-languages") {
      return NextResponse.json({ error: "Samvaad is only used for Indian Languages voice profile" }, { status: 400 });
    }

    const scenes = await loadWalkthroughNavScenes(body.experienceId);
    const speechLanguageCode = resolveIndianSpeechLanguage(
      body.speechLanguageCode ?? "hi-IN",
    );

    const bundle = await samvaadService.buildSessionBundle({
      organizationId: body.organizationId,
      propertyId: body.propertyId,
      experienceId: body.experienceId,
      sessionId: body.sessionId,
      propertyName: body.propertyName,
      projectName: body.projectName,
      speechLanguageCode,
      activeSceneId: body.activeSceneId,
      scenes,
      samvaad,
    });

    return NextResponse.json({
      available: true,
      provider: "samvaad",
      ...bundle,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Samvaad session failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
