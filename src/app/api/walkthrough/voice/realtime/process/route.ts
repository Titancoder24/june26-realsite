import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isWalkthroughVoiceProfile,
  parseViewerVoiceProfile,
} from "@/lib/walkthrough-voice-providers";
import { walkthroughVoiceService } from "@/services/walkthrough-voice.service";

function voiceContentType(provider: "sarvam" | "elevenlabs"): string {
  return provider === "sarvam" ? "audio/wav" : "audio/mpeg";
}

const schema = z.object({
  organizationId: z.string().min(1),
  propertyId: z.string().min(1),
  experienceId: z.string().min(1),
  transcript: z.string().min(1),
  sessionId: z.string().optional(),
  activeSceneId: z.string().optional(),
  voiceProfile: z.string().optional(),
  speechLanguageCode: z.string().optional(),
  chatLanguageCode: z.string().optional(),
});

/** Process a finalized Sarvam realtime utterance through the walkthrough voice LLM pipeline. */
export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const voiceProfile = body.voiceProfile && isWalkthroughVoiceProfile(body.voiceProfile)
      ? body.voiceProfile
      : parseViewerVoiceProfile(null);

    const result = await walkthroughVoiceService.processTextQuery({
      organizationId: body.organizationId,
      propertyId: body.propertyId,
      experienceId: body.experienceId,
      query: body.transcript.trim(),
      activeSceneId: body.activeSceneId,
      sessionId: body.sessionId,
      voiceProfile,
      speechLanguageCode: body.speechLanguageCode,
      chatLanguageCode: body.chatLanguageCode,
    });

    return new NextResponse(result.audioBuffer, {
      headers: {
        "Content-Type": voiceContentType(result.voiceProvider),
        "X-AI-Answer": encodeURIComponent(result.displayAnswer),
        "X-AI-Transcript": encodeURIComponent(body.transcript.trim()),
        "X-AI-Confidence": String(result.confidenceScore),
        "X-AI-Command": encodeURIComponent(JSON.stringify(result.command)),
        "X-AI-Speech-Language": result.speechLanguageCode,
        "X-AI-Chat-Language": result.chatLanguageCode,
        "X-AI-Voice-Profile": result.voiceProfile,
        "X-AI-Voice-Provider": result.voiceProvider,
        "X-AI-Realtime": "sarvam",
        ...(result.fastPath ? { "X-AI-Fast-Path": "1" } : {}),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Realtime voice processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
