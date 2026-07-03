"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBrochureTracker } from "@/lib/brochure-tracking-client";
import { loadBrochurePdf, renderPdfPageToCanvas } from "@/lib/brochure-pdf-renderer";
import { BrochureViewerShell } from "@/components/brochure/brochure-viewer-shell";
import type { BrochureCta, BrochureSection } from "@/types/brochure-intelligence";

export function BrochureViewer({
  fileUrl,
  sessionId,
  brochureId,
  pageCount,
  sections = [],
  ctas = [],
  title,
}: {
  fileUrl: string;
  sessionId: string;
  brochureId: string;
  pageCount: number;
  sections?: BrochureSection[];
  ctas?: BrochureCta[];
  title: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfRef = useRef<any>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);

  const tracker = useBrochureTracker({
    sessionId,
    brochureId,
    sections,
    enabled: Boolean(sessionId),
  });

  const renderPage = useCallback(
    async (pageNum: number, scale: number) => {
      const pdf = pdfRef.current;
      const canvas = canvasRef.current;
      if (!pdf || !canvas) return;
      await renderPdfPageToCanvas(pdf, pageNum, scale, canvas);
      tracker.setActivePage(pageNum);
      tracker.recordZoom(pageNum, scale);
    },
    [tracker],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const pdf = await loadBrochurePdf(fileUrl);
      if (cancelled) return;
      pdfRef.current = pdf;
      setLoading(false);
      await renderPage(1, zoom);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl]);

  useEffect(() => {
    if (!loading) void renderPage(page, zoom);
  }, [page, zoom, loading, renderPage]);

  const onScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    tracker.recordScroll(el.scrollTop, { w: el.clientWidth, h: el.clientHeight });
  };

  const pageSections = sections.filter((s) => s.page_number === page);

  return (
    <BrochureViewerShell
      title={title}
      page={page}
      pageCount={pageCount}
      viewerMode="pdf"
      ctas={ctas}
      fileUrl={fileUrl}
      zoom={zoom}
      onZoomIn={() => setZoom((z) => Math.min(2.5, z + 0.25))}
      onZoomOut={() => setZoom((z) => Math.max(0.75, z - 0.25))}
      onDownload={() => {
        tracker.recordDownload(page);
        window.open(fileUrl, "_blank");
      }}
      onPrev={() => setPage((p) => Math.max(1, p - 1))}
      onNext={() => setPage((p) => Math.min(pageCount, p + 1))}
      canPrev={page > 1}
      canNext={page < pageCount}
      tracker={tracker}
    >
      <div
        ref={containerRef}
        className="relative min-h-[50vh] overflow-auto"
        onScroll={onScroll}
        onClick={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width;
          const y =
            (e.clientY - rect.top + (containerRef.current?.scrollTop ?? 0)) /
            (canvasRef.current?.height ?? rect.height);
          tracker.recordClick(page, Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y)));
        }}
      >
        {loading ? (
          <div className="flex h-64 items-center justify-center text-white/60">Loading brochure…</div>
        ) : (
          <div className="relative mx-auto w-fit">
            <canvas ref={canvasRef} className="max-w-full rounded-lg shadow-2xl" />
            {pageSections.map((section) => (
              <div
                key={section.section_id}
                className="bi-section-overlay"
                style={{
                  left: `${section.x * 100}%`,
                  top: `${section.y * 100}%`,
                  width: `${section.width * 100}%`,
                  height: `${section.height * 100}%`,
                }}
                title={section.label}
              />
            ))}
          </div>
        )}
      </div>
    </BrochureViewerShell>
  );
}
