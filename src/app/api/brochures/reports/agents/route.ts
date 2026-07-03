import { NextResponse } from "next/server";
import { withAuth, jsonError } from "@/lib/api-utils";
import { brochureService } from "@/services/brochure.service";

export async function GET() {
  return withAuth(async (profile) => {
    if (!profile.organization_id) return jsonError("No organization", 400);
    const agents = await brochureService.getAgentReports(profile.organization_id);
    return NextResponse.json(agents);
  }, "sales_agent");
}
