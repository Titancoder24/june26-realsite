"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrochurePageHeatmapOverlay } from "@/components/brochure/brochure-page-heatmap-overlay";
import { BrochureScrollHeatmap } from "@/components/brochure/brochure-scroll-heatmap";
import { loadBrochurePdf, renderPdfPageToDataUrl } from "@/lib/brochure-pdf-renderer";
import { formatBrochureDuration } from "@/lib/brochure-ui-utils";
import type { BrochureSection } from "@/types/brochure-intelligence";

type HeatPoint = { page_number: number; x: number; y: number; event_type: string };
type PageDwell = { page_number: number; seconds: number; view_count: number; max_zoom: number };
type SectionDwell = {
  page_number: number;
  section_id: string;
  section_label?: string | null;
  visible_seconds: number;
  max_visible_percent: number;
};
type ScrollRow = { page_number: number; scroll_bucket: string; seconds: number };

export function BrochureHeatmap({
  fileUrl,
  sections,
  heatmap,
  pageDwell,
  sectionDwell,
  scrollDepth,
  title = "Brochure Heatmap",
  description = "Hotjar-style overlay on your uploaded brochure — see exactly where buyers click, scroll, and focus.",
}: {
  fileUrl?: string;
  sections: BrochureSection[];
  heatmap: HeatPoint[];
  pageDwell: PageDwell[];
  sectionDwell: SectionDwell[];
  scrollDepth: ScrollRow[];
  title?: string;
  description?: string;
}) {
  const rankedPages = useMemo(
    () => [...pageDwell].sort((a, b) => b.seconds - a.seconds).map((p) => p.page_number),
    [pageDwell],
  );
  const allPages = useMemo(() => {
    const fromDwell = pageDwell.map((p) => p.page_number);
    const fromHeat = heatmap.map((h) => h.page_number);
    const fromScroll = scrollDepth.map((s) => s.page_number);
    const unique = [...new Set([...fromDwell, ...fromHeat, ...fromScroll])].sort((a, b) => a - b);
    return unique.length ? unique : [1];
  }, [heatmap, pageDwell, scrollDepth]);

  const [pageNumber, setPageNumber] = useState(allPages[0] ?? 1);
  const [pageImage, setPageImage] = useState<string | null>(null);
  const [mode, setMode] = useState<"combined" | "click" | "scroll" | "attention">("combined");

  useEffect(() => {
    if (!allPages.includes(pageNumber)) {
      setPageNumber(allPages[0] ?? 1);
    }
  }, [allPages, pageNumber]);

  useEffect(() => {
    if (!fileUrl) return;
    let cancelled = false;
    void (async () => {
      const pdf = await loadBrochurePdf(fileUrl);
      const url = await renderPdfPageToDataUrl(pdf, pageNumber, 1.35);
      if (!cancelled) setPageImage(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [fileUrl, pageNumber]);

  const pagePoints = heatmap.filter((h) => h.page_number === pageNumber);
  const currentDwell = pageDwell.find((p) => p.page_number === pageNumber);
  const topSection = sectionDwell
    .filter((s) => s.page_number === pageNumber)
    .sort((a, b) => b.visible_seconds - a.visible_seconds)[0];
  const pageList = rankedPages.length ? rankedPages : allPages;

  return (
    <Card className="bi-finance-card">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
            <TabsList className="bi-module-tabs h-auto rounded-full bg-white p-1">
              <TabsTrigger value="combined">All activity</TabsTrigger>
              <TabsTrigger value="click">Clicks</TabsTrigger>
              <TabsTrigger value="attention">Sections</TabsTrigger>
              <TabsTrigger value="scroll">Scroll</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <div className="bi-heatmap-layout">
          <aside className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pages by time</p>
            <div className="max-h-96 space-y-1 overflow-y-auto">
              {pageList.map((pn) => {
                const dwell = pageDwell.find((p) => p.page_number === pn);
                const clicks = heatmap.filter((h) => h.page_number === pn).length;
                return (
                  <button
                    key={pn}
                    type="button"
                    onClick={() => setPageNumber(pn)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      pageNumber === pn ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                  >
                    <span className="font-medium">Page {pn}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {dwell ? formatBrochureDuration(dwell.seconds) : "—"}
                      {dwell ? ` · ${dwell.view_count} views` : ""}
                      {clicks > 0 ? ` · ${clicks} clicks` : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Page {pageNumber}</p>
              <span className="bi-soft-select capitalize">{mode.replace("_", " ")} heatmap</span>
            </div>

            {mode === "scroll" ? (
              <div className="rounded-xl border bg-slate-50 p-4">
                <BrochureScrollHeatmap scrollDepth={scrollDepth} pageNumber={pageNumber} />
              </div>
            ) : (
              <BrochurePageHeatmapOverlay
                pageImage={pageImage}
                pageNumber={pageNumber}
                mode={mode}
                heatmap={heatmap}
                sections={sections}
                sectionDwell={sectionDwell}
                scrollDepth={scrollDepth}
              />
            )}

            <div className="bi-heatmap-legend">
              <span>Low</span>
              <div className="bi-heatmap-legend-bar" />
              <span>High</span>
            </div>
          </div>

          <aside className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Page stats</p>
              <ul className="mt-2 space-y-1">
                <li>Time: {formatBrochureDuration(currentDwell?.seconds ?? 0)}</li>
                <li>Views: {currentDwell?.view_count ?? 0}</li>
                <li>Max zoom: {Number(currentDwell?.max_zoom ?? 1).toFixed(1)}x</li>
                <li>Clicks: {pagePoints.length}</li>
              </ul>
            </div>
            {topSection && (
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Hottest section</p>
                <p className="mt-1 font-medium">{topSection.section_label}</p>
                <p className="text-muted-foreground">
                  {formatBrochureDuration(topSection.visible_seconds)} visible
                </p>
              </div>
            )}
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">How to read this</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Red zones show the highest buyer attention — clicks, visible sections, and scroll depth combined on your uploaded PDF.
              </p>
            </div>
          </aside>
        </div>
      </CardContent>
    </Card>
  );
}
