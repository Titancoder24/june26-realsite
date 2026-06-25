import { NextResponse } from "next/server";
import { withAuth, jsonError } from "@/lib/api-utils";
import { mediaService } from "@/services/media.service";

export async function POST(req: Request) {
  return withAuth(async (profile) => {
    if (!profile.organization_id) return jsonError("No organization", 400);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const propertyId = formData.get("propertyId") as string | null;
    const forWorldLabs = formData.get("forWorldLabs") === "true";

    if (!file) return jsonError("No file provided");

    const asset = forWorldLabs
      ? await mediaService.uploadToWorldLabs(file, profile.organization_id, propertyId ?? undefined)
      : await mediaService.uploadToStorage(file, profile.organization_id, propertyId ?? undefined);

    return NextResponse.json(asset, { status: 201 });
  }, "project_manager");
}
