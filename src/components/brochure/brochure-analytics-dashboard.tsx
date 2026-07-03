"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, MonitorSmartphone, Phone, Timer, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function statusBadge(status: string) {
  if (status === "hot") return <Badge className="bg-red-500/15 text-red-700 dark:text-red-300">Hot</Badge>;
  if (status === "warm") return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">Warm</Badge>;
  return <Badge variant="secondary">Cold</Badge>;
}

export function BrochureLeadTable({
  brochureId,
  sessions,
}: {
  brochureId: string;
  sessions: Array<{
    id: string;
    total_seconds: number;
    lead_status: string;
    intent_score: number;
    device?: string | null;
    browser?: string | null;
    os?: string | null;
    utm_source?: string | null;
    leads?: { name?: string; phone?: string } | null;
    brochure_lead_scores?: Array<{ recommended_action?: string }> | { recommended_action?: string } | null;
  }>;
}) {
  const router = useRouter();

  return (
    <Card className="bi-finance-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Buyer Sessions</CardTitle>
          <p className="text-sm text-muted-foreground">Click any row to open the full buyer journey — charts, heatmap, and intent signals.</p>
        </div>
        <Badge variant="secondary">{sessions.length} sessions</Badge>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table className="bi-modern-table bi-crm-table">
          <TableHeader>
            <TableRow>
              <TableHead>Lead</TableHead>
              <TableHead>Device</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No buyer sessions yet. Share your smart link to start capturing leads.
                </TableCell>
              </TableRow>
            ) : (
              sessions.map((s) => {
                const scores = s.brochure_lead_scores;
                const scoreObj = Array.isArray(scores) ? scores[0] : scores;
                const leadName = s.leads?.name ?? "Anonymous";
                const initials = leadName
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                const score = Math.min(100, Math.max(0, s.intent_score ?? 0));
                return (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/dashboard/brochures/${brochureId}/sessions/${s.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="bi-lead-avatar">{initials || <UserRound className="h-4 w-4" />}</div>
                        <div>
                          <p className="font-semibold text-slate-950">{leadName}</p>
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {s.leads?.phone ?? "No phone"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="bi-status-pill">
                        <MonitorSmartphone className="h-3.5 w-3.5" />
                        {[s.device, s.browser].filter(Boolean).join(" / ") || "Unknown"}
                      </span>
                    </TableCell>
                    <TableCell>{s.utm_source ?? "Direct"}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 font-medium">
                        <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                        {formatDuration(s.total_seconds ?? 0)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="min-w-28">
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-muted-foreground">Intent</span>
                          <span className="font-semibold">{score}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500"
                            style={{ width: `${score}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{statusBadge(s.lead_status ?? "cold")}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button asChild size="sm" variant="outline" className="bi-table-action">
                        <Link href={`/dashboard/brochures/${brochureId}/sessions/${s.id}`}>
                          View <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                        </Link>
                      </Button>
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

export function BrochureReportCards({
  summary,
}: {
  summary: {
    totalViews: number;
    uniqueViewers: number;
    leadsCaptured: number;
    averageReadTime: number;
    hotLeads: number;
    warmLeads: number;
    coldLeads: number;
    downloadClicks?: number;
    ctaClicks?: number;
    topPage?: { pageNumber: number; seconds: number } | null;
    topSection?: { label: string; seconds: number } | null;
  };
}) {
  const cards = [
    { label: "Total views", value: summary.totalViews },
    { label: "Unique viewers", value: summary.uniqueViewers },
    { label: "Leads captured", value: summary.leadsCaptured },
    { label: "Avg read time", value: formatDuration(summary.averageReadTime) },
    { label: "Hot leads", value: summary.hotLeads },
    { label: "Downloads", value: summary.downloadClicks ?? 0 },
    { label: "CTA clicks", value: summary.ctaClicks ?? 0 },
    { label: "Top page", value: summary.topPage ? `Page ${summary.topPage.pageNumber}` : "—" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((c) => (
        <Card key={c.label} className="bi-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{c.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
