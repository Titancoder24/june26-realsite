import { createAdminClient } from "@/lib/supabase/admin";

function applyStoredVideoUrls(aspectRatio: "16:9" | "9:16", storedUrl: string) {
  return {
    video_url: storedUrl,
    video_url_720p: storedUrl,
    video_url_1080p: storedUrl,
    video_url_mobile: storedUrl,
  };
}

export async function syncSceneVideosFromJobsForExperience(experienceId: string) {
  const admin = createAdminClient();
  const { data: scenes } = await admin
    .from("walkthrough_scenes")
    .select("id, video_url, scene_status")
    .eq("experience_id", experienceId);

  const { data: jobs } = await admin
    .from("walkthrough_video_jobs")
    .select("scene_id, stored_video_url, status, aspect_ratio")
    .eq("experience_id", experienceId)
    .not("stored_video_url", "is", null)
    .order("created_at", { ascending: false });

  if (!scenes?.length || !jobs?.length) return 0;

  const latestJobByScene = new Map<string, { stored_video_url: string; status: string; aspect_ratio: string | null }>();
  for (const job of jobs) {
    if (!job.stored_video_url || latestJobByScene.has(job.scene_id)) continue;
    latestJobByScene.set(job.scene_id, {
      stored_video_url: job.stored_video_url,
      status: job.status,
      aspect_ratio: job.aspect_ratio,
    });
  }

  let synced = 0;
  for (const scene of scenes) {
    if (scene.video_url) continue;
    const job = latestJobByScene.get(scene.id);
    if (!job?.stored_video_url) continue;

    const aspectRatio = (job.aspect_ratio as "16:9" | "9:16" | null) ?? "16:9";
    const sceneStatus =
      job.status === "completed"
        ? "motion_ready"
        : scene.scene_status === "excluded"
          ? "excluded"
          : "needs_review";

    await admin.from("walkthrough_scenes").update({
      ...applyStoredVideoUrls(aspectRatio, job.stored_video_url),
      scene_status: sceneStatus,
      updated_at: new Date().toISOString(),
    }).eq("id", scene.id);
    synced += 1;
  }

  return synced;
}

export async function getWalkthroughExperienceSummaries(experienceIds: string[]) {
  if (!experienceIds.length) return {};

  const admin = createAdminClient();
  const summaries: Record<string, {
    scene_count: number;
    motion_clip_count: number;
    preview_video_url: string | null;
    poster_url: string | null;
  }> = {};

  const { data: scenes } = await admin
    .from("walkthrough_scenes")
    .select("experience_id, video_url, thumbnail_url, poster_url, image_url, scene_order")
    .in("experience_id", experienceIds)
    .neq("scene_status", "excluded")
    .order("scene_order");

  for (const scene of scenes ?? []) {
    const expId = scene.experience_id as string;
    if (!summaries[expId]) {
      summaries[expId] = {
        scene_count: 0,
        motion_clip_count: 0,
        preview_video_url: null,
        poster_url: scene.thumbnail_url ?? scene.poster_url ?? scene.image_url ?? null,
      };
    }
    const summary = summaries[expId];
    summary.scene_count += 1;
    if (scene.video_url) {
      summary.motion_clip_count += 1;
      if (!summary.preview_video_url) summary.preview_video_url = scene.video_url;
    }
    if (!summary.poster_url) {
      summary.poster_url = scene.thumbnail_url ?? scene.poster_url ?? scene.image_url ?? null;
    }
  }

  return summaries;
}
