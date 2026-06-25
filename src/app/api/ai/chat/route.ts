import { NextResponse } from "next/server";
import { z } from "zod";
import { aiService } from "@/services/ai.service";
import { crmService } from "@/services/crm.service";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { jsonError } from "@/lib/api-utils";

const schema = z.object({
  organizationId: z.string().uuid(),
  propertyId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  query: z.string().min(1),
  sceneId: z.string().uuid().optional(),
  checkpointId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "anon";
    if (!rateLimit(`ai-chat:${ip}`, 40, 60000)) return jsonError("Rate limit exceeded", 429);

    const body = schema.parse(await req.json());
    const response = await aiService.answer(body);

    if (body.sessionId) {
      const supabase = createAdminClient();
      await supabase.from("conversation_messages").insert({
        session_id: body.sessionId,
        property_id: body.propertyId,
        role: "user",
        content: body.query,
      });
      await supabase.from("conversation_messages").insert({
        session_id: body.sessionId,
        property_id: body.propertyId,
        role: "assistant",
        content: response.answer,
        retrieved_sources: response.retrievedSources,
        confidence_score: response.confidenceScore,
        sensitive_topic: response.sensitiveTopic,
        fallback_used: response.fallbackUsed,
      });

      const eventType = response.humanEscalation ? "requested_callback" : "ai_question";
      await crmService.recordEvent({
        sessionId: body.sessionId,
        propertyId: body.propertyId,
        organizationId: body.organizationId,
        eventType,
        payload: { query: body.query, fallback: response.fallbackUsed },
      });
    }

    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
