import { NextResponse } from "next/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { createAdminClient } from "@/lib/supabase/admin";
import { crmService } from "@/services/crm.service";

const schema = z.object({
  propertyId: z.string().uuid(),
  experienceId: z.string().uuid().optional(),
  organizationId: z.string().uuid(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  device: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const sessionId = uuidv4();
    const supabase = createAdminClient();

    await supabase.from("buyer_sessions").insert({
      id: sessionId,
      organization_id: body.organizationId,
      property_id: body.propertyId,
      experience_id: body.experienceId,
      device: body.device ?? "unknown",
      utm_source: body.utmSource,
      utm_medium: body.utmMedium,
      utm_campaign: body.utmCampaign,
    });

    await crmService.recordEvent({
      sessionId,
      propertyId: body.propertyId,
      organizationId: body.organizationId,
      eventType: "session_started",
      payload: { utm: { source: body.utmSource, medium: body.utmMedium, campaign: body.utmCampaign } },
    });

    return NextResponse.json({ sessionId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Session creation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
