import { NextResponse } from "next/server";
import { withAuth, jsonError } from "@/lib/api-utils";
import { brochureService } from "@/services/brochure.service";
import type { BrochureSettings, BrochureViewerMode } from "@/types/brochure-intelligence";

export async function POST(req: Request) {
  return withAuth(async (profile) => {
    if (!profile.organization_id) return jsonError("No organization", 400);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string | null)?.trim();
    const propertyId = (formData.get("propertyId") as string | null) || undefined;
    const projectId = (formData.get("projectId") as string | null) || undefined;
    const experienceId = (formData.get("experienceId") as string | null) || undefined;
    const viewerMode = ((formData.get("viewerMode") as string | null) ?? "pdf") as BrochureViewerMode;
    const settingsRaw = formData.get("settings") as string | null;
    let settings: BrochureSettings | undefined;
    if (settingsRaw) {
      try {
        settings = JSON.parse(settingsRaw) as BrochureSettings;
      } catch {
        return jsonError("Invalid settings JSON", 400);
      }
    }

    if (!file) return jsonError("PDF file is required", 400);
    if (!title) return jsonError("Title is required", 400);

    const brochure = await brochureService.uploadBrochure({
      file,
      organizationId: profile.organization_id,
      uploadedBy: profile.id,
      title,
      propertyId,
      projectId,
      experienceId,
      viewerMode,
      settings,
    });

    return NextResponse.json(brochure, { status: 201 });
  }, "sales_agent");
}
