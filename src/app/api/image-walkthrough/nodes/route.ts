import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";
import { resolveOrganizationId } from "@/lib/auth/platform-scope";
import {
  countImageWalkthroughNodes,
  loadImageWalkthroughBundle,
  MAX_IMAGE_WALKTHROUGH_NODES,
  uploadImageWalkthroughNode,
  detectMediaType,
} from "@/services/image-walkthrough.service";

export async function GET(req: Request) {
  return withAuth(async () => {
    const experienceId = new URL(req.url).searchParams.get("experienceId");
    if (!experienceId) return jsonError("experienceId required", 400);
    const bundle = await loadImageWalkthroughBundle(experienceId);
    return NextResponse.json(bundle);
  }, "project_manager");
}

export async function POST(req: Request) {
  return withAuth(async (profile) => {
    const formData = await req.formData();
    const propertyId = formData.get("propertyId") as string | null;
    const organizationId = await resolveOrganizationId(profile, {
      propertyId: propertyId ?? undefined,
    });
    if (!organizationId) return jsonError("No organization", 400);

    const file = formData.get("file") as File | null;
    const experienceId = formData.get("experienceId") as string | null;
    const width = Number(formData.get("width") ?? 0);
    const height = Number(formData.get("height") ?? 0);

    if (!file || !experienceId || !propertyId) {
      return jsonError("file, experienceId, propertyId required", 400);
    }

    const allowed = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!allowed.includes(file.type)) return jsonError("Only JPG, PNG, WebP allowed", 400);
    if (file.size > 15 * 1024 * 1024) return jsonError("Max file size 15MB", 400);

    const count = await countImageWalkthroughNodes(experienceId);
    if (count >= MAX_IMAGE_WALKTHROUGH_NODES) {
      return jsonError(`Maximum ${MAX_IMAGE_WALKTHROUGH_NODES} images`, 400);
    }

    try {
      const buffer = await file.arrayBuffer();
      const data = await uploadImageWalkthroughNode({
        buffer,
        fileName: file.name,
        mimeType: file.type || "image/jpeg",
        fileSize: file.size,
        experienceId,
        propertyId,
        organizationId,
        sortOrder: count,
        mediaType: detectMediaType(width || undefined, height || undefined),
      });
      return NextResponse.json(data, { status: 201 });
    } catch (err) {
      return jsonError(err instanceof Error ? err.message : "Upload failed", 500);
    }
  }, "project_manager");
}

export async function DELETE(req: Request) {
  return withAuth(async () => {
    const experienceId = new URL(req.url).searchParams.get("experienceId");
    if (!experienceId) return jsonError("experienceId required", 400);
    const admin = createAdminClient();
    await admin.from("image_walkthrough_hotspots").delete().eq("experience_id", experienceId);
    await admin.from("image_walkthrough_annotations").delete().eq("experience_id", experienceId);
    await admin.from("image_walkthrough_nodes").delete().eq("experience_id", experienceId);
    return NextResponse.json({ ok: true });
  }, "project_manager");
}
