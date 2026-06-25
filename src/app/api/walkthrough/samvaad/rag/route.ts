import { NextResponse } from "next/server";
import { z } from "zod";
import { samvaadService } from "@/services/samvaad.service";

const schema = z.object({
  organizationId: z.string().min(1),
  propertyId: z.string().min(1),
  query: z.string().min(1),
  activeSceneId: z.string().optional(),
  toolSecret: z.string().optional(),
});

/**
 * RAG retrieval for Samvaad agent tools (same knowledge base as walkthrough chat UI).
 * Configure your Samvaad app tool to POST here with property_id + query.
 */
export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    if (!samvaadService.validateToolSecret(body.toolSecret)) {
      return NextResponse.json({ error: "Invalid tool secret" }, { status: 401 });
    }

    const context = await samvaadService.retrievePropertyContext({
      organizationId: body.organizationId,
      propertyId: body.propertyId,
      query: body.query.trim(),
      activeSceneId: body.activeSceneId,
    });

    return NextResponse.json({
      context,
      message_to_llm: context,
      message_to_user: "",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Samvaad RAG failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
