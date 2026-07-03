"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrochureAISummary } from "@/components/brochure/brochure-ai-summary";
import { BrochureDeviceSourcePanel } from "@/components/brochure/brochure-device-source-panel";
import { BrochureHeatmap } from "@/components/brochure/brochure-heatmap";
import { formatDeviceLabel } from "@/lib/brochure-device";
import { formatBrochureDuration } from "@/lib/brochure-ui-utils";
import type { BrochureSection } from "@/types/brochure-intelligence";

function formatEventName(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function clampPercent(value: number) {
  return `${Math.max(4, Math.min(100, value))}%`;
}

function MetricCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="bi-finance-card">
      <CardContent className="p-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
        <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function ReportSection({
  title,
  description,
  label,
  children,
}: {
  title: string;
  description: string;
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="bi-finance-card">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {label && <span className="bi-soft-select shrink-0">{label}</span>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-muted-foreground">{label}</div>;
}

export function BrochureBuyerProfile({
  brochureId,
  sessionId,
  detail,
}: {
  brochureId: string;
  sessionId: string;
  detail: {
    session: {
      total_seconds: number;
      intent_score: number;
      lead_status: string;
      device?: string;
      browser?: string;
      os?: string;
      utm_source?: string;
      started_at: string;
      screen_width?: number;
      screen_height?: number;
      language?: string;
      timezone?: string;
      referrer?: string;
      utm_medium?: string;
      utm_campaign?: string;
      viewer_mode?: string;
      leads?: { name?: string; phone?: string; email?: string } | null;
      brochures?: { file_url?: string; brochure_page_sections?: BrochureSection[] } | null;
      brochure_lead_scores?: Array<{ recommended_action?: string; ai_summary?: string; signals?: string[] }> | { recommended_action?: string; ai_summary?: string; signals?: string[] } | null;
    };
    pageDwell: Array<{ page_number: number; seconds: number; view_count: number; max_zoom: number; first_seen_at?: string }>;
    sectionDwell: Array<{ page_number: number; section_id?: string; section_label?: string; visible_seconds: number; view_count: number; max_visible_percent: number }>;
    events: Array<{ event_type: string; created_at: string; page_number?: number }>;
    heatmap: Array<{ page_number: number; x: number; y: number; event_type: string }>;
    scrollDepth: Array<{ page_number: number; scroll_bucket: string; seconds: number }>;
  };
}) {
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const lead = detail.session.leads;
  const scores = detail.session.brochure_lead_scores;
  const scoreObj = Array.isArray(scores) ? scores[0] : scores;
  const sections =
    detail.session.brochures?.brochure_page_sections ??
    ([] as BrochureSection[]);

  const topPage = [...detail.pageDwell].sort((a, b) => b.seconds - a.seconds)[0];
  const topSection = [...detail.sectionDwell].sort((a, b) => b.visible_seconds - a.visible_seconds)[0];
  const totalPageSeconds = detail.pageDwell.reduce((sum, page) => sum + Number(page.seconds ?? 0), 0);
  const maxPageSeconds = Math.max(...detail.pageDwell.map((page) => Number(page.seconds ?? 0)), 1);
  const maxSectionSeconds = Math.max(...detail.sectionDwell.map((section) => Number(section.visible_seconds ?? 0)), 1);
  const pageJourney = [...detail.pageDwell].sort((a, b) => {
    if (a.first_seen_at && b.first_seen_at) {
      return new Date(a.first_seen_at).getTime() - new Date(b.first_seen_at).getTime();
    }
    return a.page_number - b.page_number;
  });
  const sectionInterest = [...detail.sectionDwell].sort((a, b) => b.visible_seconds - a.visible_seconds).slice(0, 12);
  const eventCounts = Object.entries(
    detail.events.reduce<Record<string, number>>((acc, event) => {
      acc[event.event_type] = (acc[event.event_type] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const maxEventCount = Math.max(...eventCounts.map(([, count]) => count), 1);
  const scrollByPage = Object.entries(
    detail.scrollDepth.reduce<Record<string, number>>((acc, row) => {
      const key = `Page ${row.page_number}`;
      acc[key] = (acc[key] ?? 0) + Number(row.seconds ?? 0);
      return acc;
    }, {}),
  ).sort((a, b) => Number(a[0].replace(/\D/g, "")) - Number(b[0].replace(/\D/g, "")));
  const maxScrollSeconds = Math.max(...scrollByPage.map(([, seconds]) => seconds), 1);

  const generateAi = async (sid: string) => {
    setLoadingAi(true);
    try {
      const res = await fetch(`/api/brochures/sessions/${sid}/detail`, { method: "POST" });
      const data = await res.json();
      setAiSummary(data.summary ?? null);
    } finally {
      setLoadingAi(false);
    }
  };

  return (
    <div className="bi-dashboard space-y-6">
      <div className="bi-module-hero">
        <div>
          <p className="bi-module-kicker">Buyer Journey Report</p>
          <h1>{lead?.name ?? "Buyer Session"}</h1>
          <p className="text-sm text-muted-foreground">
            {lead?.phone} ·{" "}
            {formatDeviceLabel({
              device: (detail.session.device as "mobile") ?? "desktop",
              browser: detail.session.browser ?? "Unknown",
              os: detail.session.os ?? "Unknown",
            })}
          </p>
          <p className="text-sm text-muted-foreground">
            Source: {detail.session.utm_source ?? "Direct"} · Opened{" "}
            {new Date(detail.session.started_at).toLocaleString()}
          </p>
        </div>
        <Badge variant={detail.session.lead_status === "hot" ? "destructive" : "secondary"}>
          {detail.session.intent_score} / {detail.session.lead_status}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total time spent" value={formatBrochureDuration(detail.session.total_seconds)} hint="Across the brochure session" />
        <MetricCard label="Pages viewed" value={detail.pageDwell.length} hint={topPage ? `Most time on page ${topPage.page_number}` : "No page dwell yet"} />
        <MetricCard label="Intent score" value={detail.session.intent_score} hint={`${detail.session.lead_status} lead`} />
        <MetricCard label="Top section" value={topSection?.section_label ?? "—"} hint={topSection ? formatBrochureDuration(topSection.visible_seconds) : "No section dwell yet"} />
      </div>

      <ReportSection
        title="Time Spent Distribution"
        description="Where this buyer spent attention across the brochure."
        label="Bar chart"
      >
        {detail.pageDwell.length ? (
          <div className="space-y-4">
            <div className="rounded-3xl bg-blue-50 p-5">
              <p className="text-sm font-semibold text-blue-950">Total measured reading time</p>
              <p className="mt-2 text-4xl font-black tracking-tight text-blue-700">{formatBrochureDuration(totalPageSeconds || detail.session.total_seconds)}</p>
            </div>
            <div className="space-y-3">
              {[...detail.pageDwell].sort((a, b) => a.page_number - b.page_number).map((page) => (
                <div key={page.page_number} className="grid gap-2 md:grid-cols-[7rem_minmax(0,1fr)_6rem] md:items-center">
                  <p className="text-sm font-semibold">Page {page.page_number}</p>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-blue-600" style={{ width: clampPercent((page.seconds / maxPageSeconds) * 100) }} />
                  </div>
                  <p className="text-sm font-semibold text-muted-foreground md:text-right">{formatBrochureDuration(page.seconds)}</p>
                </div>
              ))}
            </div>
          </div>
        ) : <EmptyState label="No time-spent data captured for this buyer yet." />}
      </ReportSection>

      <ReportSection
        title="Page-by-Page Journey"
        description="The buyer's reading path from first page interaction to the last captured page."
        label="Journey chart"
      >
        {pageJourney.length ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {pageJourney.map((page, index) => {
                const actions: string[] = [];
                if (page.view_count > 1) actions.push("Revisited");
                if (Number(page.max_zoom) > 1.2) actions.push("Zoomed");
                return (
                  <div key={page.page_number} className="rounded-3xl border bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="bi-status-pill">Step {index + 1}</span>
                      <span className="text-xs font-semibold text-muted-foreground">{actions.length ? actions.join(" + ") : "Viewed"}</span>
                    </div>
                    <p className="mt-4 text-lg font-bold">Page {page.page_number}</p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-sky-300" style={{ width: clampPercent((page.seconds / maxPageSeconds) * 100) }} />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Time</span>
                      <span className="font-semibold">{formatBrochureDuration(page.seconds)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Views</span>
                      <span className="font-semibold">{page.view_count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : <EmptyState label="No page journey data captured yet." />}
      </ReportSection>

      <ReportSection
        title="Section Interest"
        description="The brochure sections that held the buyer's attention longest."
        label="Interest chart"
      >
        {sectionInterest.length ? (
          <div className="space-y-3">
            {sectionInterest.map((section, index) => (
              <div key={`${section.page_number}-${section.section_id ?? section.section_label}-${index}`} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{section.section_label ?? `Page ${section.page_number}`}</p>
                    <p className="text-xs text-muted-foreground">Page {section.page_number} · {section.view_count} views · {Math.round(Number(section.max_visible_percent ?? 0))}% max visible</p>
                  </div>
                  <span className="font-bold text-blue-700">{formatBrochureDuration(section.visible_seconds)}</span>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white">
                  <div className="h-full rounded-full bg-blue-600" style={{ width: clampPercent((section.visible_seconds / maxSectionSeconds) * 100) }} />
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState label="No section visibility data captured yet." />}
      </ReportSection>

      <ReportSection
        title="Behavior Signals"
        description="A compact view of all buyer actions collected during this brochure session."
        label="Event chart"
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-3">
            {eventCounts.length ? eventCounts.map(([eventType, count]) => (
              <div key={eventType} className="grid grid-cols-[minmax(0,1fr)_3rem] items-center gap-3">
                <div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-semibold">{formatEventName(eventType)}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-slate-950" style={{ width: clampPercent((count / maxEventCount) * 100) }} />
                  </div>
                </div>
                <p className="text-right text-sm font-bold">{count}</p>
              </div>
            )) : <EmptyState label="No event signals captured yet." />}
          </div>
          <div className="space-y-3">
            {detail.events.slice(-12).reverse().map((event) => (
              <div key={`${event.created_at}-${event.event_type}-${event.page_number ?? "x"}`} className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 p-3">
                <div>
                  <p className="font-semibold">{formatEventName(event.event_type)}</p>
                  <p className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</p>
                </div>
                <span className="bi-status-pill">{event.page_number ? `Page ${event.page_number}` : "Session"}</span>
              </div>
            ))}
          </div>
        </div>
      </ReportSection>

      <ReportSection
        title="Scroll Depth"
        description="How much reading depth was captured per page."
        label="Depth chart"
      >
        {scrollByPage.length ? (
          <div className="space-y-3">
            {scrollByPage.map(([page, seconds]) => (
              <div key={page} className="grid gap-2 md:grid-cols-[7rem_minmax(0,1fr)_6rem] md:items-center">
                <p className="text-sm font-semibold">{page}</p>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-cyan-500" style={{ width: clampPercent((seconds / maxScrollSeconds) * 100) }} />
                </div>
                <p className="text-sm font-semibold text-muted-foreground md:text-right">{formatBrochureDuration(seconds)}</p>
              </div>
            ))}
          </div>
        ) : <EmptyState label="No scroll depth data captured yet." />}
      </ReportSection>

      <BrochureHeatmap
        fileUrl={detail.session.brochures?.file_url}
        sections={sections}
        heatmap={detail.heatmap}
        pageDwell={detail.pageDwell}
        sectionDwell={detail.sectionDwell.map((s) => ({
          ...s,
          section_id: s.section_id ?? `p${s.page_number}`,
        }))}
        scrollDepth={detail.scrollDepth}
        title="Brochure Heatmap"
        description="Hotjar-style overlay on your uploaded PDF — see exactly where this buyer clicked, scrolled, and focused."
      />

      <BrochureDeviceSourcePanel session={detail.session} />

      <BrochureAISummary
        sessionId={sessionId}
        initialSummary={scoreObj?.ai_summary}
        recommendedAction={scoreObj?.recommended_action}
        intentScore={detail.session.intent_score}
        leadStatus={detail.session.lead_status}
        aiSummary={aiSummary}
        loadingAi={loadingAi}
        onGenerate={generateAi}
      />
    </div>
  );
}
