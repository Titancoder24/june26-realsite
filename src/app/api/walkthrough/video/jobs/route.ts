import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncSceneVideosFromJobsForExperience } from "@/services/walkthrough-video-sync.service";
import { refreshWalkthroughChecklist } from "@/services/walkthrough.service";

export async function GET(req: Request) {
  return withAuth(async () => {
    const experienceId = new URL(req.url).searchParams.get("experienceId");
    if (!experienceId) {
      return NextResponse.json({ error: "experienceId required" }, { status: 400 });
    }

    await syncSceneVideosFromJobsForExperience(experienceId);
    await refreshWalkthroughChecklist(experienceId);

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("walkthrough_video_jobs")
      .select("*")
      .eq("experience_id", experienceId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  });
}
