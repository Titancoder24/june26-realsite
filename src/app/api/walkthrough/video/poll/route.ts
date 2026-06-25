import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseVeoGenerationMode } from "@/lib/veo-video-models";
import { getExperienceJobProgress } from "@/lib/walkthrough-pipeline/veo-job-runner";
import { pollPendingVideoJobs } from "@/services/walkthrough.service";

export const maxDuration = 300;

export async function POST(req: Request) {
  return withAuth(async () => {
    const body = await req.json();
    const { experience_id, video_mode } = body as { experience_id?: string; video_mode?: unknown };
    if (!experience_id) {
      return NextResponse.json({ error: "experience_id required" }, { status: 400 });
    }

    const videoMode = parseVeoGenerationMode(video_mode);
    const [results, progress] = await Promise.all([
      pollPendingVideoJobs(experience_id),
      getExperienceJobProgress(experience_id, videoMode),
    ]);

    const completed = results.filter((r) => r.status === "completed").length;
    const processing = results.filter((r) => r.status === "processing" || r.status === "retrying").length;
    const failed = results.filter((r) => r.status === "failed").length;

    const admin = createAdminClient();
    const { count: pending } = await admin
      .from("walkthrough_video_jobs")
      .select("*", { count: "exact", head: true })
      .eq("experience_id", experience_id)
      .in("status", ["queued", "submitted", "processing", "retrying"]);

    const batchTimings = results[0]?.timings;

    return NextResponse.json({
      ok: true,
      completed,
      processing,
      failed,
      pending: pending ?? 0,
      results,
      progress,
      timings: batchTimings,
    });
  }, "project_manager");
}
