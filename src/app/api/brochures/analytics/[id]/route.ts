import { NextResponse } from "next/server";
import { withAuth, jsonError } from "@/lib/api-utils";
import { brochureService } from "@/services/brochure.service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async (profile) => {
    if (!profile.organization_id) return jsonError("No organization", 400);
    const analytics = await brochureService.getBrochureAnalytics(id, profile.organization_id);
    return NextResponse.json(analytics);
  }, "sales_agent");
}
