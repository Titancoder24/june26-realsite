import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";
import { syncAnnotationToRAG } from "@/services/scene-intelligence.service";

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  short_description: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  x_position: z.number().min(0).max(1).optional(),
  y_position: z.number().min(0).max(1).optional(),
  depth_layer: z.string().optional(),
  visibility: z.enum(["public", "internal"]).optional(),
  cta_type: z.string().optional(),
  cta_label: z.string().optional(),
  media_url: z.string().optional(),
  ai_context: z.string().optional(),
  rag_enabled: z.boolean().optional(),
  crm_tracking_enabled: z.boolean().optional(),
  sort_order: z.number().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; annId: string }> }) {
  return withAuth(async (profile) => {
    const { id: sceneId, annId } = await params;
    const body = patchSchema.parse(await req.json());
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("scene_annotations")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", annId)
      .eq("scene_id", sceneId)
      .select()
      .single();

    if (error) return jsonError(error.message, 500);

    if (profile.organization_id && body.rag_enabled !== false) {
      const { data: scene } = await admin.from("property_scenes").select("title").eq("id", sceneId).single();
      if (scene) await syncAnnotationToRAG(data, profile.organization_id, scene.title);
    }

    return NextResponse.json(data);
  }, "project_manager");
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; annId: string }> }) {
  return withAuth(async () => {
    const { annId } = await params;
    const admin = createAdminClient();
    const { error } = await admin.from("scene_annotations").delete().eq("id", annId);
    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ ok: true });
  }, "project_manager");
}
