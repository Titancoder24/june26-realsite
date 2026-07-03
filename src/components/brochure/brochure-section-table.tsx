"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBrochureDuration, interestLevel } from "@/lib/brochure-ui-utils";

type SectionDwell = {
  page_number: number;
  section_label?: string | null;
  visible_seconds: number;
  view_count: number;
  max_visible_percent: number;
};

export function BrochureSectionTable({ sectionDwell }: { sectionDwell: SectionDwell[] }) {
  const sorted = [...sectionDwell].sort((a, b) => b.visible_seconds - a.visible_seconds);

  return (
    <Card className="bi-finance-card">
      <CardContent className="p-0">
        <Table className="bi-modern-table bi-crm-table">
          <TableHeader>
            <TableRow>
              <TableHead>Page</TableHead>
              <TableHead>Section</TableHead>
              <TableHead>Time visible</TableHead>
              <TableHead>Views</TableHead>
              <TableHead>Max visible</TableHead>
              <TableHead>Interest</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No section visibility data yet. Add section boxes on the brochure detail page to track interest.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((s, i) => {
                const level = interestLevel(s.visible_seconds, Number(s.max_visible_percent));
                return (
                  <TableRow key={`${s.page_number}-${i}`}>
                    <TableCell>Page {s.page_number}</TableCell>
                    <TableCell className="font-medium">{s.section_label ?? "Section"}</TableCell>
                    <TableCell>{formatBrochureDuration(s.visible_seconds)}</TableCell>
                    <TableCell>{s.view_count}</TableCell>
                    <TableCell>{Math.round(Number(s.max_visible_percent))}%</TableCell>
                    <TableCell>
                      <Badge className={level === "Very High" || level === "High" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"}>
                        {level}
                      </Badge>
                    </TableCell>
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
