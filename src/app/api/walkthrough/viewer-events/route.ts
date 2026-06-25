import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/api-utils";

const schema = z.object({
  sessionId: z.string().uuid().optional(),
  experienceId: z.string().uuid(),
  propertyId: z.string().uuid(),
  organizationId: z.string().uuid(),
  eventType: z.string(),
  sceneId: z.string().uuid().optional(),
  annotationId: z.string().uuid().optional(),
  payload: z.record(z.unknown()).optional(),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const admin = createAdminClient();
    const { error } = await admin.from("viewer_events").insert({
      session_id: body.sessionId,
      experience_id: body.experienceId,
      property_id: body.propertyId,
      organization_id: body.organizationId,
      event_type: body.eventType,
      scene_id: body.sceneId,
      annotation_id: body.annotationId,
      payload: body.payload ?? {},
    });
    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed", 500);
  }
}
