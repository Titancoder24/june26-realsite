"use client";

import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  BarChart3,
  BookOpen,
  Download,
  FileText,
  Flame,
  LayoutDashboard,
  MousePointerClick,
  Plus,
  Send,
  Smartphone,
  UploadCloud,
  Users,
} from "lucide-react";
import { RoleGuard } from "@/components/auth/role-guard";
import { BrochureUploadPanel } from "@/components/brochure/brochure-upload-panel";
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

type BrochureRow = {
  id: string;
  title: string;
  slug: string;
  page_count: number;
  viewer_mode: string;
  created_at: string;
  properties?: { name: string } | null;
  stats?: {
    totalViews: number;
    leadsCaptured: number;
    hotLeads: number;
    averageReadTime?: number;
    downloadClicks?: number;
    ctaClicks?: number;
  };
};

function formatDuration(seconds = 0) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function compact(n = 0) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function ModuleStatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "blue",
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint: string;
  tone?: "blue" | "green" | "orange" | "purple";
}) {
  return (
    <Card className={`bi-finance-card bi-finance-card-${tone}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="bi-finance-label">{label}</p>
            <p className="bi-finance-value">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          </div>
          <div className="bi-finance-icon">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TrendPanel({ brochures }: { brochures: BrochureRow[] }) {
  const sorted = [...brochures].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const data = (sorted.length ? sorted : [{ created_at: new Date().toISOString(), stats: { totalViews: 0 } } as BrochureRow]).map((b, i) => ({
    label: new Date(b.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    value: b.stats?.totalViews ?? 0,
    x: i,
  }));
  const max = Math.max(...data.map((d) => d.value), 1);
  const width = 520;
  const height = 170;
  const points = data.map((d, i) => {
    const x = data.length === 1 ? width / 2 : (i / (data.length - 1)) * width;
    const y = height - (d.value / max) * (height - 32) - 16;
    return `${x},${y}`;
  }).join(" ");
  const last = data[data.length - 1];

  return (
    <Card className="bi-finance-card lg:col-span-2">
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-base">Brochure Views Trend</CardTitle>
          <p className="text-sm text-muted-foreground">Views across your uploaded brochures.</p>
        </div>
        <span className="bi-soft-select">This Month</span>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-3xl font-semibold tracking-tight">{compact(data.reduce((sum, d) => sum + d.value, 0))}</p>
            <p className="mt-1 text-xs text-muted-foreground">Total recorded views</p>
          </div>
          <div className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">+ live</div>
        </div>
        <div className="mt-4 overflow-hidden rounded-2xl bg-slate-50 p-3">
          <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full">
            <defs>
              <linearGradient id="biTrendFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 1, 2].map((i) => (
              <line key={i} x1="0" x2={width} y1={height - 20 - i * 50} y2={height - 20 - i * 50} stroke="#e2e8f0" strokeDasharray="4 4" />
            ))}
            <polygon points={`0,${height} ${points} ${width},${height}`} fill="url(#biTrendFill)" />
            <polyline points={points} fill="none" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            {data.map((d, i) => {
              const x = data.length === 1 ? width / 2 : (i / (data.length - 1)) * width;
              const y = height - (d.value / max) * (height - 32) - 16;
              return <circle key={d.label + i} cx={x} cy={y} r={i === data.length - 1 ? 6 : 0} fill="#2563eb" stroke="#fff" strokeWidth="3" />;
            })}
          </svg>
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            {data.slice(-6).map((d, i) => <span key={d.label + i}>{d.label}</span>)}
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Latest: <span className="font-semibold text-foreground">{last?.label}</span> had <span className="font-semibold text-foreground">{last?.value ?? 0}</span> views.</p>
      </CardContent>
    </Card>
  );
}

function BreakdownPanel({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: number; color: string }[];
}) {
  const total = Math.max(items.reduce((sum, i) => sum + i.value, 0), 1);
  return (
    <Card className="bi-finance-card">
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="text-sm text-muted-foreground">Distribution overview</p>
        </div>
        <span className="bi-soft-select">Live</span>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap gap-4">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
              <span className="font-medium">{item.label}</span>
              <span className="text-muted-foreground">{item.value}</span>
            </div>
          ))}
        </div>
        <div className="flex h-12 overflow-hidden rounded-xl bg-slate-100">
          {items.map((item) => (
            <div key={item.label} style={{ width: `${(item.value / total) * 100}%`, background: item.color }} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function BrochuresDashboardPage() {
  const [brochures, setBrochures] = useState<BrochureRow[]>([]);
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [activeTab, setActiveTab] = useState<"reports" | "upload">("reports");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const [listRes, reportsRes, propertiesRes] = await Promise.all([
        fetch("/api/brochures"),
        fetch("/api/brochures/reports"),
        fetch("/api/properties"),
      ]);
      const list = await listRes.json();
      const reports = reportsRes.ok ? await reportsRes.json() : [];
      const propertyRows = propertiesRes.ok ? await propertiesRes.json() : [];
      const statsMap = new Map((reports as BrochureRow[]).map((r) => [r.id, r.stats]));
      setBrochures(
        (list as BrochureRow[]).map((b) => ({ ...b, stats: statsMap.get(b.id) })),
      );
      setProperties((propertyRows ?? []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));
      setLoading(false);
    })();
  }, []);

  const totals = brochures.reduce(
    (acc, b) => {
      acc.views += b.stats?.totalViews ?? 0;
      acc.leads += b.stats?.leadsCaptured ?? 0;
      acc.hot += b.stats?.hotLeads ?? 0;
      acc.downloads += b.stats?.downloadClicks ?? 0;
      acc.cta += b.stats?.ctaClicks ?? 0;
      acc.readSeconds += b.stats?.averageReadTime ?? 0;
      return acc;
    },
    { views: 0, leads: 0, hot: 0, downloads: 0, cta: 0, readSeconds: 0 },
  );
  const avgRead = brochures.length ? Math.round(totals.readSeconds / brochures.length) : 0;
  const modeItems = [
    { label: "PDF", value: brochures.filter((b) => b.viewer_mode === "pdf").length, color: "#2563eb" },
    { label: "Flipbook", value: brochures.filter((b) => b.viewer_mode === "flipbook").length, color: "#93c5fd" },
    { label: "No mode", value: brochures.filter((b) => !b.viewer_mode).length, color: "#e5e7eb" },
  ];
  const actionItems = [
    { label: "Downloads", value: totals.downloads, color: "#2563eb" },
    { label: "CTA clicks", value: totals.cta, color: "#93c5fd" },
    { label: "Hot leads", value: totals.hot, color: "#e5e7eb" },
  ];
  const topBrochure = [...brochures].sort((a, b) => (b.stats?.totalViews ?? 0) - (a.stats?.totalViews ?? 0))[0];

  return (
    <RoleGuard minRole="sales_agent">
      <div className="bi-dashboard bi-module-shell p-6">
        <div className="bi-module-hero">
          <div>
            <p className="bi-module-kicker">Brochure Intelligence</p>
            <h1>Smart brochure command center</h1>
            <p>
              Upload premium brochures, publish buyer links, and read page-level intent in one focused module.
            </p>
          </div>
          <div className="bi-module-tabs">
            <button className={activeTab === "reports" ? "is-active" : ""} onClick={() => setActiveTab("reports")}>
              <LayoutDashboard className="h-4 w-4" /> Reports
            </button>
            <button className={activeTab === "upload" ? "is-active" : ""} onClick={() => setActiveTab("upload")}>
              <UploadCloud className="h-4 w-4" /> Upload
            </button>
          </div>
        </div>

        {activeTab === "upload" ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
            <BrochureUploadPanel properties={properties} onUploaded={(b) => window.location.assign(`/dashboard/brochures/${b.id}`)} />
            <Card className="bi-finance-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Send className="h-5 w-5 text-primary" /> Upload Workflow</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {["Upload PDF", "Choose PDF or flipbook", "Customize lead pop-up", "Publish and share", "Track reports"].map((step, i) => (
                  <div key={step} className="bi-workflow-step">
                    <span>{i + 1}</span>
                    <p>{step}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <ModuleStatCard icon={BookOpen} label="Total Views" value={compact(totals.views)} hint="All brochure opens" tone="blue" />
              <ModuleStatCard icon={Users} label="Leads Captured" value={compact(totals.leads)} hint="Name and phone captured" tone="green" />
              <ModuleStatCard icon={Flame} label="Hot Leads" value={compact(totals.hot)} hint="Ranked by buyer intent" tone="orange" />
              <ModuleStatCard icon={Activity} label="Avg Read Time" value={formatDuration(avgRead)} hint="Across active brochures" tone="purple" />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <TrendPanel brochures={brochures} />
              <BreakdownPanel title="Viewer Breakdown" items={modeItems} />
              <BreakdownPanel title="Action Breakdown" items={actionItems} />
              <Card className="bi-finance-card">
                <CardHeader>
                  <CardTitle className="text-base">Top Brochure</CardTitle>
                  <p className="text-sm text-muted-foreground">Most active smart link</p>
                </CardHeader>
                <CardContent>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm font-medium text-muted-foreground">{topBrochure?.properties?.name ?? "Property not linked"}</p>
                    <h3 className="mt-1 text-xl font-semibold">{topBrochure?.title ?? "No brochure yet"}</h3>
                    <p className="mt-3 text-3xl font-semibold">{topBrochure?.stats?.totalViews ?? 0}</p>
                    <p className="text-xs text-muted-foreground">views</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bi-finance-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" /> Brochure Reports</CardTitle>
                  <p className="text-sm text-muted-foreground">Every uploaded brochure with engagement, leads, and actions.</p>
                </div>
                <Button onClick={() => setActiveTab("upload")}>
                  <Plus className="mr-2 h-4 w-4" /> Upload
                </Button>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                {loading ? (
                  <p className="p-6 text-sm text-muted-foreground">Loading brochure intelligence…</p>
                ) : (
                  <Table className="bi-modern-table bi-crm-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Brochure</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Views</TableHead>
                        <TableHead>Leads</TableHead>
                        <TableHead>Avg time</TableHead>
                        <TableHead>Hot</TableHead>
                        <TableHead>Downloads</TableHead>
                        <TableHead>CTA</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {brochures.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                            No brochures yet. Open the Upload tab to generate your first smart brochure.
                          </TableCell>
                        </TableRow>
                      ) : (
                        brochures.map((b) => (
                          <TableRow key={b.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="bi-table-icon"><FileText className="h-4 w-4" /></div>
                                <div>
                                  <Link href={`/dashboard/brochures/${b.id}`} className="font-semibold hover:underline">{b.title}</Link>
                                  <p className="text-xs text-muted-foreground">{b.properties?.name ?? "No property"} · {b.page_count} pages</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell><span className="bi-status-pill capitalize"><Smartphone className="h-3.5 w-3.5" />{b.viewer_mode}</span></TableCell>
                            <TableCell>{b.stats?.totalViews ?? 0}</TableCell>
                            <TableCell>{b.stats?.leadsCaptured ?? 0}</TableCell>
                            <TableCell>{formatDuration(b.stats?.averageReadTime)}</TableCell>
                            <TableCell><span className="bi-hot-pill">{b.stats?.hotLeads ?? 0}</span></TableCell>
                            <TableCell><Download className="mr-1 inline h-3.5 w-3.5 text-blue-600" />{b.stats?.downloadClicks ?? 0}</TableCell>
                            <TableCell><MousePointerClick className="mr-1 inline h-3.5 w-3.5 text-emerald-600" />{b.stats?.ctaClicks ?? 0}</TableCell>
                            <TableCell className="space-x-2 text-right">
                              <Button asChild size="sm" variant="outline" className="bi-table-action"><Link href={`/dashboard/brochures/${b.id}`}>Manage</Link></Button>
                              <Button asChild size="sm" variant="ghost" className="bi-table-action-ghost"><Link href={`/dashboard/brochures/${b.id}/reports`}>Reports</Link></Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </RoleGuard>
  );
}
