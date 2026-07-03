"use client";

import { useCallback, useEffect, useRef } from "react";
import type {
  BrochureDwellFlushPayload,
  BrochureHeatmapPointFlush,
  BrochurePageDwellFlush,
  BrochureScrollBucketFlush,
  BrochureSection,
  BrochureSectionDwellFlush,
  BrochureTrackingEvent,
} from "@/types/brochure-intelligence";

const FLUSH_INTERVAL_MS = 8000;

function scrollBucket(y: number): string {
  if (y < 0.25) return "0-25";
  if (y < 0.5) return "25-50";
  if (y < 0.75) return "50-75";
  return "75-100";
}

function sectionVisiblePercent(
  section: BrochureSection,
  scrollY: number,
  viewportHeight: number,
  pageHeight: number,
): number {
  const sectionTop = section.y * pageHeight;
  const sectionBottom = (section.y + section.height) * pageHeight;
  const viewTop = scrollY;
  const viewBottom = scrollY + viewportHeight;
  const overlap = Math.max(0, Math.min(sectionBottom, viewBottom) - Math.max(sectionTop, viewTop));
  const sectionPx = section.height * pageHeight;
  return sectionPx > 0 ? Math.min(100, (overlap / sectionPx) * 100) : 0;
}

export function useBrochureTracker({
  sessionId,
  brochureId,
  sections,
  enabled,
  viewerMode = "pdf",
}: {
  sessionId: string;
  brochureId: string;
  sections: BrochureSection[];
  enabled: boolean;
  viewerMode?: "pdf" | "flipbook";
}) {
  const pageDwellRef = useRef<Map<number, BrochurePageDwellFlush>>(new Map());
  const sectionDwellRef = useRef<Map<string, BrochureSectionDwellFlush>>(new Map());
  const scrollRef = useRef<Map<string, BrochureScrollBucketFlush>>(new Map());
  const heatmapRef = useRef<BrochureHeatmapPointFlush[]>([]);
  const eventsRef = useRef<BrochureTrackingEvent[]>([]);
  const activePageRef = useRef<number | null>(null);
  const pageStartRef = useRef<number>(0);
  const zoomRef = useRef(1);
  const scrollYRef = useRef(0);
  const viewportRef = useRef({ w: 0, h: 0 });
  const tickRef = useRef<number | null>(null);

  const queueEvent = useCallback((event: BrochureTrackingEvent) => {
    eventsRef.current.push(event);
  }, []);

  const flush = useCallback(
    async (ended = false) => {
      if (!enabled || !sessionId) return;
      const payload: BrochureDwellFlushPayload = {
        sessionId,
        brochureId,
        pageDwell: [...pageDwellRef.current.values()],
        sectionDwell: [...sectionDwellRef.current.values()],
        scrollDepth: [...scrollRef.current.values()],
        heatmapPoints: [...heatmapRef.current],
        events: [...eventsRef.current],
        ended,
      };
      pageDwellRef.current.clear();
      sectionDwellRef.current.clear();
      scrollRef.current.clear();
      heatmapRef.current = [];
      eventsRef.current = [];

      const body = JSON.stringify(payload);
      if (ended && typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon("/api/brochures/dwell-flush", new Blob([body], { type: "application/json" }));
        return;
      }
      await fetch("/api/brochures/dwell-flush", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: ended,
      });
    },
    [brochureId, enabled, sessionId],
  );

  const tickDwell = useCallback(() => {
    const page = activePageRef.current;
    if (page == null) return;
    const elapsed = 1;
    const pd = pageDwellRef.current.get(page) ?? {
      pageNumber: page,
      seconds: 0,
      viewCount: 0,
      maxScrollPercent: 0,
      maxZoom: 1,
    };
    pd.seconds += elapsed;
    pd.maxZoom = Math.max(pd.maxZoom, zoomRef.current);
    pageDwellRef.current.set(page, pd);

    const pageHeight = viewportRef.current.h * 2 || 800;
    const scrollPct = pageHeight > 0 ? Math.min(100, ((scrollYRef.current + viewportRef.current.h) / pageHeight) * 100) : 0;
    pd.maxScrollPercent = Math.max(pd.maxScrollPercent, scrollPct);

    const bucket = scrollBucket(scrollYRef.current / pageHeight);
    const sk = `${page}-${bucket}`;
    const sb = scrollRef.current.get(sk) ?? { pageNumber: page, scrollBucket: bucket, seconds: 0 };
    sb.seconds += elapsed;
    scrollRef.current.set(sk, sb);

    for (const section of sections.filter((s) => s.page_number === page)) {
      const visible = sectionVisiblePercent(section, scrollYRef.current, viewportRef.current.h, pageHeight);
      if (visible < 20) continue;
      const key = `${page}-${section.section_id}`;
      const sd = sectionDwellRef.current.get(key) ?? {
        pageNumber: page,
        sectionId: section.section_id,
        sectionLabel: section.label,
        visibleSeconds: 0,
        viewCount: 0,
        maxVisiblePercent: 0,
      };
      sd.visibleSeconds += elapsed;
      sd.maxVisiblePercent = Math.max(sd.maxVisiblePercent, visible);
      sectionDwellRef.current.set(key, sd);
    }

    // Sample viewport attention for move-style heatmap (Hotjar-like)
    const attentionY = pageHeight > 0
      ? Math.min(1, Math.max(0, (scrollYRef.current + viewportRef.current.h * 0.45) / pageHeight))
      : 0.5;
    heatmapRef.current.push({
      pageNumber: page,
      eventType: "attention",
      x: 0.5,
      y: attentionY,
      viewportWidth: viewportRef.current.w,
      viewportHeight: viewportRef.current.h,
      zoom: zoomRef.current,
    });
  }, [sections]);

  const setActivePage = useCallback(
    (pageNumber: number) => {
      if (activePageRef.current === pageNumber) return;
      if (activePageRef.current != null) {
        queueEvent({ eventType: "page_left", pageNumber: activePageRef.current });
      }
      activePageRef.current = pageNumber;
      pageStartRef.current = Date.now();
      const pd = pageDwellRef.current.get(pageNumber) ?? {
        pageNumber,
        seconds: 0,
        viewCount: 0,
        maxScrollPercent: 0,
        maxZoom: 1,
      };
      pd.viewCount += 1;
      pageDwellRef.current.set(pageNumber, pd);
      queueEvent({
        eventType: "page_viewed",
        pageNumber,
        payload: { zoom: zoomRef.current, viewerMode },
      });
    },
    [queueEvent, viewerMode],
  );

  const recordClick = useCallback(
    (pageNumber: number, x: number, y: number) => {
      heatmapRef.current.push({
        pageNumber,
        eventType: "click",
        x,
        y,
        viewportWidth: viewportRef.current.w,
        viewportHeight: viewportRef.current.h,
        zoom: zoomRef.current,
      });
      queueEvent({ eventType: "click", pageNumber, x, y, payload: { clickType: "tap" } });
    },
    [queueEvent],
  );

  const recordZoom = useCallback(
    (pageNumber: number, zoom: number) => {
      zoomRef.current = zoom;
      queueEvent({ eventType: "zoom_changed", pageNumber, payload: { zoom } });
    },
    [queueEvent],
  );

  const recordScroll = useCallback((scrollY: number, viewport: { w: number; h: number }) => {
    scrollYRef.current = scrollY;
    viewportRef.current = viewport;
  }, []);

  const recordCta = useCallback(
    (pageNumber: number, ctaType: string) => {
      queueEvent({ eventType: "cta_clicked", pageNumber, payload: { ctaType } });
    },
    [queueEvent],
  );

  const recordDownload = useCallback(
    (pageNumber: number) => {
      queueEvent({ eventType: "download_clicked", pageNumber });
    },
    [queueEvent],
  );

  useEffect(() => {
    if (!enabled) return;
    queueEvent({ eventType: "brochure_opened" });
    tickRef.current = window.setInterval(tickDwell, 1000);
    const flushTimer = window.setInterval(() => void flush(false), FLUSH_INTERVAL_MS);
    const onUnload = () => void flush(true);
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("pagehide", onUnload);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      window.clearInterval(flushTimer);
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("pagehide", onUnload);
      void flush(true);
    };
  }, [enabled, flush, queueEvent, tickDwell]);

  return {
    setActivePage,
    recordClick,
    recordZoom,
    recordScroll,
    recordCta,
    recordDownload,
    flush,
  };
}
