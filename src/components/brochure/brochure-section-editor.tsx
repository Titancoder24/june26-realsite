"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, MousePointer2, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadBrochurePdf, renderPdfPageToCanvas } from "@/lib/brochure-pdf-renderer";
import type { BrochureSection } from "@/types/brochure-intelligence";

type DraftSection = {
  section_id: string;
  label: string;
  page_number: number;
  x: number;
  y: number;
  width: number;
  height: number;
  category?: string;
};

export function BrochureSectionEditor({
  brochureId,
  fileUrl,
  pageCount,
  initialSections,
  onSaved,
}: {
  brochureId: string;
  fileUrl: string;
  pageCount: number;
  initialSections: BrochureSection[];
  onSaved: (sections: BrochureSection[]) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfRef = useRef<any>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [sections, setSections] = useState<DraftSection[]>(
    initialSections.map((s) => ({
      section_id: s.section_id,
      label: s.label,
      page_number: s.page_number,
      x: s.x,
      y: s.y,
      width: s.width,
      height: s.height,
      category: s.category ?? undefined,
    })),
  );
  const [saving, setSaving] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(true);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftRect, setDraftRect] = useState<DraftSection | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  const pageSections = sections.filter((s) => s.page_number === pageNumber);
  const selectedSection = useMemo(
    () => sections.find((s) => s.section_id === selectedId && s.page_number === pageNumber) ?? null,
    [pageNumber, sections, selectedId],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!fileUrl || pageCount <= 0) {
        setLoadingPdf(false);
        setPdfError("Brochure PDF URL is missing. Re-open this brochure from the list or upload it again.");
        return;
      }
      setLoadingPdf(true);
      setPdfError(null);
      try {
        const pdf = await loadBrochurePdf(fileUrl);
        if (cancelled) return;
        pdfRef.current = pdf;
      } catch (err) {
        if (!cancelled) {
          setPdfError(err instanceof Error ? err.message : "Unable to load PDF preview");
        }
      } finally {
        if (!cancelled) setLoadingPdf(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fileUrl, pageCount]);

  useEffect(() => {
    const pdf = pdfRef.current;
    const canvas = canvasRef.current;
    if (!pdf || !canvas || loadingPdf) return;
    void renderPdfPageToCanvas(pdf, pageNumber, 1.35, canvas).catch((err) => {
      setPdfError(err instanceof Error ? err.message : "Unable to render PDF page");
    });
  }, [loadingPdf, pageNumber]);

  const pointFromEvent = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  };

  const addSection = () => {
    const section = {
      section_id: `section_${Date.now()}`,
      label: "New section",
      page_number: pageNumber,
      x: 0.1,
      y: 0.1,
      width: 0.35,
      height: 0.18,
    };
    setSections((prev) => [...prev, section]);
    setSelectedId(section.section_id);
  };

  const updateSection = (idx: number, patch: Partial<DraftSection>) => {
    setSections((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const removeSection = (globalIdx: number) => {
    setSections((prev) => prev.filter((_, i) => i !== globalIdx));
    setSelectedId(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/brochures/${brochureId}/sections`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      onSaved(data.sections ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="bi-card overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crosshair className="h-5 w-5 text-primary" />
          PDF Annotator
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Draw section boxes directly on the brochure. These normalized boxes power section visibility, dwell time,
          and attention heatmaps.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="bi-annotator-toolbar">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={addSection}>
              <Plus className="mr-1 h-4 w-4" /> Add box
            </Button>
            <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>
              <Save className="mr-1 h-4 w-4" />
              {saving ? "Saving..." : "Save annotations"}
            </Button>
          </div>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <MousePointer2 className="h-3.5 w-3.5" />
            Drag on the PDF to create a new section. Select a box to edit label and coordinates.
          </p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="bi-annotator-grid">
          <aside className="bi-page-strip">
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                className={p === pageNumber ? "is-active" : ""}
                onClick={() => {
                  setPageNumber(p);
                  setSelectedId(null);
                }}
              >
                Page {p}
                <span>{sections.filter((s) => s.page_number === p).length} boxes</span>
              </button>
            ))}
          </aside>

          <div className="bi-pdf-annotator-stage">
            {loadingPdf && <div className="bi-annotator-loading">Loading PDF preview...</div>}
            {pdfError && (
              <div className="bi-annotator-error">
                <p className="font-medium">PDF preview could not render here.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  You can still open the original PDF. Check that the storage URL is public and reachable.
                </p>
                <Button asChild size="sm" variant="outline" className="mt-3">
                  <a href={fileUrl} target="_blank" rel="noreferrer">
                    Open PDF
                  </a>
                </Button>
              </div>
            )}
            <div
              ref={stageRef}
              className={`bi-pdf-page-frame ${loadingPdf || pdfError ? "is-hidden" : ""}`}
              onPointerDown={(event) => {
                if ((event.target as HTMLElement).closest("[data-section-id]")) return;
                const start = pointFromEvent(event);
                setDragStart(start);
                setDraftRect({
                  section_id: "draft",
                  label: "New section",
                  page_number: pageNumber,
                  x: start.x,
                  y: start.y,
                  width: 0,
                  height: 0,
                });
              }}
              onPointerMove={(event) => {
                if (!dragStart) return;
                const current = pointFromEvent(event);
                setDraftRect({
                  section_id: "draft",
                  label: "New section",
                  page_number: pageNumber,
                  x: Math.min(dragStart.x, current.x),
                  y: Math.min(dragStart.y, current.y),
                  width: Math.abs(current.x - dragStart.x),
                  height: Math.abs(current.y - dragStart.y),
                });
              }}
              onPointerUp={() => {
                if (!draftRect) return;
                if (draftRect.width > 0.02 && draftRect.height > 0.02) {
                  const next = {
                    ...draftRect,
                    section_id: `section_${Date.now()}`,
                    label: `Section ${pageSections.length + 1}`,
                  };
                  setSections((prev) => [...prev, next]);
                  setSelectedId(next.section_id);
                }
                setDragStart(null);
                setDraftRect(null);
              }}
            >
              <canvas ref={canvasRef} className="bi-annotator-canvas" />
              {pageSections.map((section) => (
                <button
                  key={section.section_id}
                  type="button"
                  data-section-id={section.section_id}
                  className={`bi-annotation-box ${selectedId === section.section_id ? "is-selected" : ""}`}
                  style={{
                    left: `${section.x * 100}%`,
                    top: `${section.y * 100}%`,
                    width: `${section.width * 100}%`,
                    height: `${section.height * 100}%`,
                  }}
                  onClick={() => setSelectedId(section.section_id)}
                >
                  <span>{section.label}</span>
                </button>
              ))}
              {draftRect && (
                <div
                  className="bi-annotation-box is-draft"
                  style={{
                    left: `${draftRect.x * 100}%`,
                    top: `${draftRect.y * 100}%`,
                    width: `${draftRect.width * 100}%`,
                    height: `${draftRect.height * 100}%`,
                  }}
                />
              )}
            </div>
          </div>

          <aside className="bi-annotation-panel">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Selected section</p>
              {selectedSection ? (
                <p className="mt-1 text-sm font-semibold">{selectedSection.label}</p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Select a box or drag on the PDF.</p>
              )}
            </div>

            {selectedSection && (() => {
              const globalIdx = sections.findIndex(
                (s) => s.section_id === selectedSection.section_id && s.page_number === selectedSection.page_number,
              );
              return (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Label</Label>
                    <Input
                      value={selectedSection.label}
                      onChange={(e) => updateSection(globalIdx, { label: e.target.value })}
                      placeholder="Pricing table"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Section ID</Label>
                    <Input
                      value={selectedSection.section_id}
                      onChange={(e) => {
                        updateSection(globalIdx, { section_id: e.target.value });
                        setSelectedId(e.target.value);
                      }}
                      placeholder="pricing_table"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {(["x", "y", "width", "height"] as const).map((field) => (
                      <div key={field} className="space-y-1.5">
                        <Label>{field}</Label>
                        <Input
                          type="number"
                          step={0.01}
                          min={0}
                          max={1}
                          value={Number(selectedSection[field]).toFixed(2)}
                          onChange={(e) => updateSection(globalIdx, { [field]: Number(e.target.value) })}
                        />
                      </div>
                    ))}
                  </div>
                  <Button type="button" variant="destructive" size="sm" onClick={() => removeSection(globalIdx)}>
                    <Trash2 className="mr-1 h-4 w-4" /> Delete section
                  </Button>
                </div>
              );
            })()}

            <div className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
              Tip: use clear sales labels like Pricing Table, Payment Plan, 3BHK Layout, Amenities, Location Map,
              and Book Site Visit CTA.
            </div>
          </aside>
        </div>
      </CardContent>
    </Card>
  );
}
