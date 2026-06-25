import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";
import { syncSceneVideosFromJobsForExperience } from "@/services/walkthrough-video-sync.service";
import { refreshWalkthroughChecklist } from "@/services/walkthrough.service";

export async function GET(req: Request) {
  return withAuth(async () => {
    const experienceId = new URL(req.url).searchParams.get("experienceId");
    if (!experienceId) return jsonError("experienceId required", 400);
    await syncSceneVideosFromJobsForExperience(experienceId);
    await refreshWalkthroughChecklist(experienceId);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("walkthrough_scenes")
      .select("*, walkthrough_annotations(*)")
      .eq("experience_id", experienceId)
      .order("scene_order");
    if (error) return jsonError(error.message, 500);
    return NextResponse.json(data);
  });
}

const reorderSchema = z.object({
  experience_id: z.string().uuid(),
  scene_ids: z.array(z.string().uuid()),
});

export async function PATCH(req: Request) {
  return withAuth(async () => {
    const body = reorderSchema.parse(await req.json());
    const admin = createAdminClient();
    for (let i = 0; i < body.scene_ids.length; i++) {
      await admin.from("walkthrough_scenes").update({
        scene_order: i,
        is_start_scene: i === 0,
        updated_at: new Date().toISOString(),
      }).eq("id", body.scene_ids[i]).eq("experience_id", body.experience_id);
    }
    await refreshWalkthroughChecklist(body.experience_id);
    return NextResponse.json({ ok: true });
  }, "project_manager");
}
