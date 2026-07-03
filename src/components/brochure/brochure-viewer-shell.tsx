"use client";

import { ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BrochureCta } from "@/types/brochure-intelligence";
import { handleBrochureCta } from "@/lib/brochure-ui-utils";

export function BrochureViewerShell({
  title,
  page,
  pageCount,
  viewerMode,
  ctas,
  fileUrl,
  zoom,
  onZoomIn,
  onZoomOut,
  onDownload,
  onPrev,
  onNext,
  canPrev,
  canNext,
  tracker,
  children,
}: {
  title: string;
  page: number;
  pageCount: number;
  viewerMode: "pdf" | "flipbook";
  ctas: BrochureCta[];
  fileUrl: string;
  zoom?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onDownload: () => void;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  tracker: { recordCta: (p: number, t: string) => void; recordDownload: (p: number) => void };
  children: React.ReactNode;
}) {
  return (
    <div className="bi-viewer-shell">
      <header className="bi-viewer-header">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="text-xs text-white/55">
            {viewerMode === "flipbook" ? "Flipbook" : "PDF"} · Page {page} of {pageCount}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {viewerMode === "pdf" && onZoomOut && onZoomIn && (
            <>
              <Button size="icon" variant="ghost" className="text-white hover:bg-white/10" onClick={onZoomOut}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="px-1 text-xs text-white/50">{Math.round((zoom ?? 1) * 100)}%</span>
              <Button size="icon" variant="ghost" className="text-white hover:bg-white/10" onClick={onZoomIn}>
                <ZoomIn className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button size="icon" variant="ghost" className="text-white hover:bg-white/10" onClick={onDownload}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="bi-viewer-body">{children}</div>

      <footer className="bi-viewer-footer">
        {ctas.length > 0 && (
          <div className="bi-cta-row">
            {ctas.map((cta) => (
              <Button
                key={`${cta.type}-${cta.label}`}
                size="sm"
                variant="secondary"
                onClick={() => handleBrochureCta(cta, page, fileUrl, tracker)}
              >
                {cta.label}
              </Button>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" className="text-white hover:bg-white/10" disabled={!canPrev} onClick={onPrev}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Previous
          </Button>
          <Button variant="ghost" className="text-white hover:bg-white/10" disabled={!canNext} onClick={onNext}>
            Next <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </footer>
    </div>
  );
}
