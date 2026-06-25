"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Flame } from "lucide-react";

type HotLead = {
  id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  intent_score?: number | null;
  lead_status?: string | null;
  properties?: { name?: string } | null;
  created_at?: string;
};

export function HotLeadsCard({ leads }: { leads: HotLead[] }) {
  return (
    <Card className={cn("col-span-1 flex flex-col shadow-none dark:ring-0 lg:col-span-2")}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-amber-600" />
              <CardTitle>Hot leads</CardTitle>
            </div>
            <CardDescription>High-intent buyers from walkthrough sessions</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/leads">View all</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!leads.length ? (
          <div className="rounded-lg border border-dashed py-10 text-center">
            <p className="text-sm font-medium">No hot leads yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Leads with intent score ≥ 70 appear here.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Buyer</TableHead>
                <TableHead>Property</TableHead>
                <TableHead className="text-right">Intent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <div className="font-medium">{lead.name || lead.phone || "Anonymous"}</div>
                    {lead.phone && <div className="text-xs text-muted-foreground">{lead.phone}</div>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {lead.properties?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={(lead.intent_score ?? 0) >= 80 ? "warning" : "secondary"}>
                      {lead.intent_score ?? 0}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
