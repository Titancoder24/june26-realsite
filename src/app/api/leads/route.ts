import { NextResponse } from "next/server";
import { z } from "zod";
import { crmService } from "@/services/crm.service";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";

const schema = z.object({
  organizationId: z.string().uuid(),
  propertyId: z.string().uuid(),
  sessionId: z.string().uuid(),
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  source: z.string().optional(),
  campaign: z.string().optional(),
});

export async function GET(req: Request) {
  return withAuth(async (profile) => {
    if (!profile.organization_id) return NextResponse.json([]);
    const admin = createAdminClient();
    const status = new URL(req.url).searchParams.get("status");
    let q = admin
      .from("leads")
      .select("*, properties(name)")
      .eq("organization_id", profile.organization_id)
      .order("intent_score", { ascending: false });
    if (status) q = q.eq("lead_status", status);
    const { data, error } = await q;
    if (error) return jsonError(error.message, 500);
    return NextResponse.json(data ?? []);
  }, "sales_agent");
}

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const lead = await crmService.createLead(body);

    await crmService.recordEvent({
      sessionId: body.sessionId,
      leadId: lead.id,
      propertyId: body.propertyId,
      organizationId: body.organizationId,
      eventType: "lead_captured",
      payload: { name: body.name, phone: body.phone },
    });

    return NextResponse.json(lead);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lead creation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
