"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Building2, MapPin } from "lucide-react";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { CategoryRankChart } from "@/components/category-rank-chart";
import { VisitorsChart } from "@/components/visitors-chart";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<{ id: string; name: string; city?: string; properties?: { count: number }[]; walkthrough_count?: number }[]>([]);
  const [analytics, setAnalytics] = useState<{ sessionsByMonth?: { month: string; visitors: number }[] } | null>(null);

  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then(setProjects).catch(() => {});
    fetch("/api/analytics").then((r) => (r.ok ? r.json() : null)).then((d) => d && setAnalytics(d)).catch(() => {});
  }, []);

  const totalProperties = projects.reduce((s, p) => s + (Array.isArray(p.properties) ? p.properties.length : 0), 0);

  const portfolioMix = useMemo(() => {
    if (!projects.length) return [];
    const total = Math.max(1, totalProperties);
    return projects
      .map((p) => ({
        category: p.name,
        share: Math.round(((Array.isArray(p.properties) ? p.properties.length : 0) / total) * 100),
      }))
      .filter((d) => d.share > 0)
      .slice(0, 5);
  }, [projects, totalProperties]);

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Developments"
        description="Manage project portfolios and track listing distribution."
        actions={<Button className="w-full sm:w-auto" asChild><Link href="/dashboard/projects/new">New Development</Link></Button>}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="metric-label">Total Developments</CardTitle></CardHeader>
          <CardContent><p className="metric-value metric-value--compact">{projects.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="metric-label">Total Listings</CardTitle></CardHeader>
          <CardContent><p className="metric-value metric-value--compact">{totalProperties}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="metric-label">Avg Listings / Dev</CardTitle></CardHeader>
          <CardContent><p className="metric-value metric-value--compact">{projects.length ? Math.round(totalProperties / projects.length) : 0}</p></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {portfolioMix.length > 0 && (
          <CategoryRankChart data={portfolioMix} title="Listing Distribution" description="Share of listings per development." />
        )}
        <VisitorsChart
          data={analytics?.sessionsByMonth}
          description="Buyer sessions across all developments."
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {projects.map((p) => (
          <Card key={p.id} className="border-border/60 shadow-sm transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  {p.city && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />{p.city}
                    </p>
                  )}
                </div>
              </div>
              {p.city && <Badge variant="secondary">{p.city}</Badge>}
            </CardHeader>
            <CardContent className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {Array.isArray(p.properties) ? p.properties.length : 0} listings
                {(p.walkthrough_count ?? 0) > 0 ? ` · ${p.walkthrough_count} walkthrough${p.walkthrough_count === 1 ? "" : "s"}` : ""}
              </span>
              <div className="flex items-center gap-3">
                {(p.walkthrough_count ?? 0) > 0 && (
                  <Link href="/dashboard/experiences" className="font-medium text-primary hover:underline">Walkthroughs</Link>
                )}
                <Link href={`/dashboard/properties?projectId=${p.id}`} className="font-medium text-primary hover:underline">View listings →</Link>
              </div>
            </CardContent>
          </Card>
        ))}
        {!projects.length && (
          <Card className="col-span-full border-dashed">
            <CardContent className="flex flex-col items-center py-16 text-center">
              <Building2 className="mb-4 h-12 w-12 text-muted-foreground/40" />
              <p className="font-medium">No developments yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Create your first development to start adding listings and virtual tours.</p>
              <Button className="mt-4" asChild><Link href="/dashboard/projects/new">Create Development</Link></Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
