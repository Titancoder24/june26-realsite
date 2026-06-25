import { createAdminClient } from "@/lib/supabase/admin";
import { logApiUsage } from "@/lib/api-usage-logger";
import { vertexAIService } from "@/services/vertex-ai.service";
import { VEO_PIPELINE, type PipelineStage } from "./config";
import { PipelineProfiler } from "./profiler";
import { runWithWorkerPool } from "./worker-pool";
import { fetchSceneImageCached } from "./image-cache";
import { isRetryableVeoError, retryDelayMs, sleep, withVeoRetry } from "./retry";
import { estimateRemainingSeconds, describeVideoPipelineStage } from "./adaptive-poll";
import { assertAllowedVeoModel } from "@/lib/veo-video-models";
import type { VeoGenerationMode } from "@/lib/veo-video-models";
import { validateGeneratedVideo } from "./video-quality-guard";
import type { VideoQualityValidation } from "@/types/video-quality-validation";

type JobRow = {
  id: string;
  scene_id: string;
  experience_id: string;
  property_id: string;
  organization_id: string | null;
  status: string;
  model: string;
  prompt: string;
  polling_url: string | null;
  aspect_ratio: string | null;
  retry_count: number | null;
  started_at: string | null;
  error: string | null;
};

export type JobPollResult = {
  jobId: string;
  status: string;
  stage?: PipelineStage;
  video_url?: string;
  error?: string;
  timings?: Record<string, number>;
  validation?: VideoQualityValidation;
  generationDurationMs?: number;
  model?: string;
};

function applyJobStoredVideoUrls(storedUrl: string) {
  return {
    stored_video_url: storedUrl,
    video_url_720p: storedUrl,
    video_url_1080p: storedUrl,
    video_url_mobile: storedUrl,
  };
}

function applyStoredVideoUrls(aspectRatio: "16:9" | "9:16", storedUrl: string) {
  return {
    video_url: storedUrl,
    video_url_720p: storedUrl,
    video_url_1080p: storedUrl,
    video_url_mobile: storedUrl,
  };
}

async function storeVideoBuffer(
  buffer: Buffer,
  organizationId: string,
  propertyId: string,
  sceneId: string,
  contentType = "video/mp4",
): Promise<string> {
  const ext = contentType.includes("webm") ? "webm" : "mp4";
  const path = `${organizationId}/${propertyId}/walkthrough/motion-${sceneId.slice(0, 8)}-${Date.now()}.${ext}`;
  const admin = createAdminClient();
  const { error } = await admin.storage.from("media").upload(path, buffer, { contentType, upsert: true });
  if (error) throw error;
  const { data: { publicUrl } } = admin.storage.from("media").getPublicUrl(path);
  return publicUrl;
}

async function submitJob(job: JobRow, profiler: PipelineProfiler): Promise<JobRow> {
  const admin = createAdminClient();
  if (job.polling_url) return job;

  profiler.start("image_fetch");
  const { data: sceneRow } = await admin.from("walkthrough_scenes").select("image_url").eq("id", job.scene_id).single();
  const imageUrl = sceneRow?.image_url;
  profiler.end("image_fetch");

  const aspectRatio = (job.aspect_ratio as "16:9" | "9:16" | null) ?? "16:9";

  profiler.start("veo_submit");
  const { operationName, model: submittedModel } = await withVeoRetry(
    () => vertexAIService.submitVideoJob(job.prompt, { aspectRatio, model: job.model }, imageUrl, fetchSceneImageCached),
    { label: `submit:${job.id}` },
  );
  profiler.end("veo_submit");

  await logApiUsage({
    provider: "vertex",
    operation: "video_generate",
    model: submittedModel ?? job.model,
    organizationId: job.organization_id ?? undefined,
    experienceId: job.experience_id,
    status: "queued",
    metadata: { scene_id: job.scene_id, operation: operationName },
  });

  const { data: updated } = await admin.from("walkthrough_video_jobs").update({
    openrouter_job_id: operationName,
    polling_url: `vertex://${operationName}`,
    status: "processing",
    model: submittedModel ?? job.model,
    updated_at: new Date().toISOString(),
  }).eq("id", job.id).select().single();

  return (updated ?? job) as JobRow;
}

async function handleRetryableFailure(job: JobRow, errorMsg: string): Promise<"retry" | "fail"> {
  const admin = createAdminClient();
  const retryCount = (job.retry_count ?? 0) + 1;

  if (retryCount <= VEO_PIPELINE.maxRetries && isRetryableVeoError(errorMsg)) {
    await admin.from("walkthrough_video_jobs").update({
      status: "retrying",
      retry_count: retryCount,
      error: errorMsg,
      polling_url: null,
      openrouter_job_id: null,
      updated_at: new Date().toISOString(),
    }).eq("id", job.id);

    await sleep(retryDelayMs(retryCount - 1));
    await admin.from("walkthrough_video_jobs").update({
      status: "queued",
      updated_at: new Date().toISOString(),
    }).eq("id", job.id);
    return "retry";
  }

  await admin.from("walkthrough_video_jobs").update({
    status: "failed",
    error: errorMsg,
    retry_count: retryCount,
    generation_duration_ms: job.started_at ? Date.now() - new Date(job.started_at).getTime() : null,
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", job.id);
  await admin.from("walkthrough_scenes").update({ scene_status: "fallback_image" }).eq("id", job.scene_id);
  return "fail";
}

export async function processVideoJob(jobId: string): Promise<JobPollResult> {
  const admin = createAdminClient();
  const profiler = new PipelineProfiler(`job:${jobId.slice(0, 8)}`);

  const { data: job, error } = await admin.from("walkthrough_video_jobs").select("*").eq("id", jobId).single();
  if (error || !job) throw new Error("Video job not found");

  const row = job as JobRow;

  if (row.status === "completed") {
    const { data: completed } = await admin.from("walkthrough_video_jobs").select("stored_video_url").eq("id", jobId).single();
    return { jobId, status: "completed", stage: "completed", video_url: completed?.stored_video_url ?? undefined };
  }
  if (row.status === "failed") {
    const { data: failed } = await admin.from("walkthrough_video_jobs").select("stored_video_url").eq("id", jobId).single();
    return {
      jobId,
      status: "failed",
      stage: "failed",
      error: row.error ?? "Video generation failed",
      video_url: failed?.stored_video_url ?? undefined,
    };
  }

  try {
    profiler.start("preparing");
    const { data: scene } = await admin
      .from("walkthrough_scenes")
      .select("id, experience_id, property_id, organization_id, video_url")
      .eq("id", row.scene_id)
      .single();
    profiler.end("preparing");

    if (!scene) throw new Error("Scene not found for video job");

    if (scene.video_url && row.status === "processing") {
      await admin.from("walkthrough_video_jobs").update({
        status: "completed",
        ...applyJobStoredVideoUrls(scene.video_url),
        completed_at: new Date().toISOString(),
      }).eq("id", jobId);
      return { jobId, status: "completed", stage: "completed", video_url: scene.video_url };
    }

    const activeJob = row.status === "queued" || !row.polling_url
      ? await submitJob(row, profiler)
      : row;

    if (!activeJob.polling_url?.startsWith("vertex://")) {
      throw new Error("Legacy non-Vertex video job — regenerate motion for this scene");
    }

    const operationName = activeJob.polling_url.replace("vertex://", "");
    const pollModel = activeJob.model;
    if (!pollModel?.trim()) throw new Error("Video job missing model — regenerate with Fast or Quality mode");
  assertAllowedVeoModel(pollModel);

    profiler.start("veo_poll");
    const result = await vertexAIService.pollVideoOperation(operationName, pollModel);
    profiler.end("veo_poll");

    if (result.status === "processing") {
      await admin.from("walkthrough_video_jobs").update({ updated_at: new Date().toISOString() }).eq("id", jobId);
      return { jobId, status: "processing", stage: "generating", timings: profiler.summary() };
    }

    if (result.status === "failed") {
      const msg = result.error ?? "Vertex video generation failed";
      const outcome = await handleRetryableFailure(activeJob, msg);
      if (outcome === "retry") {
        return { jobId, status: "retrying", stage: "retrying", error: msg, timings: profiler.log({ retry: true }) };
      }
      return { jobId, status: "failed", stage: "failed", error: msg, timings: profiler.log() };
    }

    profiler.start("download");
    const buffer = result.videoBuffer
      ?? (result.videoUri ? await vertexAIService.downloadVideo(result.videoUri) : null);
    profiler.end("download");
    if (!buffer) throw new Error("Vertex video completed but no video data returned");

    const generationDurationMs = row.started_at
      ? Date.now() - new Date(row.started_at).getTime()
      : undefined;

    profiler.start("quality_guard");
    const { data: sceneImage } = await admin.from("walkthrough_scenes").select("image_url").eq("id", row.scene_id).single();
    let sourceBuffer: Buffer | null = null;
    let sourceMime = "image/jpeg";
    if (sceneImage?.image_url) {
      try {
        const fetched = await fetchSceneImageCached(sceneImage.image_url);
        sourceBuffer = fetched.buffer;
        sourceMime = fetched.mimeType;
      } catch {
        sourceBuffer = null;
      }
    }

    let validation: VideoQualityValidation | undefined;
    if (sourceBuffer) {
      validation = await validateGeneratedVideo(
        { buffer: sourceBuffer, mimeType: sourceMime },
        { buffer, mimeType: result.mimeType ?? "video/mp4" },
      );
    } else {
      validation = {
        passed: false,
        score: 0,
        issues: ["Source image unavailable for quality validation"],
        summary: "Could not run AI quality guard — source image missing.",
        recommendation: "needs_review",
      };
    }
    profiler.end("quality_guard");

    if (!validation.passed) {
      const orgId = row.organization_id ?? scene.organization_id;
      const storedUrl = await storeVideoBuffer(buffer, orgId!, scene.property_id, scene.id, result.mimeType ?? "video/mp4");
      const aspectRatio = (row.aspect_ratio as "16:9" | "9:16" | null) ?? "16:9";
      const sceneUrls = applyStoredVideoUrls(aspectRatio, storedUrl);

      await admin.from("walkthrough_video_jobs").update({
        status: "failed",
        error: `Validation failed: ${validation.summary}`,
        validation_result: validation,
        generation_duration_ms: generationDurationMs ?? null,
        ...applyJobStoredVideoUrls(storedUrl),
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", jobId);

      await admin.from("walkthrough_scenes").update({
        ...sceneUrls,
        scene_status: "needs_review",
      }).eq("id", scene.id);

      const timings = profiler.log({ scene_id: row.scene_id, model: pollModel, validation_failed: true });
      return {
        jobId,
        status: "failed",
        stage: "failed",
        error: validation.summary,
        video_url: storedUrl,
        validation,
        generationDurationMs,
        model: pollModel,
        timings,
      };
    }

    profiler.start("storage_upload");
    const orgId = row.organization_id ?? scene.organization_id;
    const storedUrl = await storeVideoBuffer(buffer, orgId!, scene.property_id, scene.id, result.mimeType ?? "video/mp4");
    profiler.end("storage_upload");

    const aspectRatio = (row.aspect_ratio as "16:9" | "9:16" | null) ?? "16:9";
    const sceneUrls = applyStoredVideoUrls(aspectRatio, storedUrl);

    await admin.from("walkthrough_video_jobs").update({
      status: "completed",
      ...applyJobStoredVideoUrls(storedUrl),
      validation_result: validation,
      generation_duration_ms: generationDurationMs ?? null,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      error: null,
    }).eq("id", jobId);

    await admin.from("walkthrough_scenes").update({ ...sceneUrls, scene_status: "motion_ready" }).eq("id", scene.id);

    const timings = profiler.log({ scene_id: row.scene_id, model: pollModel, validation_passed: true });
    return {
      jobId,
      status: "completed",
      stage: "completed",
      video_url: storedUrl,
      validation,
      generationDurationMs,
      model: pollModel,
      timings,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "poll failed";
    const outcome = await handleRetryableFailure(row, msg);
    if (outcome === "retry") {
      return { jobId, status: "retrying", stage: "retrying", error: msg, timings: profiler.log({ retry: true }) };
    }
    return { jobId, status: "failed", stage: "failed", error: msg, timings: profiler.log() };
  }
}

export async function processExperienceVideoJobs(experienceId: string): Promise<{
  results: JobPollResult[];
  timings: Record<string, number>;
}> {
  const batchProfiler = new PipelineProfiler(`experience:${experienceId.slice(0, 8)}`);
  batchProfiler.start("batch_fetch");

  const admin = createAdminClient();
  const { data: processing } = await admin
    .from("walkthrough_video_jobs")
    .select("id")
    .eq("experience_id", experienceId)
    .in("status", ["processing", "retrying"])
    .order("created_at");

  const { count: activeCount } = await admin
    .from("walkthrough_video_jobs")
    .select("*", { count: "exact", head: true })
    .eq("experience_id", experienceId)
    .in("status", ["processing", "retrying"]);

  const slots = Math.max(0, VEO_PIPELINE.maxConcurrency - (activeCount ?? 0));
  let queuedIds: string[] = [];

  if (slots > 0) {
    const { data: queued } = await admin
      .from("walkthrough_video_jobs")
      .select("id")
      .eq("experience_id", experienceId)
      .eq("status", "queued")
      .order("created_at")
      .limit(slots);
    queuedIds = (queued ?? []).map((j) => j.id);
  }

  batchProfiler.end("batch_fetch");

  const jobIds = [...(processing ?? []).map((j) => j.id), ...queuedIds];
  batchProfiler.start("worker_pool");

  const results = await runWithWorkerPool(jobIds, VEO_PIPELINE.maxConcurrency, async (id) => {
    try {
      return await processVideoJob(id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "poll failed";
      return { jobId: id, status: "failed", stage: "failed" as const, error: msg };
    }
  });

  batchProfiler.end("worker_pool");
  const timings = batchProfiler.log({ job_count: jobIds.length, concurrency: VEO_PIPELINE.maxConcurrency });

  const { syncSceneVideosFromJobsForExperience } = await import("@/services/walkthrough-video-sync.service");
  await syncSceneVideosFromJobsForExperience(experienceId);

  return { results, timings };
}

export async function getExperienceJobProgress(experienceId: string, videoMode: VeoGenerationMode = "fast") {
  const admin = createAdminClient();
  const [{ data: jobs }, { count: sceneCount }, { count: scenesWithVideo }] = await Promise.all([
    admin.from("walkthrough_video_jobs").select("id, status, scene_id, error, started_at, completed_at, model, generation_duration_ms, validation_result, stored_video_url").eq("experience_id", experienceId),
    admin.from("walkthrough_scenes").select("*", { count: "exact", head: true }).eq("experience_id", experienceId),
    admin.from("walkthrough_scenes").select("*", { count: "exact", head: true }).eq("experience_id", experienceId).not("video_url", "is", null),
  ]);

  const list = jobs ?? [];
  const completed = scenesWithVideo ?? list.filter((j) => j.status === "completed" && j.stored_video_url).length;
  const failed = list.filter((j) => j.status === "failed").length;
  const pending = list.filter((j) => ["queued", "submitted", "processing", "retrying"].includes(j.status)).length;

  const activeJobs = list.filter((j) => ["queued", "submitted", "processing", "retrying"].includes(j.status));
  const earliestStartedAt = activeJobs
    .map((j) => j.started_at)
    .filter(Boolean)
    .sort()[0] ?? null;

  const completedDurations = list
    .filter((j) => j.status === "completed" && j.generation_duration_ms && j.generation_duration_ms > 0)
    .map((j) => j.generation_duration_ms as number);
  const avgCompletedDurationMs = completedDurations.length
    ? Math.round(completedDurations.reduce((a, b) => a + b, 0) / completedDurations.length)
    : null;

  const stage = describeVideoPipelineStage({
    pending,
    completed,
    failed,
    total: sceneCount ?? list.length,
    jobStatuses: list.map((j) => j.status),
  });

  const estimatedRemainingSeconds = estimateRemainingSeconds({
    totalScenes: sceneCount ?? list.length,
    completedScenes: completed,
    mode: videoMode,
    avgCompletedDurationMs,
  });

  return {
    stage,
    total: sceneCount ?? list.length,
    completed,
    failed,
    pending,
    startedAt: earliestStartedAt,
    estimatedRemainingSeconds,
    avgCompletedDurationMs,
    estimateIsApproximate: avgCompletedDurationMs === null,
    jobs: list.map((j) => ({
      id: j.id,
      scene_id: j.scene_id,
      status: j.status,
      model: j.model,
      started_at: j.started_at,
      completed_at: j.completed_at,
      generation_duration_ms: j.generation_duration_ms,
      validation_result: j.validation_result,
      error: j.error,
    })),
  };
}

/** Fire-and-forget kick — starts poll cycle immediately after queueing. */
export function kickVideoPollCycle(experienceId: string) {
  void processExperienceVideoJobs(experienceId).catch((err) => {
    console.error("[veo-pipeline] background poll kick failed", err);
  });
}
