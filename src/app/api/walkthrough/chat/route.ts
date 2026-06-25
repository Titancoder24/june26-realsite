import { NextResponse } from "next/server";
import { walkthroughAgentService } from "@/services/walkthrough-agent.service";
import {
  isWalkthroughBrainProvider,
  type WalkthroughBrainProvider,
} from "@/lib/walkthrough-brain-provider";

export const runtime = "nodejs";

type ChatRequestBody = {
  organizationId?: string;
  propertyId?: string;
  experienceId?: string;
  query?: string;
  activeSceneId?: string;
  sessionId?: string;
  brainProvider?: string;
};

function parseBrainProvider(value: unknown): WalkthroughBrainProvider {
  if (typeof value === "string" && isWalkthroughBrainProvider(value)) return value;
  // Default to Gemini native (Google AI Studio — gemini-3.5-flash).
  return "google-ai-studio";
}

/**
 * Text chat endpoint for the property walkthrough.
 * Uses the Gemini 3.5 Flash brain (Google AI Studio) and returns JSON only —
 * no TTS — so the chat bubble feels instant.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ChatRequestBody;
    const organizationId = body.organizationId?.trim();
    const propertyId = body.propertyId?.trim();
    const experienceId = body.experienceId?.trim();
    const query = body.query?.trim();

    if (!organizationId || !propertyId || !experienceId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!query) {
      return NextResponse.json({ error: "query required" }, { status: 400 });
    }

    const result = await walkthroughAgentService.chat({
      organizationId,
      propertyId,
      experienceId,
      query,
      activeSceneId: body.activeSceneId?.trim() || undefined,
      sessionId: body.sessionId?.trim() || undefined,
      brainProvider: parseBrainProvider(body.brainProvider),
      voiceMode: false,
    });

    return NextResponse.json({
      answer: result.answer,
      command: result.command,
      confidenceScore: result.confidenceScore,
      suggestedFollowups: result.suggestedFollowups,
      fallbackUsed: result.fallbackUsed,
      instantPath: result.instantPath ?? false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Chat failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
