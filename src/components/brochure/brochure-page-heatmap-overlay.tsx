"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  clickPointsToSamples,
  drawHeatmapOverlay,
  mergeHeatmapSamples,
  scrollDepthToSamples,
  sectionDwellToSamples,
  type HeatmapSample,
} from "@/lib/brochure-heatmap-engine";
import type { BrochureSection } from "@/types/brochure-intelligence";

type SectionDwell = {
  page_number: number;
  section_id: string;
  visible_seconds: number;
};

type ScrollRow = {
  page_number: number;
  scroll_bucket: string;
  seconds: number;
};

type HeatPoint = {
  page_number: number;
  x: number;
  y: number;
  event_type?: string;
};

export function BrochurePageHeatmapOverlay({
  pageImage,
  pageNumber,
  mode,
  heatmap,
  sections,
  sectionDwell,
  scrollDepth,
  className,
}: {
  pageImage: string | null;
  pageNumber: number;
  mode: "click" | "scroll" | "attention" | "combined";
  heatmap: HeatPoint[];
  sections: BrochureSection[];
  sectionDwell: SectionDwell[];
  scrollDepth: ScrollRow[];
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const samples = useMemo(() => {
    const pageHeat = heatmap.filter((h) => h.page_number === pageNumber);
    const clickOnly = pageHeat.filter((h) => h.event_type === "click" || h.event_type === "tap");
    const attentionPoints = pageHeat.filter((h) => h.event_type === "attention");
    const clickSamples = clickPointsToSamples(clickOnly);
    const moveSamples = clickPointsToSamples(attentionPoints);
    const attentionSamples = sectionDwellToSamples(sections, sectionDwell, pageNumber);
    const scrollSamples = scrollDepthToSamples(scrollDepth, pageNumber);

    if (mode === "click") return clickSamples;
    if (mode === "attention") return mergeHeatmapSamples(attentionSamples, moveSamples);
    if (mode === "scroll") return scrollSamples;
    return mergeHeatmapSamples(clickSamples, moveSamples, attentionSamples, scrollSamples);
  }, [heatmap, mode, pageNumber, scrollDepth, sectionDwell, sections]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.round(width), height: Math.round(height) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [pageImage]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width < 10 || size.height < 10 || samples.length === 0) return;
    drawHeatmapOverlay(canvas, size.width, size.height, samples);
  }, [samples, size]);

  const hasData = samples.length > 0;

  return (
    <div
      ref={containerRef}
      className={`bi-hotjar-stage relative mx-auto aspect-[3/4] w-full max-w-2xl overflow-hidden rounded-xl border bg-white shadow-lg ${className ?? ""}`}
    >
      {pageImage ? (
        <img src={pageImage} alt={`Brochure page ${pageNumber}`} className="h-full w-full object-contain" />
      ) : (
        <div className="flex h-full items-center justify-center bg-slate-100 text-sm text-muted-foreground">
          Loading page preview…
        </div>
      )}
      {hasData && (
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full mix-blend-multiply"
          aria-hidden
        />
      )}
      {!hasData && pageImage && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/5 text-sm text-muted-foreground">
          No {mode === "combined" ? "engagement" : mode} data on this page yet
        </div>
      )}
      {hasData && (
        <div className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
          {samples.length} signals
        </div>
      )}
    </div>
  );
}
