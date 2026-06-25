import { NextResponse } from "next/server";
import { z } from "zod";
import { bookingService } from "@/services/booking.service";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";

const createSchema = z.object({
  propertyId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  assignedAgent: z.string().uuid().optional(),
  visitType: z.enum(["in_person", "video_call"]).optional(),
  scheduledAt: z.string().min(1),
  durationMinutes: z.number().int().positive().optional(),
  visitorName: z.string().optional(),
  visitorPhone: z.string().optional(),
  visitorEmail: z.string().optional(),
  partySize: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

export async function GET(req: Request) {
  return withAuth(async (profile) => {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? undefined;
    const agentId = url.searchParams.get("agentId") ?? undefined;
    try {
      const data = await bookingService.listSiteVisits(profile.organization_id!, { status, agentId });
      return NextResponse.json(data);
    } catch (err) {
      return jsonError(err instanceof Error ? err.message : "Failed to list site visits", 500);
    }
  }, "sales_agent");
}

// Public: buyers can request a visit from the viewer. Org is derived from the property.
export async function POST(req: Request) {
  try {
    const body = createSchema.parse(await req.json());
    const admin = createAdminClient();

    const { data: property } = await admin
      .from("properties")
      .select("organization_id, project_id")
      .eq("id", body.propertyId)
      .single();

    if (!property) return jsonError("Property not found", 404);

    const visit = await bookingService.createSiteVisit({
      ...body,
      organizationId: property.organization_id,
      projectId: body.projectId ?? property.project_id ?? undefined,
    });

    return NextResponse.json(visit, { status: 201 });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed to create site visit", 500);
  }
}
