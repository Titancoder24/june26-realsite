import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async (profile) => {
    const admin = createAdminClient();
    const { data: asset } = await admin.from("media_assets").select("file_url, organization_id").eq("id", id).single();
    if (!asset || asset.organization_id !== profile.organization_id) return jsonError("Not found", 404);

    const path = asset.file_url.split("/media/")[1];
    if (path) await admin.storage.from("media").remove([path]);
    await admin.from("media_assets").delete().eq("id", id);
    return NextResponse.json({ ok: true });
  }, "project_manager");
}
