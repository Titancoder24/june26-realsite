"use client";

import { formatBrochureDuration } from "@/lib/brochure-ui-utils";

type ScrollRow = {
  page_number: number;
  scroll_bucket: string;
  seconds: number;
};

const BUCKET_ORDER = ["0-25", "25-50", "50-75", "75-100"];

export function BrochureScrollHeatmap({
  scrollDepth,
  pageNumber,
}: {
  scrollDepth: ScrollRow[];
  pageNumber: number;
}) {
  const rows = scrollDepth.filter((r) => r.page_number === pageNumber);
  const maxSeconds = Math.max(1, ...rows.map((r) => r.seconds));

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No scroll attention data for this page.</p>;
  }

  return (
    <div className="space-y-2">
      {BUCKET_ORDER.map((bucket) => {
        const row = rows.find((r) => r.scroll_bucket === bucket);
        const seconds = row?.seconds ?? 0;
        const pct = Math.round((seconds / maxSeconds) * 100);
        return (
          <div key={bucket} className="bi-scroll-band">
            <span className="w-16 shrink-0 text-muted-foreground">{bucket}%</span>
            <div className="bi-scroll-band-bar">
              <div className="bi-scroll-band-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-14 shrink-0 text-right tabular-nums">{formatBrochureDuration(seconds)}</span>
          </div>
        );
      })}
    </div>
  );
}
