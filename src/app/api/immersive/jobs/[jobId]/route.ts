import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";
import { spatialGenerationService } from "@/services/spatial-generation.service";
import { spaitialService } from "@/services/spaitial.service";

const LABELS: Record<string, string> = {
  worldlabs_generation_requested: "Queued for generation",
  worldlabs_processing: "Building immersive world",
  worldlabs_succeeded: "Finalizing assets",
  ready_for_review: "Ready for review",
  worldlabs_generation_failed: "Generation failed",
};

export async function GET(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return withAuth(async (profile) => {
    const admin = createAdminClient();
    const { data: job, error } = await admin.from("worldlabs_jobs").select("*").eq("id", jobId).single();
    if (error || !job) return jsonError("Job not found", 404);
    if (job.organization_id !== profile.organization_id && profile.role !== "platform_admin") {
      return jsonError("Forbidden", 403);
    }

    // Advance job one step per poll (submit / check status / finalize)
    if (job.status === "worldlabs_generation_requested" || job.status === "worldlabs_processing") {
      await spatialGenerationService.processImmersiveWorldJob(jobId).catch(console.error);
      const { data: refreshed } = await admin.from("worldlabs_jobs").select("*").eq("id", jobId).single();
      if (refreshed) Object.assign(job, refreshed);
    }

    let progress: number | null = null;
    if (job.operation_id && (job.status === "worldlabs_processing" || job.status === "worldlabs_generation_requested")) {
      try {
        const poll = await spaitialService.getStatus(job.operation_id as string);
        progress = poll.progress ?? null;
      } catch {
        // ignore poll errors during status fetch
      }
    }

    return NextResponse.json({
      id: job.id,
      status: job.status,
      requestId: job.operation_id,
      worldId: job.world_id,
      developerLabel: LABELS[job.status] ?? "Processing",
      errorMessage: job.error_message,
      retryCount: job.retry_count,
      provider: job.provider ?? "spaitial",
      startedAt: job.started_at ?? job.created_at,
      progress,
    });
  }, "project_manager");
}
