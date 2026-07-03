import { NextResponse } from "next/server";
import { withAuth, jsonError } from "@/lib/api-utils";
import { brochureService } from "@/services/brochure.service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async (profile) => {
    if (!profile.organization_id) return jsonError("No organization", 400);
    const brochure = await brochureService.getBrochure(id, profile.organization_id);
    return NextResponse.json(brochure);
  }, "sales_agent");
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async (profile) => {
    if (!profile.organization_id) return jsonError("No organization", 400);
    const body = await req.json();
    const brochure = await brochureService.updateBrochure(id, profile.organization_id, {
      viewerMode: body.viewerMode,
      title: body.title,
      settings: body.settings,
      status: body.status,
    });
    return NextResponse.json(brochure);
  }, "sales_agent");
}
