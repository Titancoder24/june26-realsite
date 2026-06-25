import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";
import { refreshWalkthroughChecklist, syncWalkthroughAnnotationToRAG } from "@/services/walkthrough.service";

const createSchema = z.object({
  title: z.string().min(1),
  short_description: z.string().nullish(),
  description: z.string().nullish(),
  category: z.string().default("room_feature"),
  x_position: z.coerce.number().min(0).max(1),
  y_position: z.coerce.number().min(0).max(1),
  cta_label: z.string().nullish(),
  pin_style: z.string().nullish(),
  icon_type: z.string().nullish(),
  ai_context: z.string().nullish(),
  rag_enabled: z.boolean().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await params;
    const admin = createAdminClient();
    const { data, error } = await admin.from("walkthrough_annotations").select("*").eq("scene_id", id).order("sort_order");
    if (error) return jsonError(error.message, 500);
    return NextResponse.json(data);
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (profile) => {
    const { id: sceneId } = await params;
    const body = createSchema.parse(await req.json());
    const admin = createAdminClient();

    const { data: scene } = await admin.from("walkthrough_scenes").select("*, experiences(organization_id)").eq("id", sceneId).single();
    if (!scene) return jsonError("Scene not found", 404);

    const { data, error } = await admin.from("walkthrough_annotations").insert({
      scene_id: sceneId,
      property_id: scene.property_id,
      experience_id: scene.experience_id,
      ...body,
      rag_enabled: body.rag_enabled ?? true,
    }).select().single();

    if (error) return jsonError(error.message, 500);

    const orgId = profile.organization_id ?? (scene as { experiences?: { organization_id?: string } }).experiences?.organization_id;
    if (orgId && data.rag_enabled) {
      await syncWalkthroughAnnotationToRAG(data, orgId, scene.title);
    }

    await refreshWalkthroughChecklist(scene.experience_id);
    return NextResponse.json(data, { status: 201 });
  }, "project_manager");
}
