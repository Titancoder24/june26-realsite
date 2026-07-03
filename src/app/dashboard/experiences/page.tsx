"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Camera, Compass, Globe } from "lucide-react";
import { CategoryRankChart } from "@/components/category-rank-chart";
import { TrafficSourcesChart } from "@/components/traffic-sources-chart";
import { shouldShowImageWalkthroughInDashboard } from "@/lib/image-walkthrough-approval";

export default function ExperiencesPage() {
  const [experiences, setExperiences] = useState<{
    id: string;
    type: string;
    status: string;
    slug: string;
    properties?: { name: string };
    published_url?: string;
    property_id?: string;
    walkthrough_summary?: {
      scene_count: number;
      motion_clip_count: number;
      preview_video_url: string | null;
      poster_url: string | null;
    } | null;
  }[]>([]);
  const [analytics, setAnalytics] = useState<{ trafficSources?: { source: string; sessions: number }[] } | null>(null);

  useEffect(() => {
    fetch("/api/experiences").then((r) => r.json()).then(setExperiences).catch(() => {});
    fetch("/api/analytics").then((r) => (r.ok ? r.json() : null)).then((d) => d && setAnalytics(d)).catch(() => {});
  }, []);

  const published = experiences.filter((e) => e.status === "published").length;
  const is3d = (t: string) => t === "worldlabs_splat" || t === "immersive_world";
  const isSceneStudio = (t: string) => t === "scene_intelligence";
  const isWalkthrough = (t: string) => t === "cinematic_walkthrough";
  const isImageWalkthrough = (t: string) => t === "image_walkthrough";
  const isCinematic = (t: string) => isSceneStudio(t) || isWalkthrough(t);
  const tours360 = experiences.filter((e) => !is3d(e.type) && !isCinematic(e.type) && !isImageWalkthrough(e.type)).length;
  const walkthroughs = experiences.filter((e) => isWalkthrough(e.type)).length;
  const sceneStudio = experiences.filter((e) => isSceneStudio(e.type)).length;
  const tours3d = experiences.filter((e) => is3d(e.type)).length;

  const visibleExperiences = experiences.filter((e) =>
    !isImageWalkthrough(e.type) || shouldShowImageWalkthroughInDashboard(e),
  );

  const statusMix = useMemo(() => {
    const draft = visibleExperiences.filter((e) => e.status !== "published").length;
    const total = Math.max(1, visibleExperiences.length);
    return [
      { category: "Published", share: Math.round((published / total) * 100) },
      { category: "Draft", share: Math.round((draft / total) * 100) },
    ].filter((d) => d.share > 0);
  }, [visibleExperiences, published]);

  const typeMix = useMemo(() => {
    const total = Math.max(1, tours360 + tours3d + walkthroughs + sceneStudio);
    return [
      { category: "360° Panorama", share: Math.round((tours360 / total) * 100) },
      { category: "3D Walkthrough", share: Math.round((tours3d / total) * 100) },
      { category: "AI Walkthrough", share: Math.round((walkthroughs / total) * 100) },
      { category: "Scene Studio", share: Math.round((sceneStudio / total) * 100) },
    ].filter((d) => d.share > 0);
  }, [tours360, tours3d, walkthroughs, sceneStudio]);

  return (
    <div className="bi-dashboard bi-module-shell p-6">
      <div className="bi-module-hero">
        <div>
          <p className="bi-module-kicker">360 Capture</p>
          <h1>Virtual tour command center</h1>
          <p>Track 360 captures, 3D walkthroughs, scene studios, publish status, and buyer traffic with the same report design as Brochure Reports.</p>
        </div>
        <Button className="w-full sm:w-auto" asChild><Link href="/dashboard/experiences/new">Launch 360° Capture</Link></Button>
      </div>

      <div className="kpi-card-grid kpi-card-grid--compact">
        <Card className="bi-finance-card bi-finance-card-blue"><CardHeader className="pb-2"><CardTitle className="metric-label">Total Tours</CardTitle></CardHeader><CardContent><p className="metric-value">{experiences.length}</p></CardContent></Card>
        <Card className="bi-finance-card bi-finance-card-green"><CardHeader className="pb-2"><CardTitle className="metric-label">Published</CardTitle></CardHeader><CardContent><p className="metric-value text-primary">{published}</p></CardContent></Card>
        <Card className="bi-finance-card bi-finance-card-orange"><CardHeader className="pb-2"><CardTitle className="metric-label">360° Captures</CardTitle></CardHeader><CardContent><p className="metric-value">{tours360}</p></CardContent></Card>
        <Card className="bi-finance-card bi-finance-card-purple"><CardHeader className="pb-2"><CardTitle className="metric-label">3D Walkthroughs</CardTitle></CardHeader><CardContent><p className="metric-value">{tours3d}</p></CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {statusMix.length > 0 && <CategoryRankChart data={statusMix} title="Publish Status" description="Published vs draft tours." />}
        {typeMix.length > 0 && <CategoryRankChart data={typeMix} title="Tour Format" description="360° panorama vs 3D splat experiences." />}
        <TrafficSourcesChart
          data={analytics?.trafficSources}
          title="Tour Traffic Sources"
          description="How buyers reach your published tours."
        />
      </div>

      <div className="space-y-3">
        {visibleExperiences.map((e) => (
          <Card key={e.id} className="bi-finance-card border-border/60">
            {e.type === "cinematic_walkthrough" && (e.walkthrough_summary?.preview_video_url || e.walkthrough_summary?.poster_url) && (
              <div className="border-b bg-muted/30 px-4 pt-4">
                {e.walkthrough_summary?.preview_video_url ? (
                  <video
                    src={e.walkthrough_summary.preview_video_url}
                    className="aspect-video w-full rounded-md bg-black object-cover"
                    muted
                    playsInline
                    controls
                    preload="metadata"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={e.walkthrough_summary?.poster_url ?? ""}
                    alt=""
                    className="aspect-video w-full rounded-md object-cover"
                  />
                )}
                {e.walkthrough_summary && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {e.walkthrough_summary.motion_clip_count}/{e.walkthrough_summary.scene_count} motion clips ready
                  </p>
                )}
              </div>
            )}
            <CardHeader className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {isCinematic(e.type) ? <Compass className="h-5 w-5" /> : is3d(e.type) ? <Globe className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base truncate">{e.properties?.name ?? "Property"}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {e.type === "cinematic_walkthrough" ? "Property Walkthrough" : e.type === "image_walkthrough" ? "Image Walkthrough" : e.type === "scene_intelligence" ? "Scene Intelligence Studio" : e.type === "immersive_world" ? "Immersive World" : is3d(e.type) ? "3D Walkthrough" : "360° Panorama Tour"}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Badge variant={e.status === "published" ? "success" : "secondary"}>{e.status}</Badge>
                {e.type === "cinematic_walkthrough" && e.slug && (
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={`/walkthrough/${e.slug}${e.status === "published" ? "" : "?preview=1"}`} target="_blank" rel="noopener noreferrer">
                      View
                    </Link>
                  </Button>
                )}
                <Button size="sm" variant="outline" asChild>
                  <Link href={
                    e.type === "cinematic_walkthrough"
                      ? `/dashboard/walkthrough/${e.id}?propertyId=${e.property_id ?? ""}`
                      : e.type === "image_walkthrough" && e.published_url
                        ? e.published_url
                        : `/dashboard/experiences/builder?type=${e.type}&id=${e.id}&propertyId=${e.property_id ?? ""}`
                  }>
                    {e.type === "cinematic_walkthrough"
                      ? "Open Walkthrough"
                      : e.type === "image_walkthrough"
                        ? "View Image Walkthrough"
                        : "Edit Tour"}
                  </Link>
                </Button>
              </div>
            </CardHeader>
            {e.published_url && <CardContent className="pt-0 text-xs text-muted-foreground break-all">{e.published_url}</CardContent>}
          </Card>
        ))}
        {!visibleExperiences.length && (
          <Card className="bi-finance-card border-dashed">
            <CardContent className="flex flex-col items-center py-16 text-center">
              <Compass className="mb-4 h-12 w-12 text-muted-foreground/40" />
              <p className="font-medium">No virtual tours yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Capture a 360° panorama or generate a 3D walkthrough for your first listing.</p>
              <Button className="mt-4" asChild><Link href="/dashboard/experiences/new">Start 360° Capture</Link></Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
