import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";
import { refreshImageWalkthroughChecklist, setStartNode } from "@/services/image-walkthrough.service";

const patchSchema = z.object({
  display_name: z.string().optional(),
  room_type: z.string().optional(),
  zone: z.string().nullish(),
  floor_label: z.string().nullish(),
  description: z.string().nullish(),
  node_order: z.number().int().optional(),
  is_start_node: z.boolean().optional(),
  media_type: z.enum(["flat", "equirectangular"]).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async () => {
    const body = patchSchema.parse(await req.json());
    const admin = createAdminClient();

    const { data: node } = await admin.from("image_walkthrough_nodes").select("experience_id").eq("id", id).single();
    if (!node) return jsonError("Node not found", 404);

    const { data, error } = await admin
      .from("image_walkthrough_nodes")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) return jsonError(error.message, 500);

    if (body.is_start_node) {
      await setStartNode(node.experience_id, id);
    } else {
      await refreshImageWalkthroughChecklist(node.experience_id);
    }

    return NextResponse.json(data);
  }, "project_manager");
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async () => {
    const admin = createAdminClient();
    const { data: node } = await admin.from("image_walkthrough_nodes").select("experience_id").eq("id", id).single();
    if (!node) return jsonError("Not found", 404);

    await admin.from("image_walkthrough_hotspots").delete().or(`from_node_id.eq.${id},to_node_id.eq.${id}`);
    await admin.from("image_walkthrough_annotations").delete().eq("node_id", id);
    await admin.from("image_walkthrough_nodes").delete().eq("id", id);
    await refreshImageWalkthroughChecklist(node.experience_id);
    return NextResponse.json({ ok: true });
  }, "project_manager");
}
