import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { crmService } from "@/services/crm.service";
import { jsonError } from "@/lib/api-utils";

const schema = z.object({
  sessionId: z.string().uuid(),
  propertyId: z.string().uuid(),
  organizationId: z.string().uuid(),
  experienceId: z.string().uuid().optional(),
  eventType: z.string(),
  payload: z.record(z.unknown()).optional(),
  heatmap: z.object({
    x: z.number().optional(),
    y: z.number().optional(),
    z: z.number().optional(),
    sceneId: z.string().uuid().optional(),
    dwellSeconds: z.number().optional(),
    experienceType: z.string().optional(),
  }).optional(),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const admin = createAdminClient();

    await crmService.recordEvent({
      sessionId: body.sessionId,
      propertyId: body.propertyId,
      organizationId: body.organizationId,
      eventType: body.eventType,
      payload: body.payload,
    });

    if (body.heatmap) {
      await admin.from("heatmap_points").insert({
        session_id: body.sessionId,
        property_id: body.propertyId,
        experience_id: body.experienceId,
        experience_type: body.heatmap.experienceType,
        x: body.heatmap.x,
        y: body.heatmap.y,
        z: body.heatmap.z,
        scene_id: body.heatmap.sceneId,
        dwell_seconds: body.heatmap.dwellSeconds ?? 0,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed", 500);
  }
}
