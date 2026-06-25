"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Building2,
  Camera,
  CircleDot,
  Flame,
  Globe2,
  Phone,
  Sparkles,
  TrendingUp,
  Users,
  View,
} from "lucide-react";
import { PortfolioPulseHero } from "@/components/dashboard/portfolio-pulse-hero";
import { VisitorsChart } from "@/components/visitors-chart";
import { TrafficSourcesChart } from "@/components/traffic-sources-chart";
import { CategoryRankChart } from "@/components/category-rank-chart";
import { OnlineNow } from "@/components/online-now";

type StatsPayload = {
  totalProjects: number;
  totalProperties: number;
  publishedExperiences: number;
  experiences360: number;
  experiences3d: number;
  processingJobs: number;
  failedGenerations: number;
  buyerSessions: number;
  hotLeads: number;
  callbackRequests: number;
  avgIntentScore: number;
  recentEvents: { event_type: string; payload?: { query?: string }; created_at: string }[];
};

type AnalyticsPayload = {
  sessionsByMonth?: { month: string; visitors: number }[];
  trafficSources?: { source: string; sessions: number }[];
  deviceMix?: { label: string; share: number }[];
  liveNow?: number;
  totalLeads?: number;
};

export function ExecutiveOverviewDashboard() {
  const [stats, setStats] = useState<StatsPayload>({
    totalProjects: 0, totalProperties: 0, publishedExperiences: 0, experiences360: 0,
    experiences3d: 0, processingJobs: 0, failedGenerations: 0, buyerSessions: 0,
    hotLeads: 0, callbackRequests: 0, avgIntentScore: 0, recentEvents: [],
  });
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/stats").then((r) => r.json()).then(setStats).catch(() => {});
    fetch("/api/analytics")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setAnalytics(d))
      .catch(() => {});
  }, []);

  const kpis = [
    { label: "Developments", value: stats.totalProjects, icon: Building2, hint: "Active projects" },
    { label: "Listings", value: stats.totalProperties, icon: Building2, hint: "Properties in portfolio" },
    { label: "Live Tours", value: stats.publishedExperiences, icon: Globe2, hint: "Published experiences" },
    { label: "360° Captures", value: stats.experiences360, icon: Camera, hint: "Panorama tours" },
    { label: "3D Walkthroughs", value: stats.experiences3d, icon: View, hint: "Gaussian splat tours" },
    { label: "Buyer Visits", value: stats.buyerSessions, icon: Users, hint: "Total sessions" },
    { label: "Hot Leads", value: stats.hotLeads, icon: Flame, hint: "Intent score ≥ 80" },
    { label: "Callbacks", value: stats.callbackRequests, icon: Phone, hint: "Requested contact" },
    { label: "Avg Intent", value: `${stats.avgIntentScore}%`, icon: TrendingUp, hint: "Lead intent average" },
    { label: "In Pipeline", value: stats.processingJobs, icon: Sparkles, hint: "Jobs processing" },
  ];

  const tourTotal = Math.max(1, stats.experiences360 + stats.experiences3d);
  const experienceMix = [
    { category: "360° Panorama", share: Math.round((stats.experiences360 / tourTotal) * 100) },
    { category: "3D Walkthrough", share: Math.round((stats.experiences3d / tourTotal) * 100) },
  ].filter((d) => d.share > 0);

  const monthDelta =
    analytics?.sessionsByMonth && analytics.sessionsByMonth.length >= 2
      ? analytics.sessionsByMonth.at(-1)!.visitors - analytics.sessionsByMonth.at(-2)!.visitors
      : undefined;

  return (
    <div className="dashboard-home-enter portfolio-pulse-home">
      <div className="portfolio-pulse-stage">
        <PortfolioPulseHero />

        <div className="dashboard-content-rise space-y-10">
      <div className="kpi-card-grid">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="kpi-stat-card gap-4 py-6">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 px-6 pb-0">
                <CardDescription className="metric-label">{kpi.label}</CardDescription>
                <div className="kpi-stat-icon flex h-10 w-10 items-center justify-center rounded-xl">
                  <Icon className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.75} />
                </div>
              </CardHeader>
              <CardContent className="px-6 pt-1">
                <div className="metric-value">{kpi.value}</div>
                <p className="type-caption mt-2.5">{kpi.hint}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <VisitorsChart
          data={analytics?.sessionsByMonth}
          delta={monthDelta}
          description="Buyer tour sessions — last 12 months from Supabase."
        />
        <TrafficSourcesChart
          data={analytics?.trafficSources?.map((s) => ({ source: s.source, sessions: s.sessions }))}
          title="Acquisition Channels"
          description="Where buyers discover your virtual tours."
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          {experienceMix.length > 0 ? (
            <CategoryRankChart
              data={experienceMix}
              title="Experience Mix"
              description="Published tour types across your portfolio."
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Experience Mix</CardTitle>
                <CardDescription>Publish your first tour to see the breakdown.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild size="sm"><Link href="/dashboard/experiences/new">Start Capture</Link></Button>
              </CardContent>
            </Card>
          )}
        </div>

        <OnlineNow
          liveCount={analytics?.liveNow}
          devices={analytics?.deviceMix}
          delta={monthDelta}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Platform Status</CardTitle>
            <CardDescription>Capture & generation engines</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <span className="flex items-center gap-2 text-sm"><CircleDot className="h-3.5 w-3.5 text-muted-foreground" />360° Stitch Engine</span>
              <Badge variant="success">Operational</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <span className="flex items-center gap-2 text-sm"><CircleDot className="h-3.5 w-3.5 text-muted-foreground" />3D Generation</span>
              <Badge variant={stats.failedGenerations > 0 ? "destructive" : "success"}>
                {stats.failedGenerations > 0 ? `${stats.failedGenerations} failed` : "Operational"}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <span className="text-sm text-muted-foreground">Leads in pipeline</span>
              <span className="font-semibold">{analytics?.totalLeads ?? stats.hotLeads}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Buyer Activity</CardTitle>
          <CardDescription>High-intent events from live tour sessions</CardDescription>
        </CardHeader>
        <CardContent>
          {!stats.recentEvents.length ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed py-12 text-center">
              <Users className="mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="font-medium">No buyer activity yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Publish a virtual tour and share the link — sessions and intent signals will appear here.
              </p>
              <Button className="mt-4" asChild><Link href="/dashboard/experiences">Go to Virtual Tours</Link></Button>
            </div>
          ) : (
            <div className="divide-y rounded-lg border">
              {stats.recentEvents.map((e, i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium capitalize">{e.event_type.replace(/_/g, " ")}</p>
                    {e.payload?.query && <p className="truncate text-xs text-muted-foreground">{e.payload.query}</p>}
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {new Date(e.created_at).toLocaleString()}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
        </div>
      </div>
    </div>
  );
}
