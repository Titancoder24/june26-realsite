import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/api-utils";
import { parseDeviceFromUserAgent } from "@/lib/brochure-device";
import { parsePdfBuffer } from "@/lib/pdf-parse-server";
import { scoreBrochureIntent } from "@/lib/brochure-intent-scoring";
import { googleAIStudioService } from "@/services/google-ai-studio.service";
import type {
  BrochureDwellFlushPayload,
  BrochureSettings,
  BrochureTrackingEvent,
  BrochureViewerMode,
} from "@/types/brochure-intelligence";

const MAX_PDF_SIZE = 50 * 1024 * 1024;
const CONSENT_DATA_CATEGORIES = [
  "name",
  "phone",
  "email",
  "page_views",
  "section_visibility",
  "time_spent",
  "clicks",
  "device_type",
  "browser",
  "source",
];

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

async function extractPdfMeta(buffer: Buffer) {
  const data = await parsePdfBuffer(buffer);
  const pageCount = data.numpages ?? 1;
  const pages: { pageNumber: number; textContent: string }[] = [];
  if (data.text?.trim()) {
    const chunks = data.text.split(/\f|\n{3,}/).filter(Boolean);
    chunks.forEach((chunk, i) => {
      pages.push({ pageNumber: i + 1, textContent: chunk.trim().slice(0, 4000) });
    });
  }
  while (pages.length < pageCount) {
    pages.push({ pageNumber: pages.length + 1, textContent: "" });
  }
  return { pageCount, pages: pages.slice(0, pageCount) };
}

export class BrochureService {
  async listBrochures(organizationId: string) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("brochures")
      .select("*, properties(name), projects(name)")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async getBrochure(id: string, organizationId?: string) {
    const admin = createAdminClient();
    let q = admin
      .from("brochures")
      .select("*, properties(name), projects(name)")
      .eq("id", id);
    if (organizationId) q = q.eq("organization_id", organizationId);
    const { data, error } = await q.single();
    if (error) throw error;

    const [{ data: pages }, { data: sections }] = await Promise.all([
      admin.from("brochure_pages").select("*").eq("brochure_id", id).order("page_number"),
      admin.from("brochure_page_sections").select("*").eq("brochure_id", id).order("page_number"),
    ]);

    return {
      ...data,
      brochure_pages: pages ?? [],
      brochure_page_sections: sections ?? [],
    };
  }

  async getPublicBySlug(slug: string) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("brochures")
      .select("id, title, slug, file_url, page_count, viewer_mode, settings, organization_id, property_id, status")
      .eq("slug", slug)
      .eq("status", "active")
      .single();
    if (error) throw error;

    const { data: sections } = await admin
      .from("brochure_page_sections")
      .select("*")
      .eq("brochure_id", data.id)
      .order("page_number");

    return {
      ...data,
      brochure_page_sections: sections ?? [],
    };
  }

  async uploadBrochure(params: {
    file: File;
    organizationId: string;
    uploadedBy: string;
    title: string;
    propertyId?: string;
    projectId?: string;
    experienceId?: string;
    viewerMode?: BrochureViewerMode;
    settings?: BrochureSettings;
  }) {
    if (params.file.type !== "application/pdf") throw new Error("Only PDF files are supported");
    if (params.file.size > MAX_PDF_SIZE) throw new Error("PDF must be under 50MB");

    const buffer = Buffer.from(await params.file.arrayBuffer());
    const { pageCount, pages } = await extractPdfMeta(buffer);

    const admin = createAdminClient();
    const baseSlug = slugify(params.title) || "brochure";
    const slug = `${baseSlug}-${Date.now().toString(36)}`;
    const path = `${params.organizationId}/${slug}.pdf`;

    const { error: uploadError } = await admin.storage
      .from("brochures")
      .upload(path, buffer, { contentType: "application/pdf", upsert: false });
    if (uploadError) throw uploadError;

    const { data: urlData } = admin.storage.from("brochures").getPublicUrl(path);

    const { data: brochure, error } = await admin
      .from("brochures")
      .insert({
        organization_id: params.organizationId,
        property_id: params.propertyId ?? null,
        project_id: params.projectId ?? null,
        experience_id: params.experienceId ?? null,
        uploaded_by: params.uploadedBy,
        title: params.title,
        slug,
        file_url: urlData.publicUrl,
        original_file_name: params.file.name,
        page_count: pageCount,
        viewer_mode: params.viewerMode ?? "pdf",
        settings: params.settings ?? {},
      })
      .select()
      .single();
    if (error) throw error;

    if (pages.length) {
      await admin.from("brochure_pages").insert(
        pages.map((p) => ({
          brochure_id: brochure.id,
          page_number: p.pageNumber,
          text_content: p.textContent,
        })),
      );
    }

    return brochure;
  }

  async captureLead(params: {
    brochureId: string;
    name: string;
    phone: string;
    email?: string;
    consent: boolean;
    userAgent?: string;
    ip?: string;
    utm?: Record<string, string | undefined>;
    agentId?: string;
    device?: ReturnType<typeof parseDeviceFromUserAgent>;
  }) {
    if (!params.consent) throw new Error("Consent is required");

    const admin = createAdminClient();
    const brochure = await this.getBrochure(params.brochureId);
    if (!brochure || brochure.status !== "active") throw new Error("Brochure not found");

    const device = params.device ?? parseDeviceFromUserAgent(params.userAgent ?? "");

    const { data: consentReceipt, error: consentError } = await admin
      .from("brochure_consent_receipts")
      .insert({
        organization_id: brochure.organization_id,
        brochure_id: brochure.id,
        consent_version: "1.0",
        notice_version: "1.0",
        status: "given",
        data_categories: CONSENT_DATA_CATEGORIES,
        purpose: "Brochure analytics and sales follow-up",
        user_agent_hash: params.userAgent ? hashValue(params.userAgent) : null,
        ip_hash: params.ip ? hashValue(params.ip) : null,
      })
      .select()
      .single();
    if (consentError) throw consentError;

    let leadId: string | null = null;
    if (brochure.property_id) {
      const { data: lead, error: leadError } = await admin
        .from("leads")
        .insert({
          organization_id: brochure.organization_id,
          property_id: brochure.property_id,
          project_id: brochure.project_id ?? null,
          name: params.name,
          phone: params.phone,
          email: params.email,
          source: params.utm?.utm_source ?? "brochure",
          campaign: params.utm?.utm_campaign,
          device: device.device,
          lead_status: "new",
          intent_score: 20,
          first_visit: new Date().toISOString(),
          last_visit: new Date().toISOString(),
          total_sessions: 1,
          total_time_seconds: 0,
        })
        .select("id")
        .single();
      if (leadError) throw leadError;
      leadId = lead.id;
      await admin.from("brochure_consent_receipts").update({ lead_id: leadId }).eq("id", consentReceipt.id);
    }

    const { data: session, error: sessionError } = await admin
      .from("brochure_sessions")
      .insert({
        brochure_id: brochure.id,
        organization_id: brochure.organization_id,
        property_id: brochure.property_id,
        lead_id: leadId,
        visitor_id: crypto.randomUUID(),
        device: device.device,
        browser: device.browser,
        os: device.os,
        screen_width: device.screenWidth,
        screen_height: device.screenHeight,
        language: device.language,
        timezone: device.timezone,
        utm_source: params.utm?.utm_source,
        utm_medium: params.utm?.utm_medium,
        utm_campaign: params.utm?.utm_campaign,
        utm_content: params.utm?.utm_content,
        utm_term: params.utm?.utm_term,
        agent_id: params.agentId ?? null,
        consent_status: "given",
        consent_receipt_id: consentReceipt.id,
        viewer_mode: brochure.viewer_mode,
      })
      .select()
      .single();
    if (sessionError) throw sessionError;

    await admin
      .from("brochure_consent_receipts")
      .update({ session_id: session.id })
      .eq("id", consentReceipt.id);

    await admin.from("brochure_events").insert({
      session_id: session.id,
      brochure_id: brochure.id,
      organization_id: brochure.organization_id,
      event_type: "lead_gate_submitted",
      payload: { name: params.name, phone: params.phone },
    });

    return { session, leadId, consentReceiptId: consentReceipt.id };
  }

  async recordEvents(params: {
    sessionId: string;
    brochureId: string;
    organizationId: string;
    events: BrochureTrackingEvent[];
  }) {
    if (!params.events.length) return;
    const admin = createAdminClient();
    const rows = params.events.map((e) => ({
      session_id: params.sessionId,
      brochure_id: params.brochureId,
      organization_id: params.organizationId,
      event_type: e.eventType,
      page_number: e.pageNumber ?? null,
      section_id: e.sectionId ?? null,
      x: e.x ?? null,
      y: e.y ?? null,
      payload: e.payload ?? {},
    }));
    const { error } = await admin.from("brochure_events").insert(rows);
    if (error) throw error;
  }

  async flushDwell(payload: BrochureDwellFlushPayload) {
    const admin = createAdminClient();
    const now = new Date().toISOString();

    const { data: session } = await admin
      .from("brochure_sessions")
      .select("*, leads(name, phone, email)")
      .eq("id", payload.sessionId)
      .single();
    if (!session) throw new Error("Session not found");

    if (payload.events?.length) {
      await this.recordEvents({
        sessionId: payload.sessionId,
        brochureId: payload.brochureId,
        organizationId: session.organization_id,
        events: payload.events,
      });
    }

    for (const pd of payload.pageDwell ?? []) {
      const { data: existing } = await admin
        .from("brochure_page_dwell")
        .select("id, seconds, view_count, max_scroll_percent, max_zoom, first_seen_at")
        .eq("session_id", payload.sessionId)
        .eq("page_number", pd.pageNumber)
        .maybeSingle();

      if (existing) {
        await admin
          .from("brochure_page_dwell")
          .update({
            seconds: existing.seconds + pd.seconds,
            view_count: existing.view_count + pd.viewCount,
            max_scroll_percent: Math.max(Number(existing.max_scroll_percent), pd.maxScrollPercent),
            max_zoom: Math.max(Number(existing.max_zoom), pd.maxZoom),
            last_seen_at: now,
            updated_at: now,
          })
          .eq("id", existing.id);
      } else {
        await admin.from("brochure_page_dwell").insert({
          session_id: payload.sessionId,
          brochure_id: payload.brochureId,
          page_number: pd.pageNumber,
          seconds: pd.seconds,
          view_count: pd.viewCount,
          max_scroll_percent: pd.maxScrollPercent,
          max_zoom: pd.maxZoom,
          first_seen_at: now,
          last_seen_at: now,
        });
      }
    }

    for (const sd of payload.sectionDwell ?? []) {
      const { data: existing } = await admin
        .from("brochure_section_dwell")
        .select("id, visible_seconds, view_count, max_visible_percent, first_seen_at")
        .eq("session_id", payload.sessionId)
        .eq("page_number", sd.pageNumber)
        .eq("section_id", sd.sectionId)
        .maybeSingle();

      if (existing) {
        await admin
          .from("brochure_section_dwell")
          .update({
            visible_seconds: existing.visible_seconds + sd.visibleSeconds,
            view_count: existing.view_count + sd.viewCount,
            max_visible_percent: Math.max(Number(existing.max_visible_percent), sd.maxVisiblePercent),
            section_label: sd.sectionLabel ?? undefined,
            last_seen_at: now,
            updated_at: now,
          })
          .eq("id", existing.id);
      } else {
        await admin.from("brochure_section_dwell").insert({
          brochure_id: payload.brochureId,
          session_id: payload.sessionId,
          lead_id: session.lead_id,
          page_number: sd.pageNumber,
          section_id: sd.sectionId,
          section_label: sd.sectionLabel,
          visible_seconds: sd.visibleSeconds,
          view_count: sd.viewCount,
          max_visible_percent: sd.maxVisiblePercent,
          first_seen_at: now,
          last_seen_at: now,
        });
      }
    }

    for (const sb of payload.scrollDepth ?? []) {
      const { data: existing } = await admin
        .from("brochure_scroll_depth")
        .select("id, seconds")
        .eq("session_id", payload.sessionId)
        .eq("page_number", sb.pageNumber)
        .eq("scroll_bucket", sb.scrollBucket)
        .maybeSingle();

      if (existing) {
        await admin
          .from("brochure_scroll_depth")
          .update({ seconds: existing.seconds + sb.seconds, updated_at: now })
          .eq("id", existing.id);
      } else {
        await admin.from("brochure_scroll_depth").insert({
          brochure_id: payload.brochureId,
          session_id: payload.sessionId,
          lead_id: session.lead_id,
          page_number: sb.pageNumber,
          scroll_bucket: sb.scrollBucket,
          seconds: sb.seconds,
        });
      }
    }

    if (payload.heatmapPoints?.length) {
      await admin.from("brochure_heatmap_points").insert(
        payload.heatmapPoints.map((hp) => ({
          organization_id: session.organization_id,
          brochure_id: payload.brochureId,
          session_id: payload.sessionId,
          lead_id: session.lead_id,
          page_number: hp.pageNumber,
          event_type: hp.eventType,
          x: hp.x,
          y: hp.y,
          viewport_width: hp.viewportWidth,
          viewport_height: hp.viewportHeight,
          zoom: hp.zoom,
        })),
      );
    }

    const { data: pageDwells } = await admin
      .from("brochure_page_dwell")
      .select("seconds")
      .eq("session_id", payload.sessionId);
    const totalSeconds = (pageDwells ?? []).reduce((sum, r) => sum + (r.seconds ?? 0), 0);

    const { data: sectionDwells } = await admin
      .from("brochure_section_dwell")
      .select("section_id, section_label, visible_seconds")
      .eq("session_id", payload.sessionId);

    const pricingSeconds = (sectionDwells ?? [])
      .filter((s) => /pricing|price/i.test(`${s.section_id} ${s.section_label}`))
      .reduce((sum, s) => sum + s.visible_seconds, 0);
    const paymentPlanSeconds = (sectionDwells ?? [])
      .filter((s) => /payment|emi/i.test(`${s.section_id} ${s.section_label}`))
      .reduce((sum, s) => sum + s.visible_seconds, 0);
    const floorPlanSeconds = (sectionDwells ?? [])
      .filter((s) => /floor|bhk|layout/i.test(`${s.section_id} ${s.section_label}`))
      .reduce((sum, s) => sum + s.visible_seconds, 0);
    const amenitiesSeconds = (sectionDwells ?? [])
      .filter((s) => /amenit/i.test(`${s.section_id} ${s.section_label}`))
      .reduce((sum, s) => sum + s.visible_seconds, 0);

    const { data: eventFlags } = await admin
      .from("brochure_events")
      .select("event_type")
      .eq("session_id", payload.sessionId);

    const types = new Set((eventFlags ?? []).map((e) => e.event_type));
    const scoring = scoreBrochureIntent({
      leadCaptured: true,
      totalSeconds,
      pagesViewed: pageDwells?.length ?? 0,
      pricingSeconds,
      paymentPlanSeconds,
      floorPlanSeconds,
      amenitiesSeconds,
      downloaded: types.has("download_clicked"),
      ctaClicked: types.has("cta_clicked"),
      siteVisitSubmitted: types.has("lead_submitted"),
      bouncedUnder10s: totalSeconds > 0 && totalSeconds < 10,
    });

    const sessionUpdate: Record<string, unknown> = {
      total_seconds: totalSeconds,
      intent_score: scoring.score,
      lead_status: scoring.status,
      updated_at: now,
    };
    if (payload.ended) sessionUpdate.ended_at = now;

    await admin.from("brochure_sessions").update(sessionUpdate).eq("id", payload.sessionId);

    await admin.from("brochure_lead_scores").upsert(
      {
        session_id: payload.sessionId,
        brochure_id: payload.brochureId,
        lead_id: session.lead_id,
        organization_id: session.organization_id,
        score: scoring.score,
        status: scoring.status,
        signals: scoring.signals,
        recommended_action: scoring.recommendedAction,
        updated_at: now,
      },
      { onConflict: "session_id" },
    );

    if (session.lead_id) {
      await admin
        .from("leads")
        .update({
          intent_score: scoring.score,
          lead_status: scoring.status === "hot" ? "hot" : scoring.status === "warm" ? "qualified" : "new",
          total_time_seconds: totalSeconds,
          last_visit: now,
        })
        .eq("id", session.lead_id);
    }

    return { totalSeconds, scoring };
  }

  async getBrochureAnalytics(brochureId: string, organizationId: string) {
    const admin = createAdminClient();
    const brochure = await this.getBrochure(brochureId, organizationId);

    const { data: sessions } = await admin
      .from("brochure_sessions")
      .select("*, leads(name, phone, email), brochure_lead_scores(score, status, recommended_action, ai_summary)")
      .eq("brochure_id", brochureId)
      .order("started_at", { ascending: false });

    const { data: pageDwellAgg } = await admin
      .from("brochure_page_dwell")
      .select("page_number, seconds")
      .eq("brochure_id", brochureId);

    const { data: sectionDwellAgg } = await admin
      .from("brochure_section_dwell")
      .select("section_label, visible_seconds")
      .eq("brochure_id", brochureId);

    const { data: eventAgg } = await admin
      .from("brochure_events")
      .select("event_type")
      .eq("brochure_id", brochureId)
      .in("event_type", ["download_clicked", "cta_clicked"]);

    const [
      { data: heatmapAgg },
      { data: scrollDepthAgg },
      { data: pageDwellRows },
      { data: sectionDwellRows },
    ] = await Promise.all([
      admin.from("brochure_heatmap_points").select("page_number, x, y, event_type").eq("brochure_id", brochureId),
      admin.from("brochure_scroll_depth").select("page_number, scroll_bucket, seconds").eq("brochure_id", brochureId),
      admin
        .from("brochure_page_dwell")
        .select("page_number, seconds, view_count, max_zoom")
        .eq("brochure_id", brochureId),
      admin
        .from("brochure_section_dwell")
        .select("page_number, section_id, section_label, visible_seconds, max_visible_percent")
        .eq("brochure_id", brochureId),
    ]);

    const pageTotals = new Map<number, number>();
    for (const p of pageDwellAgg ?? []) {
      pageTotals.set(p.page_number, (pageTotals.get(p.page_number) ?? 0) + p.seconds);
    }
    const topPageEntry = [...pageTotals.entries()].sort((a, b) => b[1] - a[1])[0];

    const sectionTotals = new Map<string, number>();
    for (const s of sectionDwellAgg ?? []) {
      const label = s.section_label ?? "Unknown";
      sectionTotals.set(label, (sectionTotals.get(label) ?? 0) + s.visible_seconds);
    }
    const topSectionEntry = [...sectionTotals.entries()].sort((a, b) => b[1] - a[1])[0];

    const sessionList = sessions ?? [];
    const uniqueLeads = new Set(sessionList.map((s) => s.lead_id).filter(Boolean));
    const avgTime =
      sessionList.length > 0
        ? Math.round(sessionList.reduce((sum, s) => sum + (s.total_seconds ?? 0), 0) / sessionList.length)
        : 0;
    const downloadClicks = (eventAgg ?? []).filter((e) => e.event_type === "download_clicked").length;
    const ctaClicks = (eventAgg ?? []).filter((e) => e.event_type === "cta_clicked").length;

    const pageDwellMap = new Map<number, { page_number: number; seconds: number; view_count: number; max_zoom: number }>();
    for (const row of pageDwellRows ?? []) {
      const existing = pageDwellMap.get(row.page_number) ?? {
        page_number: row.page_number,
        seconds: 0,
        view_count: 0,
        max_zoom: 1,
      };
      existing.seconds += row.seconds ?? 0;
      existing.view_count += row.view_count ?? 0;
      existing.max_zoom = Math.max(existing.max_zoom, Number(row.max_zoom ?? 1));
      pageDwellMap.set(row.page_number, existing);
    }

    const sectionDwellMap = new Map<
      string,
      { page_number: number; section_id: string; section_label?: string | null; visible_seconds: number; max_visible_percent: number }
    >();
    for (const row of sectionDwellRows ?? []) {
      const key = `${row.page_number}-${row.section_id}`;
      const existing = sectionDwellMap.get(key) ?? {
        page_number: row.page_number,
        section_id: row.section_id,
        section_label: row.section_label,
        visible_seconds: 0,
        max_visible_percent: 0,
      };
      existing.visible_seconds += row.visible_seconds ?? 0;
      existing.max_visible_percent = Math.max(existing.max_visible_percent, Number(row.max_visible_percent ?? 0));
      sectionDwellMap.set(key, existing);
    }

    const scrollDepthMap = new Map<string, { page_number: number; scroll_bucket: string; seconds: number }>();
    for (const row of scrollDepthAgg ?? []) {
      const key = `${row.page_number}-${row.scroll_bucket}`;
      const existing = scrollDepthMap.get(key) ?? {
        page_number: row.page_number,
        scroll_bucket: row.scroll_bucket,
        seconds: 0,
      };
      existing.seconds += row.seconds ?? 0;
      scrollDepthMap.set(key, existing);
    }

    return {
      brochure,
      summary: {
        totalViews: sessionList.length,
        uniqueViewers: uniqueLeads.size || sessionList.length,
        leadsCaptured: sessionList.filter((s) => s.lead_id).length,
        averageReadTime: avgTime,
        hotLeads: sessionList.filter((s) => s.lead_status === "hot").length,
        warmLeads: sessionList.filter((s) => s.lead_status === "warm").length,
        coldLeads: sessionList.filter((s) => s.lead_status === "cold").length,
        downloadClicks,
        ctaClicks,
        topPage: topPageEntry ? { pageNumber: topPageEntry[0], seconds: topPageEntry[1] } : null,
        topSection: topSectionEntry ? { label: topSectionEntry[0], seconds: topSectionEntry[1] } : null,
      },
      sessions: sessionList,
      heatmap: heatmapAgg ?? [],
      pageDwell: [...pageDwellMap.values()].sort((a, b) => a.page_number - b.page_number),
      sectionDwell: [...sectionDwellMap.values()].sort((a, b) => b.visible_seconds - a.visible_seconds),
      scrollDepth: [...scrollDepthMap.values()],
    };
  }

  async getSessionDetail(sessionId: string, organizationId: string) {
    const admin = createAdminClient();
    const { data: session, error } = await admin
      .from("brochure_sessions")
      .select("*, leads(*), brochures(*, brochure_page_sections(*)), brochure_lead_scores(*)")
      .eq("id", sessionId)
      .eq("organization_id", organizationId)
      .single();
    if (error) throw error;

    const [
      { data: pageDwell },
      { data: sectionDwell },
      { data: events },
      { data: heatmap },
      { data: scrollDepth },
    ] = await Promise.all([
      admin.from("brochure_page_dwell").select("*").eq("session_id", sessionId).order("page_number"),
      admin.from("brochure_section_dwell").select("*").eq("session_id", sessionId).order("visible_seconds", { ascending: false }),
      admin.from("brochure_events").select("*").eq("session_id", sessionId).order("created_at"),
      admin.from("brochure_heatmap_points").select("*").eq("session_id", sessionId),
      admin.from("brochure_scroll_depth").select("*").eq("session_id", sessionId),
    ]);

    return { session, pageDwell: pageDwell ?? [], sectionDwell: sectionDwell ?? [], events: events ?? [], heatmap: heatmap ?? [], scrollDepth: scrollDepth ?? [] };
  }

  async generateAiSummary(sessionId: string, organizationId: string) {
    const detail = await this.getSessionDetail(sessionId, organizationId);
    const lead = detail.session.leads as { name?: string; phone?: string } | null;
    const topSections = detail.sectionDwell.slice(0, 5).map((s) => `${s.section_label}: ${s.visible_seconds}s`).join(", ");
    const topPages = detail.pageDwell.slice(0, 5).map((p) => `Page ${p.page_number}: ${p.seconds}s`).join(", ");

    const prompt = `You are a real estate sales coach. Summarize this brochure viewing session in 2-3 sentences for a sales agent. Be specific about what the buyer cared about and recommend a follow-up action.

Buyer: ${lead?.name ?? "Unknown"}
Total time: ${detail.session.total_seconds}s
Intent score: ${detail.session.intent_score} (${detail.session.lead_status})
Top pages: ${topPages || "none"}
Top sections visible: ${topSections || "none"}
Events: ${detail.events.map((e) => e.event_type).slice(-10).join(", ")}

Write a concise sales insight. Do not say we know exactly what they read — say sections were visible on screen.`;

    try {
      const summary = await googleAIStudioService.chat([
        { role: "user", content: prompt },
      ]);
      const admin = createAdminClient();
      await admin
        .from("brochure_lead_scores")
        .update({ ai_summary: summary, updated_at: new Date().toISOString() })
        .eq("session_id", sessionId);
      return summary;
    } catch {
      return detail.session.brochure_lead_scores?.[0]?.recommended_action ?? "Follow up with pricing and site visit options.";
    }
  }

  async getReportsOverview(organizationId: string) {
    const admin = createAdminClient();
    const { data: brochures } = await admin
      .from("brochures")
      .select("id, title, viewer_mode, page_count, created_at, properties(name)")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    const enriched = await Promise.all(
      (brochures ?? []).map(async (b) => {
        const analytics = await this.getBrochureAnalytics(b.id, organizationId);
        return { ...b, stats: analytics.summary };
      }),
    );
    return enriched;
  }

  async updateBrochure(
    id: string,
    organizationId: string,
    patch: { viewerMode?: BrochureViewerMode; title?: string; settings?: BrochureSettings; status?: "draft" | "active" | "archived" },
  ) {
    const admin = createAdminClient();
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.viewerMode) update.viewer_mode = patch.viewerMode;
    if (patch.title) update.title = patch.title;
    if (patch.settings) update.settings = patch.settings;
    if (patch.status) update.status = patch.status;
    const { data, error } = await admin
      .from("brochures")
      .update(update)
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async saveSections(
    brochureId: string,
    organizationId: string,
    sections: Array<{
      section_id: string;
      label: string;
      page_number: number;
      x: number;
      y: number;
      width: number;
      height: number;
      category?: string;
    }>,
  ) {
    const admin = createAdminClient();
    const { data: brochure } = await admin
      .from("brochures")
      .select("id")
      .eq("id", brochureId)
      .eq("organization_id", organizationId)
      .single();
    if (!brochure) throw new Error("Brochure not found");

    await admin.from("brochure_page_sections").delete().eq("brochure_id", brochureId);

    if (sections.length === 0) return [];

    const rows = sections.map((s) => ({
      brochure_id: brochureId,
      page_number: s.page_number,
      section_id: s.section_id,
      label: s.label,
      category: s.category ?? null,
      x: s.x,
      y: s.y,
      width: s.width,
      height: s.height,
    }));

    const { data, error } = await admin.from("brochure_page_sections").insert(rows).select("*");
    if (error) throw error;
    return data ?? [];
  }

  async getAgentReports(organizationId: string) {
    const admin = createAdminClient();
    const { data: sessions } = await admin
      .from("brochure_sessions")
      .select("id, agent_id, lead_id, intent_score, lead_status, total_seconds, utm_source, brochure_id")
      .eq("organization_id", organizationId);

    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name, email")
      .eq("organization_id", organizationId);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const byAgent = new Map<
      string,
      {
        agentId: string;
        name: string;
        linksShared: number;
        opens: number;
        leadsCaptured: number;
        hotLeads: number;
        ctaClicks: number;
        totalSeconds: number;
        bestSource: string;
      }
    >();

    for (const s of sessions ?? []) {
      const agentId = s.agent_id ?? "unassigned";
      const profile = profileMap.get(agentId);
      const entry = byAgent.get(agentId) ?? {
        agentId,
        name: profile?.full_name ?? profile?.email ?? (agentId === "unassigned" ? "Unassigned" : "Agent"),
        linksShared: 0,
        opens: 0,
        leadsCaptured: 0,
        hotLeads: 0,
        ctaClicks: 0,
        totalSeconds: 0,
        bestSource: "",
      };
      entry.opens += 1;
      if (s.lead_id) entry.leadsCaptured += 1;
      if (s.lead_status === "hot") entry.hotLeads += 1;
      entry.totalSeconds += s.total_seconds ?? 0;
      entry.linksShared = entry.opens;
      byAgent.set(agentId, entry);
    }

    const { data: ctaEvents } = await admin
      .from("brochure_events")
      .select("session_id")
      .eq("organization_id", organizationId)
      .eq("event_type", "cta_clicked");

    const ctaSessionIds = new Set((ctaEvents ?? []).map((e) => e.session_id));
    for (const s of sessions ?? []) {
      if (!ctaSessionIds.has(s.id)) continue;
      const agentId = s.agent_id ?? "unassigned";
      const entry = byAgent.get(agentId);
      if (entry) entry.ctaClicks += 1;
    }

    return [...byAgent.values()]
      .map((a) => ({
        ...a,
        avgReadTime: a.opens > 0 ? Math.round(a.totalSeconds / a.opens) : 0,
        conversionRate: a.opens > 0 ? Math.round((a.leadsCaptured / a.opens) * 100) : 0,
      }))
      .sort((a, b) => b.hotLeads - a.hotLeads || b.opens - a.opens);
  }

  async createPublicSession(params: {
    brochureId: string;
    leadId?: string;
    consentReceiptId?: string;
    userAgent?: string;
    utm?: Record<string, string | undefined>;
    agentId?: string;
    screenWidth?: number;
    screenHeight?: number;
    language?: string;
    timezone?: string;
  }) {
    const admin = createAdminClient();
    const brochure = await this.getBrochure(params.brochureId);
    if (!brochure || brochure.status !== "active") throw new Error("Brochure not found");

    const device = parseDeviceFromUserAgent(
      params.userAgent ?? "",
      params.screenWidth ?? 0,
      params.screenHeight ?? 0,
      params.language ?? "en",
      params.timezone ?? "UTC",
    );

    const { data, error } = await admin
      .from("brochure_sessions")
      .insert({
        brochure_id: brochure.id,
        organization_id: brochure.organization_id,
        property_id: brochure.property_id,
        lead_id: params.leadId ?? null,
        visitor_id: crypto.randomUUID(),
        device: device.device,
        browser: device.browser,
        os: device.os,
        screen_width: device.screenWidth,
        screen_height: device.screenHeight,
        language: device.language,
        timezone: device.timezone,
        utm_source: params.utm?.utm_source,
        utm_medium: params.utm?.utm_medium,
        utm_campaign: params.utm?.utm_campaign,
        utm_content: params.utm?.utm_content,
        utm_term: params.utm?.utm_term,
        agent_id: params.agentId ?? null,
        consent_status: params.consentReceiptId ? "given" : "pending",
        consent_receipt_id: params.consentReceiptId ?? null,
        viewer_mode: brochure.viewer_mode,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async recordSessionEvents(params: {
    sessionId: string;
    brochureId: string;
    events: BrochureTrackingEvent[];
  }) {
    const admin = createAdminClient();
    const { data: session } = await admin
      .from("brochure_sessions")
      .select("organization_id, brochure_id")
      .eq("id", params.sessionId)
      .eq("brochure_id", params.brochureId)
      .single();
    if (!session) throw new Error("Session not found");

    await this.recordEvents({
      sessionId: params.sessionId,
      brochureId: params.brochureId,
      organizationId: session.organization_id,
      events: params.events,
    });
    return { ok: true };
  }

  async getLeadTimeline(leadId: string, organizationId: string) {
    const admin = createAdminClient();
    const { data: sessions } = await admin
      .from("brochure_sessions")
      .select("id, brochure_id, started_at, total_seconds, intent_score, lead_status, brochures(title, slug)")
      .eq("lead_id", leadId)
      .eq("organization_id", organizationId)
      .order("started_at", { ascending: false });

    const sessionIds = (sessions ?? []).map((s) => s.id);
    if (!sessionIds.length) return { sessions: [], events: [] };

    const { data: events } = await admin
      .from("brochure_events")
      .select("*")
      .in("session_id", sessionIds)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    return { sessions: sessions ?? [], events: events ?? [] };
  }
}

export const brochureService = new BrochureService();
