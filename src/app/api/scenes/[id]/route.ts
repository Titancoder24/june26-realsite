import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";

const schema = z.object({
  room_name: z.string().optional(),
  image_url: z.string().url().optional(),
  thumbnail_url: z.string().url().optional(),
  initial_yaw: z.number().optional(),
  initial_pitch: z.number().optional(),
  is_start_scene: z.boolean().optional(),
  hotspots: z.array(z.unknown()).optional(),
  ai_context: z.string().optional(),
  sort_order: z.number().optional(),
  panorama_config: z.record(z.unknown()).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async () => {
    const body = schema.parse(await req.json());
    const admin = createAdminClient();
    const { data, error } = await admin.from("tour_360_scenes").update(body).eq("id", id).select().single();
    if (error) return jsonError(error.message, 500);
    return NextResponse.json(data);
  }, "project_manager");
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async () => {
    const admin = createAdminClient();
    const { error } = await admin.from("tour_360_scenes").delete().eq("id", id);
    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ ok: true });
  }, "project_manager");
}
