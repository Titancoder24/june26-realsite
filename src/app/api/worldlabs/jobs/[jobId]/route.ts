import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { worldLabsService } from "@/services/world-labs.service";
import { withAuth, jsonError } from "@/lib/api-utils";

export async function GET(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return withAuth(async (profile) => {
    const admin = createAdminClient();
    const { data: job, error } = await admin.from("worldlabs_jobs").select("*").eq("id", jobId).single();
    if (error || !job) return jsonError("Job not found", 404);
    if (job.organization_id !== profile.organization_id && profile.role !== "platform_admin") {
      return jsonError("Forbidden", 403);
    }

    return NextResponse.json({
      id: job.id,
      status: job.status,
      operationId: job.operation_id,
      worldId: job.world_id,
      developerLabel: worldLabsService.getDeveloperStatus(job.status),
      errorMessage: job.error_message,
      retryCount: job.retry_count,
    });
  }, "project_manager");
}
