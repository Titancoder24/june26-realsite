import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";
import { refreshWalkthroughChecklist, syncWalkthroughSceneToRAG } from "@/services/walkthrough.service";

const patchSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  caption: z.string().optional(),
  room_type: z.string().optional(),
  motion_type: z.string().optional(),
  motion_config: z.record(z.unknown()).optional(),
  duration: z.coerce.number().optional(),
  scene_order: z.coerce.number().optional(),
  is_start_scene: z.boolean().optional(),
  scene_status: z.enum(["planned", "needs_review", "excluded", "ready", "draft", "fallback_image"]).optional(),
  image_url: z.string().optional(),
  edited_image_url: z.string().optional(),
  edit_config: z.record(z.unknown()).optional(),
  ai_context: z.string().optional(),
  veo_prompt: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (profile) => {
    const { id } = await params;
    const body = patchSchema.parse(await req.json());
    const admin = createAdminClient();

    if (body.is_start_scene) {
      const { data: scene } = await admin.from("walkthrough_scenes").select("experience_id").eq("id", id).single();
      if (scene) {
        await admin.from("walkthrough_scenes").update({ is_start_scene: false }).eq("experience_id", scene.experience_id);
      }
    }

    const { data, error } = await admin.from("walkthrough_scenes").update({
      ...body,
      updated_at: new Date().toISOString(),
    }).eq("id", id).select("*, experiences(organization_id)").single();

    if (error) return jsonError(error.message, 500);

    const orgId = profile.organization_id ?? (data as { experiences?: { organization_id?: string } }).experiences?.organization_id;
    if (orgId && (body.ai_context || body.description || body.title)) {
      await syncWalkthroughSceneToRAG(data, orgId);
    }

    await refreshWalkthroughChecklist(data.experience_id);
    return NextResponse.json(data);
  }, "project_manager");
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await params;
    const admin = createAdminClient();
    const { data: scene } = await admin.from("walkthrough_scenes").select("experience_id").eq("id", id).single();
    const { error } = await admin.from("walkthrough_scenes").delete().eq("id", id);
    if (error) return jsonError(error.message, 500);
    if (scene) await refreshWalkthroughChecklist(scene.experience_id);
    return NextResponse.json({ ok: true });
  }, "project_manager");
}
