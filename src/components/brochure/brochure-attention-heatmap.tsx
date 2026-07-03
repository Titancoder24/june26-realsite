"use client";

import type { BrochureSection } from "@/types/brochure-intelligence";

type SectionDwell = {
  page_number: number;
  section_id: string;
  section_label?: string | null;
  visible_seconds: number;
  max_visible_percent: number;
};

function attentionClass(seconds: number, maxVisible: number) {
  const score = seconds + maxVisible * 0.3;
  if (score >= 50) return "bi-attention-hot";
  if (score >= 25) return "bi-attention-warm";
  if (score >= 8) return "bi-attention-medium";
  return "bi-attention-cold";
}

export function BrochureAttentionHeatmap({
  sections,
  sectionDwell,
  pageNumber,
}: {
  sections: BrochureSection[];
  sectionDwell: SectionDwell[];
  pageNumber: number;
}) {
  const pageSections = sections.filter((s) => s.page_number === pageNumber);
  const dwellMap = new Map(
    sectionDwell.filter((d) => d.page_number === pageNumber).map((d) => [d.section_id, d]),
  );

  if (pageSections.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No section boxes defined for this page. Sections show where content was visible on screen.
      </p>
    );
  }

  return (
    <div className="relative aspect-[3/4] w-full max-w-md overflow-hidden rounded-lg border bg-muted/30">
      {pageSections.map((section) => {
        const dwell = dwellMap.get(section.section_id);
        const cls = attentionClass(dwell?.visible_seconds ?? 0, Number(dwell?.max_visible_percent ?? 0));
        return (
          <div
            key={section.section_id}
            className={`bi-section-overlay absolute ${cls}`}
            style={{
              left: `${section.x * 100}%`,
              top: `${section.y * 100}%`,
              width: `${section.width * 100}%`,
              height: `${section.height * 100}%`,
            }}
            title={`${section.label}: ${dwell?.visible_seconds ?? 0}s visible`}
          >
            <span className="absolute bottom-0 left-0 right-0 truncate bg-black/50 px-1 text-[10px] text-white">
              {section.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
