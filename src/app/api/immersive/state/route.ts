import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";

function stepFromStatus(experienceStatus: string, jobStatus?: string): number {
  if (experienceStatus === "published") return 4;
  if (jobStatus === "ready_for_review" || experienceStatus === "ready_for_review") return 3;
  if (
    jobStatus === "worldlabs_generation_requested" ||
    jobStatus === "worldlabs_processing" ||
    jobStatus === "worldlabs_succeeded"
  ) {
    return 2;
  }
  if (jobStatus === "worldlabs_generation_failed" || experienceStatus === "failed") return 2;
  return 0;
}

export async function GET(req: Request) {
  return withAuth(async (profile) => {
    const experienceId = new URL(req.url).searchParams.get("experienceId");
    if (!experienceId) return jsonError("experienceId required", 400);

    const admin = createAdminClient();
    const { data: experience, error: expErr } = await admin
      .from("experiences")
      .select("id, status, property_id, type, slug")
      .eq("id", experienceId)
      .eq("organization_id", profile.organization_id!)
      .single();

    if (expErr || !experience) return jsonError("Experience not found", 404);

    const { data: jobs } = await admin
      .from("worldlabs_jobs")
      .select("id, status, error_message, operation_id, started_at, created_at, world_prompt_payload, input_media_asset_ids")
      .eq("experience_id", experienceId)
      .eq("provider", "spaitial")
      .order("created_at", { ascending: false })
      .limit(1);

    const job = jobs?.[0] ?? null;
    const promptPayload = (job?.world_prompt_payload as { prompt?: string; title?: string }) ?? {};
    let previewUrl: string | null = null;

    const mediaIds = (job?.input_media_asset_ids as string[]) ?? [];
    if (mediaIds.length) {
      const { data: asset } = await admin.from("media_assets").select("file_url").eq("id", mediaIds[0]).single();
      previewUrl = asset?.file_url ?? null;
    }

    return NextResponse.json({
      experienceId,
      slug: experience.slug,
      experienceStatus: experience.status,
      jobId: job?.id ?? null,
      jobStatus: job?.status ?? null,
      errorMessage: job?.error_message ?? null,
      startedAt: job?.started_at ?? job?.created_at ?? null,
      step: stepFromStatus(experience.status, job?.status),
      notes: promptPayload.prompt ?? promptPayload.title ?? "",
      previewUrl,
      mediaAssetIds: mediaIds,
    });
  }, "project_manager");
}
