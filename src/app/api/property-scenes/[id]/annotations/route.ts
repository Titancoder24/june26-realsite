import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";
import { syncAnnotationToRAG } from "@/services/scene-intelligence.service";

const schema = z.object({
  property_id: z.string().uuid(),
  experience_id: z.string().uuid(),
  title: z.string().min(1),
  short_description: z.string().optional(),
  description: z.string().optional(),
  category: z.string().default("room_feature"),
  x_position: z.number().min(0).max(1),
  y_position: z.number().min(0).max(1),
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

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await params;
    const admin = createAdminClient();
    const { data, error } = await admin.from("scene_annotations").select("*").eq("scene_id", id).order("sort_order");
    if (error) return jsonError(error.message, 500);
    return NextResponse.json(data);
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (profile) => {
    const { id: sceneId } = await params;
    const body = schema.parse(await req.json());
    const admin = createAdminClient();

    const { data: scene } = await admin.from("property_scenes").select("title").eq("id", sceneId).single();
    if (!scene) return jsonError("Scene not found", 404);

    const { data, error } = await admin
      .from("scene_annotations")
      .insert({ ...body, scene_id: sceneId })
      .select()
      .single();

    if (error) return jsonError(error.message, 500);

    if (profile.organization_id && body.rag_enabled !== false) {
      await syncAnnotationToRAG(data, profile.organization_id, scene.title);
    }

    return NextResponse.json(data, { status: 201 });
  }, "project_manager");
}
