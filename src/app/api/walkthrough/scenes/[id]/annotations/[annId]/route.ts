import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";
import { refreshWalkthroughChecklist, syncWalkthroughAnnotationToRAG } from "@/services/walkthrough.service";

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  short_description: z.string().nullish(),
  description: z.string().nullish(),
  category: z.string().optional(),
  x_position: z.coerce.number().min(0).max(1).optional(),
  y_position: z.coerce.number().min(0).max(1).optional(),
  visibility: z.enum(["public", "internal"]).optional(),
  cta_label: z.string().nullish(),
  pin_style: z.string().nullish(),
  icon_type: z.string().nullish(),
  ai_context: z.string().nullish(),
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
      .from("walkthrough_annotations")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", annId)
      .eq("scene_id", sceneId)
      .select("*, walkthrough_scenes(title)")
      .single();

    if (error) return jsonError(error.message, 500);

    const orgId = profile.organization_id;
    if (orgId && data.rag_enabled !== false) {
      const sceneTitle = (data.walkthrough_scenes as { title?: string } | null)?.title ?? "Scene";
      await syncWalkthroughAnnotationToRAG(data, orgId, sceneTitle);
    }

    await refreshWalkthroughChecklist(data.experience_id);
    return NextResponse.json(data);
  }, "project_manager");
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; annId: string }> }) {
  return withAuth(async () => {
    const { annId } = await params;
    const admin = createAdminClient();
    const { data: ann } = await admin.from("walkthrough_annotations").select("experience_id").eq("id", annId).single();
    const { error } = await admin.from("walkthrough_annotations").delete().eq("id", annId);
    if (error) return jsonError(error.message, 500);
    if (ann) await refreshWalkthroughChecklist(ann.experience_id);
    return NextResponse.json({ ok: true });
  }, "project_manager");
}
