import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";
import { refreshWalkthroughChecklist } from "@/services/walkthrough.service";

const patchSchema = z.object({
  enhancement_status: z.enum(["approved", "rejected", "skipped"]).optional(),
  approved_by_user: z.boolean().optional(),
  included: z.boolean().optional(),
  sort_order: z.coerce.number().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await params;
    const body = patchSchema.parse(await req.json());
    const admin = createAdminClient();

    const updates: Record<string, unknown> = { ...body, updated_at: new Date().toISOString() };
    if (body.enhancement_status === "approved") {
      updates.approved_by_user = true;
    }
    if (body.enhancement_status === "skipped") {
      const { data: img } = await admin.from("walkthrough_images").select("original_image_url").eq("id", id).single();
      if (img) {
        updates.enhanced_image_url = img.original_image_url;
        updates.thumbnail_url = img.original_image_url;
      }
    }

    const { data, error } = await admin.from("walkthrough_images").update(updates).eq("id", id).select().single();
    if (error) return jsonError(error.message, 500);
    await refreshWalkthroughChecklist(data.experience_id);
    return NextResponse.json(data);
  }, "project_manager");
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await params;
    const admin = createAdminClient();
    const { data: img } = await admin.from("walkthrough_images").select("experience_id").eq("id", id).single();
    const { error } = await admin.from("walkthrough_images").delete().eq("id", id);
    if (error) return jsonError(error.message, 500);
    if (img) await refreshWalkthroughChecklist(img.experience_id);
    return NextResponse.json({ ok: true });
  }, "project_manager");
}
