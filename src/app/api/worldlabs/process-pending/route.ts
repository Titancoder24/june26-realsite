import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { spatialGenerationService } from "@/services/spatial-generation.service";
import { withAuth } from "@/lib/api-utils";

export async function POST() {
  return withAuth(async () => {
    const admin = createAdminClient();
    const { data: jobs } = await admin
      .from("worldlabs_jobs")
      .select("id")
      .in("status", ["worldlabs_generation_requested", "worldlabs_processing"])
      .limit(10);

    for (const job of jobs ?? []) {
      spatialGenerationService.processSpatialJob(job.id).catch(console.error);
    }

    return NextResponse.json({ processed: jobs?.length ?? 0 });
  }, "platform_admin");
}
