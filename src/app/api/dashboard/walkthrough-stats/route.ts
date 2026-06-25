import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";

function countByType(events: { event_type: string }[] | null, types: string[]) {
  return (events ?? []).filter((e) => types.includes(e.event_type)).length;
}

function topByField<T extends Record<string, unknown>>(
  rows: T[] | null,
  field: keyof T,
  labelField?: keyof T,
  limit = 5,
) {
  const map = new Map<string, { label: string; count: number }>();
  for (const row of rows ?? []) {
    const id = String(row[field] ?? "unknown");
    const label = labelField ? String(row[labelField] ?? id) : id;
    const existing = map.get(id) ?? { label, count: 0 };
    existing.count += 1;
    map.set(id, existing);
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

export async function GET() {
  return withAuth(async (profile) => {
    const orgId = profile.organization_id;
    if (!orgId) return jsonError("No organization", 400);
    const admin = createAdminClient();

    const [
      { data: experiences },
      { count: sessions },
      { data: leads },
      { count: siteVisits },
      { data: viewerEvents },
      { data: recentWalkthroughs },
      { data: hotLeadRows },
      { data: analyticsEvents },
      { data: sessionDurations },
    ] = await Promise.all([
      admin.from("experiences").select("id, type, status, slug, property_id, created_at, properties(name)").eq("organization_id", orgId),
      admin.from("buyer_sessions").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
      admin.from("leads").select("id, name, phone, intent_score, lead_status, property_id, created_at, properties(name)").eq("organization_id", orgId).order("intent_score", { ascending: false }).limit(50),
      admin.from("site_visits").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
      admin.from("viewer_events").select("event_type, scene_id, annotation_id, experience_id, property_id, payload, created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(2000),
      admin.from("experiences").select("id, slug, status, created_at, type, property_id, properties(name)").eq("organization_id", orgId).eq("type", "cinematic_walkthrough").order("created_at", { ascending: false }).limit(6),
      admin.from("leads").select("id, name, phone, email, intent_score, lead_status, property_id, created_at, properties(name)").eq("organization_id", orgId).gte("intent_score", 70).order("intent_score", { ascending: false }).limit(8),
      admin.from("analytics_events").select("event_type, created_at, payload").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(1000),
      admin.from("buyer_sessions").select("started_at, ended_at, experience_id").eq("organization_id", orgId).not("ended_at", "is", null).limit(500),
    ]);

    const activeWalkthroughs = experiences?.filter((e) => e.type === "cinematic_walkthrough" && e.status === "published").length ?? 0;
    const hotLeads = leads?.filter((l) => (l.intent_score ?? 0) >= 80).length ?? 0;
    const avgIntent = leads?.length ? Math.round(leads.reduce((s, l) => s + (l.intent_score ?? 0), 0) / leads.length) : 0;

    const walkthroughViews = countByType(viewerEvents, ["session_started", "scene_view", "room_entered"])
      || countByType(analyticsEvents, ["session_started", "scene_view"]);
    const aiQuestions = countByType(viewerEvents, ["ai_question_asked", "ai_question", "buyer_chat_message"])
      + countByType(analyticsEvents, ["ai_question"]);
    const contactClicks = countByType(viewerEvents, ["lead_form_opened", "lead_submitted", "annotation_cta_clicked"])
      + countByType(analyticsEvents, ["lead_captured", "lead_form_opened"]);
    const bookedVisits = siteVisits ?? countByType(analyticsEvents, ["requested_site_visit"]);

    const funnel = {
      viewed: sessions ?? walkthroughViews ?? 0,
      askedAi: aiQuestions || 0,
      clickedContact: contactClicks || 0,
      bookedVisit: bookedVisits || 0,
    };

    let avgViewingMinutes = 0;
    const durations = (sessionDurations ?? [])
      .map((s) => {
        if (!s.started_at || !s.ended_at) return 0;
        return (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000;
      })
      .filter((m) => m > 0 && m < 180);
    if (durations.length) {
      avgViewingMinutes = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
    }

    const sceneIds = [...new Set((viewerEvents ?? []).map((e) => e.scene_id).filter(Boolean))] as string[];
    const annotationIds = [...new Set((viewerEvents ?? []).map((e) => e.annotation_id).filter(Boolean))] as string[];

    const [{ data: sceneMeta }, { data: annotationMeta }] = await Promise.all([
      sceneIds.length
        ? admin.from("walkthrough_scenes").select("id, title, room_type").in("id", sceneIds)
        : Promise.resolve({ data: [] }),
      annotationIds.length
        ? admin.from("walkthrough_annotations").select("id, title").in("id", annotationIds)
        : Promise.resolve({ data: [] }),
    ]);

    const sceneTitleById = new Map((sceneMeta ?? []).map((s) => [s.id, s.title ?? s.room_type ?? "Room"]));
    const annotationTitleById = new Map((annotationMeta ?? []).map((a) => [a.id, a.title ?? "Annotation"]));

    const sceneRows = (viewerEvents ?? [])
      .filter((e) => e.event_type === "scene_view" || e.event_type === "room_entered")
      .map((e) => ({
        scene_id: e.scene_id,
        title: (e.scene_id && sceneTitleById.get(e.scene_id))
          ?? (e.payload as { sceneTitle?: string })?.sceneTitle
          ?? "Room",
      }));
    const mostViewedRooms = topByField(sceneRows, "scene_id", "title");

    const annotationRows = (viewerEvents ?? [])
      .filter((e) => e.event_type === "annotation_cta_clicked" || e.event_type === "annotation_opened")
      .map((e) => ({
        annotation_id: e.annotation_id,
        title: (e.annotation_id && annotationTitleById.get(e.annotation_id))
          ?? (e.payload as { title?: string })?.title
          ?? "Annotation",
      }));
    const mostClickedAnnotations = topByField(annotationRows, "annotation_id", "title");

    const experiencePerformance = (experiences ?? [])
      .filter((e) => e.type === "cinematic_walkthrough")
      .map((exp) => {
        const views = (viewerEvents ?? []).filter((ev) => ev.experience_id === exp.id).length;
        const property = exp.properties as { name?: string } | null;
        return {
          id: exp.id,
          name: property?.name ?? "Property",
          slug: exp.slug,
          status: exp.status,
          views,
        };
      })
      .sort((a, b) => b.views - a.views)
      .slice(0, 6);

    const { data: recentEvents } = await admin
      .from("viewer_events")
      .select("event_type, payload, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(10);

    return NextResponse.json({
      walkthroughViews: walkthroughViews || sessions || 0,
      activeWalkthroughs,
      totalLeads: leads?.length ?? 0,
      scheduledSiteVisits: siteVisits ?? 0,
      avgViewingMinutes,
      aiQuestionsAsked: aiQuestions,
      hotLeads,
      avgIntentScore: avgIntent,
      funnel,
      mostViewedRooms,
      mostClickedAnnotations,
      hotLeadRows: hotLeadRows ?? [],
      recentWalkthroughs: (recentWalkthroughs ?? []).map((w) => ({
        id: w.id,
        slug: w.slug,
        status: w.status,
        created_at: w.created_at,
        propertyId: w.property_id,
        propertyName: (w.properties as { name?: string } | null)?.name ?? "Property",
      })),
      experiencePerformance,
      recentEvents: recentEvents ?? [],
      analyticsPrep: {
        timePerScene: mostViewedRooms.length ? mostViewedRooms : [],
        mostRevisitedClip: [],
        annotationDwellTime: [],
        aiQuestionsByRoom: [],
        buyerIntentScore: avgIntent,
        siteVisitSources: [],
        note: "Extended scene-level analytics will populate as viewer_events volume grows.",
      },
    });
  }, "marketing_manager");
}
