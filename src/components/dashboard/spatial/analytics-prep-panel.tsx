"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Activity, BarChart3, CalendarCheck, Flame, MessageCircleQuestion } from "lucide-react";

type AnalyticsPrep = {
  timePerScene: { label: string; count: number }[];
  mostRevisitedClip: unknown[];
  annotationDwellTime: unknown[];
  aiQuestionsByRoom: unknown[];
  buyerIntentScore: number;
  siteVisitSources: unknown[];
  note?: string;
};

const PREP_ITEMS = [
  { key: "timePerScene", label: "Time spent per scene/room", icon: Activity },
  { key: "mostRevisitedClip", label: "Most revisited clip", icon: BarChart3 },
  { key: "annotationDwellTime", label: "Annotation dwell time", icon: Activity },
  { key: "aiQuestionsByRoom", label: "AI questions grouped by room", icon: MessageCircleQuestion },
  { key: "buyerIntentScore", label: "Buyer intent score", icon: Flame },
  { key: "siteVisitSources", label: "Site visit booking source", icon: CalendarCheck },
] as const;

export function AnalyticsPrepPanel({ analyticsPrep }: { analyticsPrep: AnalyticsPrep }) {
  return (
    <Card className={cn("col-span-1 shadow-none dark:ring-0 lg:col-span-4")}>
      <CardHeader>
        <CardTitle className="text-base">Advanced analytics (coming online)</CardTitle>
        <CardDescription>
          UI sections prepared for deeper walkthrough intelligence. Partial data shown where available.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PREP_ITEMS.map(({ key, label, icon: Icon }) => {
            const value = analyticsPrep[key];
            const hasArray = Array.isArray(value) && value.length > 0;
            const hasScore = key === "buyerIntentScore" && analyticsPrep.buyerIntentScore > 0;

            return (
              <div key={key} className="rounded-lg border bg-muted/20 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{label}</span>
                </div>
                {hasArray ? (
                  <div className="space-y-1">
                    {(value as { label: string; count: number }[]).slice(0, 3).map((item, i) => (
                      <div key={i} className="flex justify-between text-xs text-muted-foreground">
                        <span className="truncate">{item.label}</span>
                        <span>{item.count}</span>
                      </div>
                    ))}
                  </div>
                ) : hasScore ? (
                  <p className="metric-value metric-value--compact">{analyticsPrep.buyerIntentScore}%</p>
                ) : (
                  <Badge variant="outline" className="text-[10px]">Awaiting data</Badge>
                )}
              </div>
            );
          })}
        </div>
        {analyticsPrep.note && (
          <p className="mt-3 text-xs text-muted-foreground">{analyticsPrep.note}</p>
        )}
      </CardContent>
    </Card>
  );
}
