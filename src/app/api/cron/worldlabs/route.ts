import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueWorldLabsJob } from "@/lib/queue/worldlabs-queue";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: jobs } = await admin
    .from("worldlabs_jobs")
    .select("id")
    .in("status", ["worldlabs_generation_requested", "worldlabs_processing"])
    .order("created_at", { ascending: true })
    .limit(10);

  const results = await Promise.all((jobs ?? []).map((j) => enqueueWorldLabsJob(j.id)));
  return NextResponse.json({ processed: results.length, modes: results });
}
