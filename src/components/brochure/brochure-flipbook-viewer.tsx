"use client";

import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import HTMLFlipBook from "react-pageflip";
import { useBrochureTracker } from "@/lib/brochure-tracking-client";
import { loadBrochurePdf, renderPdfPageToDataUrl } from "@/lib/brochure-pdf-renderer";
import { BrochureViewerShell } from "@/components/brochure/brochure-viewer-shell";
import { playFlipbookSound, resolveFlipbookSettings } from "@/lib/brochure-flipbook-options";
import type { BrochureCta, BrochureFlipbookSettings, BrochureSection } from "@/types/brochure-intelligence";

type FlipPageProps = {
  src: string;
  pageNumber: number;
  sections: BrochureSection[];
  onTap: (pageNumber: number, x: number, y: number) => void;
};

const FlipPage = forwardRef<HTMLDivElement, FlipPageProps>(function FlipPage(
  { src, pageNumber, sections, onTap },
  ref,
) {
  return (
    <div ref={ref} className="bi-flip-page relative h-full w-full bg-white" data-page={pageNumber}>
      <img
        src={src}
        alt={`Page ${pageNumber}`}
        className="h-full w-full object-contain"
        draggable={false}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width;
          const y = (e.clientY - rect.top) / rect.height;
          onTap(pageNumber, x, y);
        }}
      />
      {sections.map((section) => (
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
  );
});

export function BrochureFlipbookViewer({
  fileUrl,
  sessionId,
  brochureId,
  pageCount,
  sections = [],
  ctas = [],
  title,
  flipbookSettings,
}: {
  fileUrl: string;
  sessionId: string;
  brochureId: string;
  pageCount: number;
  sections?: BrochureSection[];
  ctas?: BrochureCta[];
  title: string;
  flipbookSettings?: BrochureFlipbookSettings;
}) {
  const bookRef = useRef<{ pageFlip: () => { flipNext: () => void; flipPrev: () => void; getCurrentPageIndex: () => number } }>(null);
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [bookSize, setBookSize] = useState({ width: 420, height: 594 });
  const { sound, preset } = useMemo(() => resolveFlipbookSettings(flipbookSettings), [flipbookSettings]);

  const tracker = useBrochureTracker({
    sessionId,
    brochureId,
    sections,
    enabled: Boolean(sessionId),
    viewerMode: "flipbook",
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const pdf = await loadBrochurePdf(fileUrl);
      const scale = typeof window !== "undefined" && window.innerWidth < 768 ? 1.1 : 1.35;
      const urls: string[] = [];
      for (let i = 1; i <= pageCount; i++) {
        urls.push(await renderPdfPageToDataUrl(pdf, i, scale));
      }
      if (cancelled) return;
      const firstPage = await pdf.getPage(1);
      const vp = firstPage.getViewport({ scale: 1 });
      const maxW = Math.min(window.innerWidth - 32, 520);
      const maxH = Math.min(window.innerHeight - 220, 720);
      let w = maxW;
      let h = (vp.height / vp.width) * w;
      if (h > maxH) {
        h = maxH;
        w = (vp.width / vp.height) * h;
      }
      setBookSize({ width: Math.round(w), height: Math.round(h) });
      setPageImages(urls);
      setLoading(false);
      tracker.setActivePage(1);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl, pageCount]);

  const onTap = useCallback(
    (pageNumber: number, x: number, y: number) => {
      tracker.recordClick(pageNumber, x, y);
    },
    [tracker],
  );

  const sectionsByPage = useMemo(() => {
    const map = new Map<number, BrochureSection[]>();
    for (const s of sections) {
      const list = map.get(s.page_number) ?? [];
      list.push(s);
      map.set(s.page_number, list);
    }
    return map;
  }, [sections]);

  const flipTo = (next: number) => {
    const api = bookRef.current?.pageFlip();
    if (!api) return;
    if (next > page) api.flipNext();
    else api.flipPrev();
  };

  if (loading) {
    return (
      <div className="bi-viewer-shell flex items-center justify-center">
        <p className="text-sm text-white/60">Preparing flipbook…</p>
      </div>
    );
  }

  return (
    <BrochureViewerShell
      title={title}
      page={page}
      pageCount={pageCount}
      viewerMode="flipbook"
      ctas={ctas}
      fileUrl={fileUrl}
      onDownload={() => {
        tracker.recordDownload(page);
        window.open(fileUrl, "_blank");
      }}
      onPrev={() => flipTo(page - 1)}
      onNext={() => flipTo(page + 1)}
      canPrev={page > 1}
      canNext={page < pageCount}
      tracker={tracker}
    >
      <div className="bi-flipbook-stage">
        <div className="bi-flipbook-wrap">
          <HTMLFlipBook
            ref={bookRef}
            width={bookSize.width}
            height={bookSize.height}
            size="fixed"
            minWidth={280}
            maxWidth={560}
            minHeight={400}
            maxHeight={800}
            showCover={preset.showCover}
            drawShadow={preset.drawShadow}
            flippingTime={preset.flipTime}
            maxShadowOpacity={preset.maxShadowOpacity}
            mobileScrollSupport
            className={`brochure-flipbook ${preset.className}`}
            onFlip={(e) => {
              const idx = typeof e.data === "number" ? e.data : 0;
              const pageNum = Math.min(pageCount, idx + 1);
              setPage(pageNum);
              tracker.setActivePage(pageNum);
              playFlipbookSound(sound.id);
            }}
          >
            {pageImages.map((src, i) => (
              <FlipPage
                key={src.slice(0, 32) + i}
                src={src}
                pageNumber={i + 1}
                sections={sectionsByPage.get(i + 1) ?? []}
                onTap={onTap}
              />
            ))}
          </HTMLFlipBook>
        </div>
      </div>
    </BrochureViewerShell>
  );
}
