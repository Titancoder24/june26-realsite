import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";

export async function GET() {
  return withAuth(async (profile) => {
    const orgId = profile.organization_id;
    if (!orgId) return jsonError("No organization", 400);
    const admin = createAdminClient();

    const [
      { count: projects },
      { count: properties },
      { data: experiences },
      { count: sessions },
      { data: leads },
      { count: callbacks },
      { data: jobs },
    ] = await Promise.all([
      admin.from("projects").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
      admin.from("properties").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
      admin.from("experiences").select("type, status").eq("organization_id", orgId),
      admin.from("buyer_sessions").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
      admin.from("leads").select("intent_score, lead_status").eq("organization_id", orgId),
      admin.from("lead_events").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("event_type", "requested_callback"),
      admin.from("worldlabs_jobs").select("status").eq("organization_id", orgId),
    ]);

    const published = experiences?.filter((e) => e.status === "published").length ?? 0;
    const exp360 = experiences?.filter((e) => e.type === "360_realistic").length ?? 0;
    const exp3d = experiences?.filter((e) => e.type === "worldlabs_splat").length ?? 0;
    const processing = jobs?.filter((j) => j.status.includes("processing") || j.status.includes("requested")).length ?? 0;
    const failed = jobs?.filter((j) => j.status.includes("failed")).length ?? 0;
    const hotLeads = leads?.filter((l) => (l.intent_score ?? 0) >= 80).length ?? 0;
    const avgIntent = leads?.length ? Math.round(leads.reduce((s, l) => s + (l.intent_score ?? 0), 0) / leads.length) : 0;

    const { data: recentEvents } = await admin
      .from("lead_events")
      .select("event_type, payload, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(10);

    return NextResponse.json({
      totalProjects: projects ?? 0,
      totalProperties: properties ?? 0,
      publishedExperiences: published,
      experiences360: exp360,
      experiences3d: exp3d,
      processingJobs: processing,
      failedGenerations: failed,
      buyerSessions: sessions ?? 0,
      hotLeads,
      callbackRequests: callbacks ?? 0,
      familySessions: 0,
      avgIntentScore: avgIntent,
      recentEvents: recentEvents ?? [],
    });
  });
}
