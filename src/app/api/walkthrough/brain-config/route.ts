import { NextResponse } from "next/server";
import {
  GEMINI_BRAIN_MODEL,
  WALKTHROUGH_BRAIN_PROVIDERS,
} from "@/lib/walkthrough-brain-provider";
import {
  isGeminiNativeBrainAvailable,
  isVertexBrainAvailable,
} from "@/services/walkthrough-brain.service";

export async function GET() {
  return NextResponse.json({
    providers: WALKTHROUGH_BRAIN_PROVIDERS,
    geminiModel: GEMINI_BRAIN_MODEL,
    availability: {
      vertex: isVertexBrainAvailable(),
      googleAiStudio: isGeminiNativeBrainAvailable(),
    },
  });
}
