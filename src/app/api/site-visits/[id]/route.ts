import { NextResponse } from "next/server";
import { z } from "zod";
import { bookingService } from "@/services/booking.service";
import { withAuth, jsonError } from "@/lib/api-utils";

const patchSchema = z.object({
  status: z.enum(["requested", "confirmed", "rescheduled", "completed", "cancelled", "no_show"]).optional(),
  scheduled_at: z.string().optional(),
  assigned_agent: z.string().uuid().optional(),
  notes: z.string().optional(),
  cancelled_reason: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async (profile) => {
    try {
      const body = patchSchema.parse(await req.json());
      const data = await bookingService.updateSiteVisit(id, profile.organization_id!, body);
      return NextResponse.json(data);
    } catch (err) {
      return jsonError(err instanceof Error ? err.message : "Failed to update site visit", 500);
    }
  }, "sales_agent");
}
