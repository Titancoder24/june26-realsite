"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { SpatialCommandStats } from "@/components/dashboard/spatial/spatial-command-stats";
import { ConversionFunnelCard } from "@/components/dashboard/spatial/conversion-funnel-card";
import { HotLeadsCard } from "@/components/dashboard/spatial/hot-leads-card";
import { RecentWalkthroughsCard } from "@/components/dashboard/spatial/recent-walkthroughs-card";
import { ExperiencePerformanceCard } from "@/components/dashboard/spatial/experience-performance-card";
import { RoomAnnotationInsightsCard } from "@/components/dashboard/spatial/room-annotation-insights";
import { AnalyticsPrepPanel } from "@/components/dashboard/spatial/analytics-prep-panel";
import { VisitorsChart } from "@/components/visitors-chart";
import { TrafficSourcesChart } from "@/components/traffic-sources-chart";
import { Users } from "lucide-react";

type WalkthroughStatsPayload = {
  walkthroughViews: number;
  activeWalkthroughs: number;
  totalLeads: number;
  scheduledSiteVisits: number;
  avgViewingMinutes: number;
  aiQuestionsAsked: number;
  hotLeads: number;
  avgIntentScore: number;
  funnel: { viewed: number; askedAi: number; clickedContact: number; bookedVisit: number };
  mostViewedRooms: { label: string; count: number }[];
  mostClickedAnnotations: { label: string; count: number }[];
  hotLeadRows: {
    id: string;
    name?: string | null;
    phone?: string | null;
    intent_score?: number | null;
    properties?: { name?: string } | null;
  }[];
  recentWalkthroughs: {
    id: string;
    slug?: string | null;
    status?: string;
    created_at?: string;
    propertyName: string;
  }[];
  experiencePerformance: {
    id: string;
    name: string;
    slug?: string | null;
    status?: string;
    views: number;
  }[];
  recentEvents: { event_type: string; payload?: { query?: string }; created_at: string }[];
  analyticsPrep: {
    timePerScene: { label: string; count: number }[];
    mostRevisitedClip: unknown[];
    annotationDwellTime: unknown[];
    aiQuestionsByRoom: unknown[];
    buyerIntentScore: number;
    siteVisitSources: unknown[];
    note?: string;
  };
};

type AnalyticsPayload = {
  sessionsByMonth?: { month: string; visitors: number }[];
  trafficSources?: { source: string; sessions: number }[];
};

const EMPTY_STATS: WalkthroughStatsPayload = {
  walkthroughViews: 0,
  activeWalkthroughs: 0,
  totalLeads: 0,
  scheduledSiteVisits: 0,
  avgViewingMinutes: 0,
  aiQuestionsAsked: 0,
  hotLeads: 0,
  avgIntentScore: 0,
  funnel: { viewed: 0, askedAi: 0, clickedContact: 0, bookedVisit: 0 },
  mostViewedRooms: [],
  mostClickedAnnotations: [],
  hotLeadRows: [],
  recentWalkthroughs: [],
  experiencePerformance: [],
  recentEvents: [],
  analyticsPrep: {
    timePerScene: [],
    mostRevisitedClip: [],
    annotationDwellTime: [],
    aiQuestionsByRoom: [],
    buyerIntentScore: 0,
    siteVisitSources: [],
  },
};

export function WalkthroughDashboard() {
  const [stats, setStats] = useState<WalkthroughStatsPayload>(EMPTY_STATS);
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/walkthrough-stats").then((r) => r.json()).then(setStats).catch(() => {});
    fetch("/api/analytics")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setAnalytics(d))
      .catch(() => {});
  }, []);

  const monthDelta =
    analytics?.sessionsByMonth && analytics.sessionsByMonth.length >= 2
      ? analytics.sessionsByMonth.at(-1)!.visitors - analytics.sessionsByMonth.at(-2)!.visitors
      : undefined;

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        title="Walkthrough Dashboard"
        description="Property walkthrough engagement, scroll analytics, annotation interactions, and conversion reporting."
        actions={
          <>
            <Button variant="outline" className="w-full sm:w-auto" asChild>
              <Link href="/dashboard/experiences/new">New walkthrough</Link>
            </Button>
            <Button className="w-full sm:w-auto" asChild>
              <Link href="/dashboard/site-visits">Site visits</Link>
            </Button>
          </>
        }
      />

      <div className="stat-card-grid">
        <SpatialCommandStats stats={stats} />
        <ConversionFunnelCard funnel={stats.funnel} />
        <RoomAnnotationInsightsCard rooms={stats.mostViewedRooms} annotations={stats.mostClickedAnnotations} />
        <ExperiencePerformanceCard experiences={stats.experiencePerformance} />
        <HotLeadsCard leads={stats.hotLeadRows} />
        <RecentWalkthroughsCard walkthroughs={stats.recentWalkthroughs} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <VisitorsChart
          data={analytics?.sessionsByMonth}
          delta={monthDelta}
          description="Walkthrough viewer sessions — last 12 months."
        />
        <TrafficSourcesChart
          data={analytics?.trafficSources?.map((s) => ({ source: s.source, sessions: s.sessions }))}
          title="Walkthrough acquisition"
          description="Where buyers discover your property walkthroughs."
        />
      </div>

      <AnalyticsPrepPanel analyticsPrep={stats.analyticsPrep} />

      <Card className="shadow-none dark:ring-0">
        <CardHeader>
          <CardTitle>Recent walkthrough activity</CardTitle>
          <CardDescription>Viewer events from cinematic walkthrough sessions</CardDescription>
        </CardHeader>
        <CardContent>
          {!stats.recentEvents.length ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed py-12 text-center">
              <Users className="mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="font-medium">No walkthrough activity yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Publish a property walkthrough and share the link — engagement signals will appear here.
              </p>
              <Button className="mt-4" asChild>
                <Link href="/dashboard/experiences">Go to experiences</Link>
              </Button>
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
  );
}
