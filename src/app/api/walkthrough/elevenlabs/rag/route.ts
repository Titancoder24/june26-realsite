import { NextResponse } from "next/server";
import { z } from "zod";
import { elevenLabsConvaiService } from "@/services/elevenlabs-convai.service";

const schema = z.object({
  organizationId: z.string().min(1),
  propertyId: z.string().min(1),
  query: z.string().min(1),
  activeSceneId: z.string().optional(),
  toolSecret: z.string().optional(),
});

/** RAG retrieval for ElevenLabs ConvAI agent tools (same knowledge base as studio chat UI). */
export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    if (!elevenLabsConvaiService.validateToolSecret(body.toolSecret)) {
      return NextResponse.json({ error: "Invalid tool secret" }, { status: 401 });
    }

    const context = await elevenLabsConvaiService.retrievePropertyContext({
      organizationId: body.organizationId,
      propertyId: body.propertyId,
      query: body.query.trim(),
      activeSceneId: body.activeSceneId,
    });

    return NextResponse.json({
      context,
      message_to_llm: context,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "ElevenLabs RAG failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
