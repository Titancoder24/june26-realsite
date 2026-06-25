import { NextResponse } from "next/server";
import {
  isWalkthroughVoiceProfile,
  walkthroughVoiceApiConfig,
} from "@/lib/walkthrough-voice-providers";
import { isWalkthroughBrainProvider } from "@/lib/walkthrough-brain-provider";
import { walkthroughVoiceService } from "@/services/walkthrough-voice.service";

function voiceContentType(provider: "sarvam" | "elevenlabs"): string {
  return provider === "sarvam" ? "audio/wav" : "audio/mpeg";
}

function parseVoiceProfile(value: unknown) {
  if (typeof value === "string" && isWalkthroughVoiceProfile(value)) return value;
  return undefined;
}

function parseBrainProvider(value: unknown) {
  if (typeof value === "string" && isWalkthroughBrainProvider(value)) return value;
  return undefined;
}

function voiceHeaders(
  result: {
    voiceProvider: "sarvam" | "elevenlabs";
    displayAnswer?: string;
    answer?: string;
    transcript?: string;
    confidenceScore?: number;
    command?: unknown;
    speechLanguageCode?: string;
    chatLanguageCode?: string;
    voiceProfile?: string;
    fastPath?: boolean;
  },
  extra: Record<string, string> = {},
): Record<string, string> {
  return {
    "Content-Type": voiceContentType(result.voiceProvider),
    ...extra,
    ...(result.fastPath ? { "X-AI-Fast-Path": "1" } : {}),
  };
}

/** Walkthrough voice: Vertex AI + Indian Languages AI (Sarvam) or Global Voice AI (ElevenLabs). */
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const audio = formData.get("audio") as Blob | null;
      const organizationId = formData.get("organizationId") as string;
      const propertyId = formData.get("propertyId") as string;
      const experienceId = formData.get("experienceId") as string;
      const activeSceneId = (formData.get("activeSceneId") as string) || undefined;
      const sessionId = (formData.get("sessionId") as string) || undefined;
      const voiceProfile = parseVoiceProfile(formData.get("voiceProfile"));
      const speechLanguageCode = (formData.get("speechLanguageCode") as string) || undefined;
      const chatLanguageCode = (formData.get("chatLanguageCode") as string) || undefined;
      const brainProvider = parseBrainProvider(formData.get("brainProvider"));

      if (!audio || !organizationId || !propertyId || !experienceId) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }

      const result = await walkthroughVoiceService.processAudioQuery({
        organizationId,
        propertyId,
        experienceId,
        audio,
        activeSceneId,
        sessionId,
        voiceProfile,
        speechLanguageCode,
        chatLanguageCode,
        brainProvider,
      });

      return new NextResponse(result.audioBuffer, {
        headers: voiceHeaders(result, {
          "X-AI-Answer": encodeURIComponent(result.displayAnswer),
          "X-AI-Transcript": encodeURIComponent(result.transcript ?? ""),
          "X-AI-Confidence": String(result.confidenceScore),
          "X-AI-Command": encodeURIComponent(JSON.stringify(result.command)),
          "X-AI-Speech-Language": result.speechLanguageCode,
          "X-AI-Chat-Language": result.chatLanguageCode,
          "X-AI-Voice-Profile": result.voiceProfile,
          "X-AI-Voice-Provider": result.voiceProvider,
        }),
      });
    }

    const body = await req.json();
    const {
      organizationId,
      propertyId,
      experienceId,
      query,
      activeSceneId,
      sessionId,
      speakOnly,
      greeting,
      propertyName,
      projectName,
      voiceProfile: rawProfile,
      speechLanguageCode,
      chatLanguageCode,
      brainProvider: rawBrainProvider,
    } = body as {
      organizationId: string;
      propertyId: string;
      experienceId: string;
      query?: string;
      activeSceneId?: string;
      sessionId?: string;
      speakOnly?: boolean;
      greeting?: boolean;
      text?: string;
      propertyName?: string;
      projectName?: string;
      voiceProfile?: string;
      speechLanguageCode?: string;
      chatLanguageCode?: string;
      brainProvider?: string;
    };

    const voiceProfile = parseVoiceProfile(rawProfile);
    const brainProvider = parseBrainProvider(rawBrainProvider);

    if (!organizationId || !propertyId || !experienceId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (greeting) {
      const result = await walkthroughVoiceService.generateGreeting({
        organizationId,
        propertyId,
        experienceId,
        sessionId,
        activeSceneId,
        voiceProfile,
        speechLanguageCode,
        chatLanguageCode,
        propertyName,
        projectName,
      });
      return new NextResponse(result.audioBuffer, {
        headers: {
          "Content-Type": voiceContentType(result.voiceProvider),
          "X-AI-Answer": encodeURIComponent(result.displayAnswer),
          "X-AI-Confidence": String(result.confidenceScore),
          "X-AI-Command": encodeURIComponent(JSON.stringify(result.command)),
          "X-AI-Speech-Language": result.speechLanguageCode,
          "X-AI-Chat-Language": result.chatLanguageCode,
          "X-AI-Voice-Profile": result.voiceProfile,
          "X-AI-Voice-Provider": result.voiceProvider,
        },
      });
    }

    if (speakOnly && body.text?.trim()) {
      const spoken = await walkthroughVoiceService.speakOnly({
        text: body.text.trim(),
        organizationId,
        voiceProfile,
        speechLanguageCode,
        chatLanguageCode,
      });
      return new NextResponse(spoken.audioBuffer, {
        headers: {
          "Content-Type": voiceContentType(spoken.voiceProvider),
          "X-AI-Answer": encodeURIComponent(body.text.trim()),
          "X-AI-Speech-Language": speechLanguageCode ?? "",
          "X-AI-Chat-Language": chatLanguageCode ?? "",
          "X-AI-Voice-Provider": spoken.voiceProvider,
        },
      });
    }

    if (!query?.trim()) {
      return NextResponse.json({ error: "query required" }, { status: 400 });
    }

    const result = await walkthroughVoiceService.processTextQuery({
      organizationId,
      propertyId,
      experienceId,
      query: query.trim(),
      activeSceneId,
      sessionId,
      voiceProfile,
      speechLanguageCode,
      chatLanguageCode,
      brainProvider,
    });

    return new NextResponse(result.audioBuffer, {
      headers: voiceHeaders(result, {
        "X-AI-Answer": encodeURIComponent(result.displayAnswer),
        "X-AI-Confidence": String(result.confidenceScore),
        "X-AI-Command": encodeURIComponent(JSON.stringify(result.command)),
        "X-AI-Speech-Language": result.speechLanguageCode,
        "X-AI-Chat-Language": result.chatLanguageCode,
        "X-AI-Voice-Profile": result.voiceProfile,
        ...(brainProvider ? { "X-AI-Brain-Provider": brainProvider } : {}),
        "X-AI-Voice-Provider": result.voiceProvider,
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Voice pipeline failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ...walkthroughVoiceApiConfig(),
    sarvamRealtime: {
      enabled: Boolean(process.env.SARVAM_API_KEY?.trim()),
      sttModel: "saaras:v3",
      ttsModel: "bulbul:v3",
      mcpServer: "sarvam-mcp",
      routes: {
        session: "/api/walkthrough/voice/realtime/session",
        audio: "/api/walkthrough/voice/realtime/audio",
        process: "/api/walkthrough/voice/realtime/process",
      },
    },
  });
}
