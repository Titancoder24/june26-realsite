import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";
import { syncSceneToRAG } from "@/services/scene-intelligence.service";

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  image_url: z.string().url().optional(),
  edited_image_url: z.string().url().optional(),
  thumbnail_url: z.string().url().optional(),
  scene_order: z.coerce.number().optional(),
  is_start_scene: z.boolean().optional(),
  motion_type: z.string().optional(),
  motion_config: z.record(z.unknown()).optional(),
  duration: z.coerce.number().optional(),
  edit_config: z.record(z.unknown()).optional(),
  mobile_crop: z.record(z.unknown()).optional(),
  desktop_crop: z.record(z.unknown()).optional(),
  ai_context: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (profile) => {
    const { id } = await params;
    const body = patchSchema.parse(await req.json());
    const admin = createAdminClient();

    if (body.is_start_scene) {
      const { data: scene } = await admin.from("property_scenes").select("experience_id").eq("id", id).single();
      if (scene) {
        await admin.from("property_scenes").update({ is_start_scene: false }).eq("experience_id", scene.experience_id);
      }
    }

    const { data, error } = await admin.from("property_scenes").update({ ...body, updated_at: new Date().toISOString() }).eq("id", id).select().single();
    if (error) return jsonError(error.message, 500);

    if (profile.organization_id && (body.ai_context || body.description || body.title)) {
      await syncSceneToRAG(data, profile.organization_id);
    }

    return NextResponse.json(data);
  }, "project_manager");
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await params;
    const admin = createAdminClient();
    const { error } = await admin.from("property_scenes").delete().eq("id", id);
    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ ok: true });
  }, "project_manager");
}
