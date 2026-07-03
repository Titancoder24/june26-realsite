"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBrochureDuration } from "@/lib/brochure-ui-utils";

type PageDwell = {
  page_number: number;
  seconds: number;
  view_count: number;
  max_zoom: number;
  first_seen_at?: string | null;
};

export function BrochurePageJourney({ pageDwell }: { pageDwell: PageDwell[] }) {
  const sorted = [...pageDwell].sort((a, b) => {
    if (a.first_seen_at && b.first_seen_at) {
      return new Date(a.first_seen_at).getTime() - new Date(b.first_seen_at).getTime();
    }
    return a.page_number - b.page_number;
  });

  return (
    <Card className="bi-finance-card">
      <CardContent className="p-0">
        <Table className="bi-modern-table bi-crm-table">
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Page</TableHead>
              <TableHead>Time spent</TableHead>
              <TableHead>Views</TableHead>
              <TableHead>Max zoom</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No page journey data yet.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((p, i) => {
                const actions: string[] = [];
                if (p.view_count > 1) actions.push("Revisited");
                if (Number(p.max_zoom) > 1.2) actions.push("Zoomed");
                return (
                  <TableRow key={p.page_number}>
                    <TableCell><span className="bi-status-pill">{i + 1}</span></TableCell>
                    <TableCell className="font-semibold">Page {p.page_number}</TableCell>
                    <TableCell>{formatBrochureDuration(p.seconds)}</TableCell>
                    <TableCell>{p.view_count}</TableCell>
                    <TableCell>{Number(p.max_zoom).toFixed(1)}x</TableCell>
                    <TableCell><span className="bi-status-pill">{actions.length ? actions.join(" + ") : "Viewed"}</span></TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
