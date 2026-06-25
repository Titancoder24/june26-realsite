"use client";

import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

type ExperienceRow = {
  id: string;
  name: string;
  slug?: string | null;
  status?: string;
  views: number;
};

export function ExperiencePerformanceCard({ experiences }: { experiences: ExperienceRow[] }) {
  const maxViews = Math.max(1, ...experiences.map((e) => e.views));

  return (
    <Card className={cn("col-span-1 flex flex-col shadow-none dark:ring-0 lg:col-span-2")}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary/70" />
          <CardTitle>Experience performance by property</CardTitle>
        </div>
        <CardDescription>Viewer events per published walkthrough</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!experiences.length ? (
          <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
            Publish walkthroughs to compare property engagement.
          </div>
        ) : (
          experiences.map((exp) => (
            <div key={exp.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-medium">{exp.name}</span>
                <span className="num-inline shrink-0 text-muted-foreground">{exp.views} views</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/80 transition-all"
                  style={{ width: `${Math.max(8, (exp.views / maxViews) * 100)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
