"use client";

import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import HTMLFlipBook from "react-pageflip";
import { ChevronLeft, ChevronRight, Download, ExternalLink, RotateCcw, Volume2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { loadBrochurePdf, renderPdfPageToCanvas, renderPdfPageToDataUrl } from "@/lib/brochure-pdf-renderer";
import {
  FLIPBOOK_PRESET_OPTIONS,
  FLIPBOOK_SOUND_OPTIONS,
  playFlipbookSound,
  resolveFlipbookSettings,
} from "@/lib/brochure-flipbook-options";
import type {
  BrochureFlipbookPresetId,
  BrochureFlipbookSettings,
  BrochureFlipbookSoundId,
  BrochureViewerMode,
} from "@/types/brochure-intelligence";

type PreviewFlipPageProps = {
  src: string;
  pageNumber: number;
};

const PreviewFlipPage = forwardRef<HTMLDivElement, PreviewFlipPageProps>(function PreviewFlipPage(
  { src, pageNumber },
  ref,
) {
  return (
    <div ref={ref} className="bi-preview-flip-page">
      <img src={src} alt={`Flipbook preview page ${pageNumber}`} draggable={false} />
      <span>Page {pageNumber}</span>
    </div>
  );
});

export function BrochureExperiencePreview({
  fileUrl,
  title,
  pageCount,
  flipbookSettings,
  viewerMode = "pdf",
  savingSettings = false,
  onViewerModeChange,
  onFlipbookSettingsChange,
}: {
  fileUrl: string;
  title: string;
  pageCount: number;
  flipbookSettings?: BrochureFlipbookSettings;
  viewerMode?: BrochureViewerMode;
  savingSettings?: boolean;
  onViewerModeChange?: (mode: BrochureViewerMode) => void;
  onFlipbookSettingsChange?: (settings: Partial<BrochureFlipbookSettings>) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const bookRef = useRef<{ pageFlip: () => { flipNext: () => void; flipPrev: () => void; getCurrentPageIndex: () => number } }>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1.15);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flipImages, setFlipImages] = useState<string[]>([]);
  const [flipLoading, setFlipLoading] = useState(false);
  const { sound, preset } = resolveFlipbookSettings(flipbookSettings);

  const hasValidPdf = Boolean(fileUrl && pageCount > 0);

  const renderPage = useCallback(async () => {
    const pdf = pdfRef.current;
    const canvas = canvasRef.current;
    if (!pdf || !canvas) return;
    await renderPdfPageToCanvas(pdf, page, zoom, canvas);
  }, [page, zoom]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!hasValidPdf) {
        setLoading(false);
        setError("Brochure PDF URL is missing. Re-open this brochure from the list or upload it again.");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const pdf = await loadBrochurePdf(fileUrl);
        if (cancelled) return;
        pdfRef.current = pdf;
        await renderPage();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not render PDF preview");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl, pageCount]);

  useEffect(() => {
    if (!loading) void renderPage().catch((err) => {
      setError(err instanceof Error ? err.message : "Could not render PDF page");
    });
  }, [loading, renderPage]);

  const loadFlipbook = async () => {
    if (!hasValidPdf) {
      setError("Brochure PDF URL is missing. Flipbook preview cannot be prepared.");
      return;
    }
    if (flipImages.length || flipLoading) return;
    const pdf = pdfRef.current ?? (await loadBrochurePdf(fileUrl));
    pdfRef.current = pdf;
    setFlipLoading(true);
    try {
      const images: string[] = [];
      for (let i = 1; i <= pageCount; i++) {
        images.push(await renderPdfPageToDataUrl(pdf, i, 0.9));
      }
      setFlipImages(images);
    } finally {
      setFlipLoading(false);
    }
  };

  return (
    <Card className="bi-card overflow-hidden">
      <CardHeader className="bi-preview-header">
        <div>
          <CardTitle>PDF Viewer & Flipbook Test</CardTitle>
          <p className="text-sm text-muted-foreground">
            Review {title} like an Acrobat-style PDF and test the buyer flipbook experience before sharing.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <a href={fileUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1 h-4 w-4" /> Open original
            </a>
          </Button>
          <Button asChild size="sm">
            <a href={fileUrl} target="_blank" rel="noreferrer" download>
              <Download className="mr-1 h-4 w-4" /> Download
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="bi-viewer-settings-panel">
          <div>
            <p className="text-sm font-semibold text-foreground">Viewer settings</p>
            <p className="text-xs text-muted-foreground">
              Choose the buyer viewer, then tune flipbook sound and interaction before sharing.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Buyer viewer</Label>
              <Select
                value={viewerMode}
                onValueChange={(v) => onViewerModeChange?.(v as BrochureViewerMode)}
                disabled={savingSettings || !onViewerModeChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">Standard PDF</SelectItem>
                  <SelectItem value="flipbook">Flipbook</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Page-turn sound</Label>
              <div className="flex gap-2">
                <Select
                  value={sound.id}
                  onValueChange={(v) => {
                    const soundId = v as BrochureFlipbookSoundId;
                    onFlipbookSettingsChange?.({ soundId });
                    playFlipbookSound(soundId);
                  }}
                  disabled={savingSettings || !onFlipbookSettingsChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FLIPBOOK_SOUND_OPTIONS.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Test flipbook sound"
                  onClick={() => playFlipbookSound(sound.id)}
                  disabled={sound.id === "none"}
                >
                  <Volume2 className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{sound.description}</p>
            </div>
            <div className="space-y-2">
              <Label>Flipbook style</Label>
              <Select
                value={preset.id}
                onValueChange={(v) => onFlipbookSettingsChange?.({ presetId: v as BrochureFlipbookPresetId })}
                disabled={savingSettings || !onFlipbookSettingsChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FLIPBOOK_PRESET_OPTIONS.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{preset.description}</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="pdf" onValueChange={(v) => {
          if (v === "flipbook") void loadFlipbook();
        }}>
          <TabsList>
            <TabsTrigger value="pdf">PDF Preview</TabsTrigger>
            <TabsTrigger value="flipbook">Flipbook Test</TabsTrigger>
          </TabsList>

          <TabsContent value="pdf" className="mt-4">
            <div className="bi-acrobat-shell">
              <aside className="bi-acrobat-thumbs">
                {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={p === page ? "is-active" : ""}
                    onClick={() => setPage(p)}
                  >
                    <span>Page</span>
                    {p}
                  </button>
                ))}
              </aside>
              <section className="bi-acrobat-main">
                <div className="bi-acrobat-toolbar">
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="px-2 text-sm font-medium">
                      {page} / {pageCount}
                    </span>
                    <Button size="icon" variant="ghost" disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setZoom((z) => Math.max(0.6, z - 0.15))}>
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="w-14 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
                    <Button size="icon" variant="ghost" onClick={() => setZoom((z) => Math.min(2.2, z + 0.15))}>
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setZoom(1.15)}>
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="bi-acrobat-canvas-wrap">
                  {loading && <div className="bi-annotator-loading">Loading PDF preview...</div>}
                  {error && (
                    <div className="bi-annotator-error">
                      <p className="font-medium">Could not render the embedded preview.</p>
                      <p className="mt-1 text-xs text-muted-foreground">{error}</p>
                      <Button asChild size="sm" variant="outline" className="mt-3">
                        <a href={fileUrl} target="_blank" rel="noreferrer">
                          Open PDF in browser
                        </a>
                      </Button>
                    </div>
                  )}
                  <canvas ref={canvasRef} className={`bi-acrobat-canvas ${loading || error ? "is-hidden" : ""}`} />
                </div>
              </section>
            </div>
          </TabsContent>

          <TabsContent value="flipbook" className="mt-4">
            <div className="bi-preview-flipbook-stage">
              {flipLoading && <p className="text-sm text-muted-foreground">Preparing flipbook preview...</p>}
              {!flipLoading && flipImages.length === 0 && (
                <Button variant="outline" onClick={() => void loadFlipbook()}>
                  Load flipbook preview
                </Button>
              )}
              {flipImages.length > 0 && (
                <HTMLFlipBook
                  ref={bookRef}
                  width={360}
                  height={510}
                  size="fixed"
                  minWidth={280}
                  maxWidth={460}
                  minHeight={390}
                  maxHeight={650}
                  showCover={preset.showCover}
                  drawShadow={preset.drawShadow}
                  flippingTime={preset.flipTime}
                  maxShadowOpacity={preset.maxShadowOpacity}
                  mobileScrollSupport
                  className={`brochure-flipbook ${preset.className}`}
                  onFlip={() => playFlipbookSound(sound.id)}
                >
                  {flipImages.map((src, i) => (
                    <PreviewFlipPage key={`${src.slice(0, 28)}-${i}`} src={src} pageNumber={i + 1} />
                  ))}
                </HTMLFlipBook>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
