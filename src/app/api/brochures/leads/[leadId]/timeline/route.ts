import { NextResponse } from "next/server";
import { jsonError, withAuth } from "@/lib/api-utils";
import { brochureService } from "@/services/brochure.service";

export async function GET(_req: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  return withAuth(async (profile) => {
    if (!profile.organization_id) return jsonError("No organization", 400);
    const timeline = await brochureService.getLeadTimeline(leadId, profile.organization_id);
    return NextResponse.json(timeline);
  }, "sales_agent");
}
