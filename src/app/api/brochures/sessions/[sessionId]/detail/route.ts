import { NextResponse } from "next/server";
import { withAuth, jsonError } from "@/lib/api-utils";
import { brochureService } from "@/services/brochure.service";

export async function GET(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return withAuth(async (profile) => {
    if (!profile.organization_id) return jsonError("No organization", 400);
    const detail = await brochureService.getSessionDetail(sessionId, profile.organization_id);
    return NextResponse.json(detail);
  }, "sales_agent");
}

export async function POST(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return withAuth(async (profile) => {
    if (!profile.organization_id) return jsonError("No organization", 400);
    const summary = await brochureService.generateAiSummary(sessionId, profile.organization_id);
    return NextResponse.json({ summary });
  }, "sales_agent");
}
