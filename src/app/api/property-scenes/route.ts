import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";
import { suggestMotionForScene } from "@/types/scene-intelligence";

const schema = z.object({
  experience_id: z.string().uuid(),
  property_id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  image_url: z.string().url(),
  thumbnail_url: z.string().url().optional(),
  scene_order: z.number().optional(),
  is_start_scene: z.boolean().optional(),
  motion_type: z.string().optional(),
  motion_config: z.record(z.unknown()).optional(),
  duration: z.coerce.number().optional(),
  edit_config: z.record(z.unknown()).optional(),
  mobile_crop: z.record(z.unknown()).optional(),
  desktop_crop: z.record(z.unknown()).optional(),
  ai_context: z.string().optional(),
});

export async function GET(req: Request) {
  return withAuth(async () => {
    const experienceId = new URL(req.url).searchParams.get("experienceId");
    if (!experienceId) return jsonError("experienceId required");
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("property_scenes")
      .select("*, scene_annotations(*)")
      .eq("experience_id", experienceId)
      .order("scene_order");
    if (error) return jsonError(error.message, 500);
    return NextResponse.json(data);
  });
}

export async function POST(req: Request) {
  return withAuth(async () => {
    const body = schema.parse(await req.json());
    const admin = createAdminClient();

    const { count } = await admin
      .from("property_scenes")
      .select("id", { count: "exact", head: true })
      .eq("experience_id", body.experience_id);

    if ((count ?? 0) >= 35) return jsonError("Maximum 35 scenes per experience", 400);

    if (body.is_start_scene) {
      await admin.from("property_scenes").update({ is_start_scene: false }).eq("experience_id", body.experience_id);
    }

    const title = body.title;
    const motionType = body.motion_type ?? suggestMotionForScene(title);

    const { data, error } = await admin
      .from("property_scenes")
      .insert({
        ...body,
        motion_type: motionType,
        scene_order: body.scene_order ?? (count ?? 0),
        thumbnail_url: body.thumbnail_url ?? body.image_url,
        is_start_scene: body.is_start_scene ?? (count ?? 0) === 0,
      })
      .select()
      .single();

    if (error) return jsonError(error.message, 500);
    return NextResponse.json(data, { status: 201 });
  }, "project_manager");
}
