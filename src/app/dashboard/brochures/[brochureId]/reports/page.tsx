"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, Copy, Download, ExternalLink, Flame, MousePointerClick, Smartphone, Users } from "lucide-react";
import { RoleGuard } from "@/components/auth/role-guard";
import { BrochureLeadTable, BrochureReportCards } from "@/components/brochure/brochure-analytics-dashboard";
import { BrochureHeatmap } from "@/components/brochure/brochure-heatmap";
import type { BrochureSection } from "@/types/brochure-intelligence";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function BrochureReportsPage({ params }: { params: Promise<{ brochureId: string }> }) {
  const [brochureId, setBrochureId] = useState<string>("");
  const [analytics, setAnalytics] = useState<{
    brochure: {
      title: string;
      slug: string;
      file_url?: string;
      brochure_page_sections?: BrochureSection[];
    };
    summary: Parameters<typeof BrochureReportCards>[0]["summary"];
    sessions: (Parameters<typeof BrochureLeadTable>[0]["sessions"][number] & { started_at?: string })[];
    heatmap?: Array<{ page_number: number; x: number; y: number; event_type: string }>;
    pageDwell?: Array<{ page_number: number; seconds: number; view_count: number; max_zoom: number }>;
    sectionDwell?: Array<{
      page_number: number;
      section_id: string;
      section_label?: string | null;
      visible_seconds: number;
      max_visible_percent: number;
    }>;
    scrollDepth?: Array<{ page_number: number; scroll_bucket: string; seconds: number }>;
  } | null>(null);
  const [agents, setAgents] = useState<
    Array<{
      name: string;
      opens: number;
      leadsCaptured: number;
      hotLeads: number;
      ctaClicks: number;
      avgReadTime: number;
      conversionRate: number;
    }>
  >([]);

  useEffect(() => {
    void params.then(({ brochureId: id }) => {
      setBrochureId(id);
      void fetch(`/api/brochures/analytics/${id}`)
        .then((r) => r.json())
        .then(setAnalytics);
      void fetch("/api/brochures/reports/agents")
        .then((r) => r.json())
        .then(setAgents)
        .catch(() => setAgents([]));
    });
  }, [params]);

  const shareUrl =
    typeof window !== "undefined" && analytics?.brochure.slug
      ? `${window.location.origin}/brochure/${analytics.brochure.slug}`
      : "";

  const copyLink = () => {
    if (!shareUrl) return;
    void navigator.clipboard.writeText(shareUrl);
    toast.success("Smart link copied");
  };

  const deviceSplit = analytics
    ? (() => {
        const map = new Map<string, number>();
        for (const s of analytics.sessions) {
          const key = s.device ?? "unknown";
          map.set(key, (map.get(key) ?? 0) + 1);
        }
        return [...map.entries()].sort((a, b) => b[1] - a[1]);
      })()
    : [];

  const sourceSplit = analytics
    ? (() => {
        const map = new Map<string, number>();
        for (const s of analytics.sessions) {
          const key = s.utm_source ?? "Direct";
          map.set(key, (map.get(key) ?? 0) + 1);
        }
        return [...map.entries()].sort((a, b) => b[1] - a[1]);
      })()
    : [];

  const sessionTrend = analytics
    ? (() => {
        const buckets = new Map<string, number>();
        for (const s of analytics.sessions) {
          const label = s.started_at ? new Date(s.started_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Today";
          buckets.set(label, (buckets.get(label) ?? 0) + 1);
        }
        const rows = [...buckets.entries()].map(([label, value]) => ({ label, value }));
        return rows.length ? rows : [{ label: "Today", value: 0 }];
      })()
    : [];

  const maxTrend = Math.max(...sessionTrend.map((d) => d.value), 1);
  const trendPoints = sessionTrend.map((d, i) => {
    const x = sessionTrend.length === 1 ? 260 : (i / (sessionTrend.length - 1)) * 520;
    const y = 150 - (d.value / maxTrend) * 120;
    return `${x},${y}`;
  }).join(" ");

  const breakdownTotal = (items: [string, number][]) => Math.max(items.reduce((sum, [, v]) => sum + v, 0), 1);

  return (
    <RoleGuard minRole="sales_agent">
      <div className="bi-dashboard bi-module-shell p-6">
        <div className="bi-module-hero">
          <div>
            <Link href={`/dashboard/brochures/${brochureId}`} className="text-sm text-muted-foreground hover:underline">
              ← Brochure settings
            </Link>
            <p className="bi-module-kicker">Reports</p>
            <h1>{analytics?.brochure.title ?? "Brochure Reports"}</h1>
            <p>See engagement, sources, devices, downloads, CTA clicks, and buyer intent in one report.</p>
          </div>
          {shareUrl && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={copyLink}>
                <Copy className="mr-1 h-4 w-4" /> Copy smart link
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={shareUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-1 h-4 w-4" /> Preview
                </a>
              </Button>
            </div>
          )}
        </div>

        {analytics && (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card className="bi-finance-card bi-finance-card-blue">
                <CardContent className="p-5"><Users className="mb-3 h-5 w-5 text-blue-600" /><p className="bi-finance-label">Views</p><p className="bi-finance-value">{analytics.summary.totalViews}</p></CardContent>
              </Card>
              <Card className="bi-finance-card bi-finance-card-green">
                <CardContent className="p-5"><Activity className="mb-3 h-5 w-5 text-emerald-600" /><p className="bi-finance-label">Leads</p><p className="bi-finance-value">{analytics.summary.leadsCaptured}</p></CardContent>
              </Card>
              <Card className="bi-finance-card bi-finance-card-orange">
                <CardContent className="p-5"><Flame className="mb-3 h-5 w-5 text-orange-600" /><p className="bi-finance-label">Hot Leads</p><p className="bi-finance-value">{analytics.summary.hotLeads}</p></CardContent>
              </Card>
              <Card className="bi-finance-card bi-finance-card-purple">
                <CardContent className="p-5"><Download className="mb-3 h-5 w-5 text-violet-600" /><p className="bi-finance-label">Downloads</p><p className="bi-finance-value">{analytics.summary.downloadClicks ?? 0}</p></CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="bi-finance-card lg:col-span-2">
                <CardHeader className="flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-base">Views Over Time</CardTitle>
                    <p className="text-sm text-muted-foreground">Buyer sessions grouped by open date.</p>
                  </div>
                  <span className="bi-soft-select">Live</span>
                </CardHeader>
                <CardContent>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <svg viewBox="0 0 540 170" className="h-48 w-full">
                      {[0, 1, 2].map((i) => <line key={i} x1="0" x2="540" y1={150 - i * 50} y2={150 - i * 50} stroke="#e2e8f0" strokeDasharray="4 4" />)}
                      <polyline points={trendPoints} fill="none" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      {sessionTrend.slice(-6).map((d) => <span key={d.label}>{d.label}</span>)}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bi-finance-card">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><MousePointerClick className="h-4 w-4 text-primary" /> Action Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    ["CTA clicks", analytics.summary.ctaClicks ?? 0, "#2563eb"],
                    ["Downloads", analytics.summary.downloadClicks ?? 0, "#93c5fd"],
                    ["Hot leads", analytics.summary.hotLeads, "#e5e7eb"],
                  ].map(([label, value, color]) => (
                    <div key={String(label)}>
                      <div className="mb-1 flex justify-between text-sm"><span>{label}</span><span className="font-semibold">{value}</span></div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${(Number(value) / Math.max(analytics.summary.totalViews, 1)) * 100}%`, background: String(color) }} /></div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="bi-finance-card">
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Smartphone className="h-4 w-4 text-primary" /> Device Split</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {deviceSplit.length === 0 ? <p className="text-sm text-muted-foreground">No sessions yet.</p> : deviceSplit.map(([device, count]) => {
                    const total = breakdownTotal(deviceSplit);
                    return <div key={device}><div className="mb-1 flex justify-between text-sm capitalize"><span>{device}</span><span className="font-semibold">{count}</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${(count / total) * 100}%` }} /></div></div>;
                  })}
                </CardContent>
              </Card>
              <Card className="bi-finance-card">
                <CardHeader><CardTitle className="text-base">Source / Campaign Split</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {sourceSplit.length === 0 ? <p className="text-sm text-muted-foreground">No sessions yet.</p> : sourceSplit.map(([source, count]) => {
                    const total = breakdownTotal(sourceSplit);
                    return <div key={source}><div className="mb-1 flex justify-between text-sm"><span>{source}</span><span className="font-semibold">{count}</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${(count / total) * 100}%` }} /></div></div>;
                  })}
                </CardContent>
              </Card>
            </div>

            <BrochureLeadTable brochureId={brochureId} sessions={analytics.sessions} />

            <BrochureHeatmap
              fileUrl={analytics.brochure.file_url}
              sections={analytics.brochure.brochure_page_sections ?? []}
              heatmap={analytics.heatmap ?? []}
              pageDwell={analytics.pageDwell ?? []}
              sectionDwell={(analytics.sectionDwell ?? []).map((s) => ({
                ...s,
                section_id: s.section_id,
              }))}
              scrollDepth={analytics.scrollDepth ?? []}
              title="Aggregate Brochure Heatmap"
              description="All buyer sessions combined — see which parts of your uploaded brochure get the most attention."
            />

            <Card className="bi-finance-card">
              <CardHeader>
                <CardTitle className="text-base">Sales agent performance</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table className="bi-modern-table bi-crm-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead>Opens</TableHead>
                      <TableHead>Leads</TableHead>
                      <TableHead>Hot</TableHead>
                      <TableHead>CTA clicks</TableHead>
                      <TableHead>Avg time</TableHead>
                      <TableHead>Conversion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                          No agent attribution yet. Add <code className="text-xs">?agent=ID</code> to share links.
                        </TableCell>
                      </TableRow>
                    ) : (
                      agents.map((a) => (
                        <TableRow key={a.name}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="bi-lead-avatar">{a.name.slice(0, 2).toUpperCase()}</div>
                              <span className="font-semibold">{a.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>{a.opens}</TableCell>
                          <TableCell>{a.leadsCaptured}</TableCell>
                          <TableCell>{a.hotLeads}</TableCell>
                          <TableCell>{a.ctaClicks}</TableCell>
                          <TableCell>{formatDuration(a.avgReadTime)}</TableCell>
                          <TableCell>
                            <div className="min-w-24">
                              <div className="mb-1 text-xs font-semibold">{a.conversionRate}%</div>
                              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, a.conversionRate)}%` }} />
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </RoleGuard>
  );
}
