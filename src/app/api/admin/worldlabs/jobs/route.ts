import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";
import { spatialGenerationService } from "@/services/spatial-generation.service";

export async function GET() {
  return withAuth(async () => {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("worldlabs_jobs")
      .select("*, properties(name), organizations(name)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return jsonError(error.message, 500);

    const stats = {
      queued: data?.filter((j) => j.status.includes("requested") || j.status === "draft").length ?? 0,
      processing: data?.filter((j) => j.status.includes("processing")).length ?? 0,
      succeeded: data?.filter((j) => ["ready_for_review", "published", "worldlabs_succeeded"].includes(j.status)).length ?? 0,
      failed: data?.filter((j) => j.status.includes("failed")).length ?? 0,
    };

    return NextResponse.json({ jobs: data, stats });
  }, "platform_admin");
}

export async function POST(req: Request) {
  return withAuth(async () => {
    const { jobId, action } = await req.json();
    if (action === "retry" && jobId) {
      spatialGenerationService.processWorldLabsJob(jobId).catch(console.error);
      return NextResponse.json({ ok: true, message: "Retry started" });
    }
    return jsonError("Invalid action");
  }, "platform_admin");
}
