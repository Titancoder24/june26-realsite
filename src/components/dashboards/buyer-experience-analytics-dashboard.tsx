"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AudienceMix } from "@/components/audience-mix";
import { OnlineNow } from "@/components/online-now";
import { TopPages } from "@/components/top-pages";
import { TrafficSourcesChart } from "@/components/traffic-sources-chart";
import { VisitorsChart } from "@/components/visitors-chart";
import { HeatMapExplorer } from "@/components/analytics/heat-map-explorer";

type AnalyticsPayload = {
  totalSessions: number;
  totalLeads: number;
  hotLeads: number;
  recommendations: string[];
  heatmapPoints?: { scene_id?: string; x?: number; y?: number; z?: number; dwell_seconds?: number; experience_type?: string }[];
  sessionsByMonth?: { month: string; visitors: number }[];
  trafficSources?: { source: string; sessions: number }[];
  deviceMix?: { label: string; share: number }[];
  audienceMix?: { label: string; share: number }[];
  topScenes?: { path: string; visits: number; delta: number }[];
  liveNow?: number;
};

export function BuyerExperienceAnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; error?: string } | null>(null);

  useEffect(() => {
    fetch("/api/analytics").then((r) => r.json()).then(setData).catch(() => {});
    fetch("/api/health/db").then((r) => r.json()).then(setDbStatus).catch(() => {});
  }, []);

  const points360 = (data?.heatmapPoints ?? []).filter((p) => p.experience_type !== "worldlabs_splat");
  const points3d = (data?.heatmapPoints ?? []).filter((p) => p.experience_type === "worldlabs_splat");
  const priorHalf = data?.sessionsByMonth?.slice(0, 6).reduce((s, r) => s + r.visitors, 0) ?? 0;
  const recentHalf = data?.sessionsByMonth?.slice(6).reduce((s, r) => s + r.visitors, 0) ?? 0;
  const sessionDelta = priorHalf > 0 ? ((recentHalf - priorHalf) / priorHalf) * 100 : 0;

  return (
    <div className="bi-dashboard bi-module-shell p-6">
      <div className="bi-module-hero">
        <div>
          <p className="bi-module-kicker">BI Analytics</p>
          <h1>Buyer analytics</h1>
          <p>Tour engagement, traffic sources, device mix, and gaze heat maps presented with the same title and chart style as Brochure Reports.</p>
        </div>
        {dbStatus && (
          <div className={`rounded-md border px-3 py-2 text-xs ${dbStatus.connected ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
            {dbStatus.connected ? "Supabase connected" : `Database: ${dbStatus.error ?? "not connected"}`}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <VisitorsChart
          data={data?.sessionsByMonth}
          delta={sessionDelta}
          description="Buyer sessions this year (live from Supabase)"
        />
        <OnlineNow liveCount={data?.liveNow ?? 0} devices={data?.deviceMix} delta={sessionDelta} />
        <TopPages rows={data?.topScenes} />
        <TrafficSourcesChart data={data?.trafficSources} title="UTM sources" description="Sessions by campaign source" />
        <AudienceMix segments={data?.audienceMix} />
      </div>

      <Tabs defaultValue="heatmap">
        <TabsList className="bi-module-tabs h-auto rounded-full bg-white p-1">
          <TabsTrigger value="heatmap">Heat Maps</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>
        <TabsContent value="heatmap">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="bi-finance-card">
              <CardHeader className="flex flex-row items-start justify-between"><CardTitle className="text-base">360° Heat Map</CardTitle><span className="bi-soft-select">Heatmap</span></CardHeader>
              <CardContent><HeatMapExplorer points={points360} mode="360" /></CardContent>
            </Card>
            <Card className="bi-finance-card">
              <CardHeader className="flex flex-row items-start justify-between"><CardTitle className="text-base">3D Heat Map</CardTitle><span className="bi-soft-select">Heatmap</span></CardHeader>
              <CardContent><HeatMapExplorer points={points3d} mode="3d" /></CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="summary">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bi-finance-card bi-finance-card-blue"><CardHeader className="pb-2"><CardTitle className="metric-label">Sessions</CardTitle></CardHeader><CardContent><p className="metric-value metric-value--compact">{data?.totalSessions ?? 0}</p></CardContent></Card>
            <Card className="bi-finance-card bi-finance-card-green"><CardHeader className="pb-2"><CardTitle className="metric-label">Leads</CardTitle></CardHeader><CardContent><p className="metric-value metric-value--compact">{data?.totalLeads ?? 0}</p></CardContent></Card>
            <Card className="bi-finance-card bi-finance-card-orange"><CardHeader className="pb-2"><CardTitle className="metric-label">Hot Leads</CardTitle></CardHeader><CardContent><p className="metric-value metric-value--compact">{data?.hotLeads ?? 0}</p></CardContent></Card>
          </div>
          <Card className="bi-finance-card mt-4">
            <CardHeader className="flex flex-row items-start justify-between"><CardTitle className="text-base">Recommendations</CardTitle><span className="bi-soft-select">AI summary</span></CardHeader>
            <CardContent className="space-y-2">
              {(data?.recommendations ?? ["Publish an experience and share the buyer link to start collecting analytics."]).map((r) => (
                <p key={r} className="text-sm text-muted-foreground">• {r}</p>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
