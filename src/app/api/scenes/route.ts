import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";

const schema = z.object({
  experience_id: z.string().uuid(),
  property_id: z.string().uuid(),
  room_name: z.string().min(1),
  image_url: z.string().url(),
  thumbnail_url: z.string().url().optional(),
  initial_yaw: z.number().optional(),
  initial_pitch: z.number().optional(),
  is_start_scene: z.boolean().optional(),
  hotspots: z.array(z.unknown()).optional(),
  ai_context: z.string().optional(),
  sort_order: z.number().optional(),
  panorama_config: z.record(z.unknown()).optional(),
});

export async function GET(req: Request) {
  return withAuth(async () => {
    const experienceId = new URL(req.url).searchParams.get("experienceId");
    if (!experienceId) return jsonError("experienceId required");
    const admin = createAdminClient();
    const { data, error } = await admin.from("tour_360_scenes").select("*").eq("experience_id", experienceId).order("sort_order");
    if (error) return jsonError(error.message, 500);
    return NextResponse.json(data);
  });
}

export async function POST(req: Request) {
  return withAuth(async () => {
    const body = schema.parse(await req.json());
    const admin = createAdminClient();
    if (body.is_start_scene) {
      await admin.from("tour_360_scenes").update({ is_start_scene: false }).eq("experience_id", body.experience_id);
    }
    const { data, error } = await admin.from("tour_360_scenes").insert(body).select().single();
    if (error) return jsonError(error.message, 500);
    return NextResponse.json(data, { status: 201 });
  }, "project_manager");
}
