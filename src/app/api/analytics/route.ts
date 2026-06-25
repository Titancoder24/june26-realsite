import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth } from "@/lib/api-utils";
import {
  aggregateAudienceMix,
  aggregateDeviceMix,
  aggregateSessionsByDay,
  aggregateSessionsByMonth,
  aggregateTopScenes,
  aggregateTrafficSources,
  countLiveSessions,
} from "@/lib/analytics/aggregate";

export async function GET() {
  return withAuth(async (profile) => {
    const admin = createAdminClient();
    const orgId = profile.organization_id!;

    const { data: orgProperties } = await admin.from("properties").select("id").eq("organization_id", orgId);
    const propertyIds = (orgProperties ?? []).map((p) => p.id);

    const [
      { count: sessions },
      { count: leads },
      { data: hotLeads },
      { data: events },
      { data: heatmapPoints },
      { data: sessionRows },
    ] = await Promise.all([
      admin.from("buyer_sessions").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
      admin.from("leads").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
      admin.from("leads").select("intent_score").eq("organization_id", orgId).gte("intent_score", 80),
      admin.from("analytics_events").select("event_type, created_at, payload").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(500),
      propertyIds.length
        ? admin.from("heatmap_points").select("scene_id, dwell_seconds, property_id, x, y, z, experience_type").in("property_id", propertyIds).limit(500)
        : Promise.resolve({ data: [] }),
      admin.from("buyer_sessions").select("started_at, utm_source, utm_medium, device, lead_id, experience_id").eq("organization_id", orgId).order("started_at", { ascending: false }).limit(2000),
    ]);

    const sessionsList = sessionRows ?? [];
    const eventCounts: Record<string, number> = {};
    (events ?? []).forEach((e) => { eventCounts[e.event_type] = (eventCounts[e.event_type] ?? 0) + 1; });

    const sessionsByMonth = aggregateSessionsByMonth(sessionsList);
    const trafficSources = aggregateTrafficSources(sessionsList);
    const deviceMix = aggregateDeviceMix(sessionsList);
    const audienceMix = aggregateAudienceMix(sessionsList);
    const topScenes = aggregateTopScenes(events ?? []);
    const sessionsByDay = aggregateSessionsByDay(sessionsList);
    const liveNow = countLiveSessions(sessionsList);

    return NextResponse.json({
      totalSessions: sessions ?? 0,
      totalLeads: leads ?? 0,
      hotLeads: hotLeads?.length ?? 0,
      eventCounts,
      heatmapPoints: heatmapPoints ?? [],
      recommendations: generateRecommendations(eventCounts),
      sessionsByMonth,
      trafficSources,
      deviceMix,
      audienceMix,
      topScenes,
      sessionsByDay,
      liveNow,
    });
  }, "marketing_manager");
}

function generateRecommendations(events: Record<string, number>) {
  const recs: string[] = [];
  if ((events["ai_question"] ?? 0) > 5) recs.push("Many buyers ask questions via AI. Review unanswered topics in AI Agent console.");
  if ((events["session_started"] ?? 0) > 10 && (events["lead_captured"] ?? 0) < 2) recs.push("High traffic but low lead capture. Add CTA checkpoints.");
  if ((events["scene_view"] ?? 0) > 20) recs.push("Strong scene engagement. Feature top scenes in campaign creatives.");
  return recs;
}
