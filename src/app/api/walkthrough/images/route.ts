import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";
import {
  countWalkthroughImages,
  MAX_IMAGES,
  uploadWalkthroughImage,
  validateWalkthroughImageInput,
} from "@/services/walkthrough.service";

export async function GET(req: Request) {
  return withAuth(async () => {
    const experienceId = new URL(req.url).searchParams.get("experienceId");
    if (!experienceId) return jsonError("experienceId required", 400);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("walkthrough_images")
      .select("*")
      .eq("experience_id", experienceId)
      .order("sort_order");
    if (error) return jsonError(error.message, 500);
    return NextResponse.json(data);
  });
}

export async function POST(req: Request) {
  return withAuth(async (profile) => {
    if (!profile.organization_id) return jsonError("No organization", 400);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const experienceId = formData.get("experienceId") as string | null;
    const propertyId = formData.get("propertyId") as string | null;
    const projectId = formData.get("projectId") as string | null;

    if (!file || !experienceId || !propertyId) {
      return jsonError("file, experienceId, propertyId required", 400);
    }

    try {
      validateWalkthroughImageInput({ size: file.size, type: file.type, name: file.name });
    } catch (err) {
      return jsonError(err instanceof Error ? err.message : "Invalid file", 400);
    }

    const currentCount = await countWalkthroughImages(experienceId);
    if (currentCount >= MAX_IMAGES) {
      return jsonError(`Maximum ${MAX_IMAGES} images per walkthrough`, 400);
    }

    try {
      const buffer = await file.arrayBuffer();
      const data = await uploadWalkthroughImage({
        buffer,
        fileName: file.name,
        mimeType: file.type || "image/jpeg",
        fileSize: file.size,
        experienceId,
        propertyId,
        organizationId: profile.organization_id,
        projectId,
        uploadedBy: profile.id,
        sortOrder: currentCount,
      });
      return NextResponse.json(data, { status: 201 });
    } catch (err) {
      return jsonError(err instanceof Error ? err.message : "Upload failed", 500);
    }
  }, "project_manager");
}
