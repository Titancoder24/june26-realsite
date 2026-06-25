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
import { Clapperboard, ExternalLink } from "lucide-react";

type Walkthrough = {
  id: string;
  slug?: string | null;
  status?: string;
  created_at?: string;
  propertyId?: string;
  propertyName: string;
};

export function RecentWalkthroughsCard({ walkthroughs }: { walkthroughs: Walkthrough[] }) {
  return (
    <Card className={cn("col-span-1 flex flex-col shadow-none dark:ring-0")}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clapperboard className="h-4 w-4 text-primary/70" />
          <CardTitle>Recent walkthroughs</CardTitle>
        </div>
        <CardDescription>Latest cinematic property experiences</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!walkthroughs.length ? (
          <div className="rounded-lg border border-dashed py-8 text-center">
            <p className="text-sm font-medium">No walkthroughs yet</p>
            <Button className="mt-3" size="sm" asChild>
              <Link href="/dashboard/experiences/new">Create walkthrough</Link>
            </Button>
          </div>
        ) : (
          walkthroughs.map((w) => (
            <div key={w.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{w.propertyName}</p>
                <p className="text-xs text-muted-foreground">
                  {w.created_at ? new Date(w.created_at).toLocaleDateString() : "Recently created"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Badge variant={w.status === "published" ? "success" : "secondary"}>
                  {w.status ?? "draft"}
                </Badge>
                {w.slug && (
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={`/walkthrough/${w.slug}?preview=1`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
                <Button size="sm" variant="ghost" asChild>
                  <Link href={`/dashboard/walkthrough/${w.id}?propertyId=${w.propertyId ?? ""}`}>Open</Link>
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
