import { NextResponse } from "next/server";
import { withAuth, jsonError } from "@/lib/api-utils";
import { brochureService } from "@/services/brochure.service";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async (profile) => {
    if (!profile.organization_id) return jsonError("No organization", 400);
    const body = await req.json();
    const sections = await brochureService.saveSections(id, profile.organization_id, body.sections ?? []);
    return NextResponse.json({ sections });
  }, "sales_agent");
}
