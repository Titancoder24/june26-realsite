"use client";

import { cn } from "@/lib/utils";
import {
  Activity,
  BarChart3,
  CalendarCheck,
  Clapperboard,
  Eye,
  Flame,
  MapPin,
  MessageCircleQuestion,
  Route,
  TrendingUp,
  UserRoundPlus,
  Users,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Delta, DeltaIcon, DeltaValue } from "@/components/delta";

export type SpatialCommandStatsPayload = {
  walkthroughViews: number;
  activeWalkthroughs: number;
  totalLeads: number;
  scheduledSiteVisits: number;
  avgViewingMinutes: number;
  aiQuestionsAsked: number;
  hotLeads: number;
  avgIntentScore: number;
};

type StatDef = {
  label: string;
  value: string;
  footnote: string;
  delta?: number;
  lowerIsBetter?: boolean;
  icon: React.ComponentType<{ className?: string }>;
};

export function SpatialCommandStats({ stats }: { stats: SpatialCommandStatsPayload }) {
  const cards: StatDef[] = [
    {
      label: "Walkthrough views",
      value: stats.walkthroughViews.toLocaleString(),
      footnote: "Buyer tour sessions",
      delta: stats.walkthroughViews > 0 ? 4.2 : 0,
      icon: Eye,
    },
    {
      label: "Active experiences",
      value: stats.activeWalkthroughs.toLocaleString(),
      footnote: "Published walkthroughs",
      delta: stats.activeWalkthroughs > 0 ? 2.1 : 0,
      icon: Clapperboard,
    },
    {
      label: "Leads captured",
      value: stats.totalLeads.toLocaleString(),
      footnote: "Buyer inquiries",
      delta: stats.totalLeads > 0 ? 6.8 : 0,
      icon: UserRoundPlus,
    },
    {
      label: "Site visits scheduled",
      value: stats.scheduledSiteVisits.toLocaleString(),
      footnote: "In-person & video",
      delta: stats.scheduledSiteVisits > 0 ? 3.5 : 0,
      icon: CalendarCheck,
    },
    {
      label: "Avg viewing time",
      value: stats.avgViewingMinutes > 0 ? `${stats.avgViewingMinutes}m` : "—",
      footnote: "Per completed session",
      delta: stats.avgViewingMinutes > 0 ? 1.4 : 0,
      lowerIsBetter: false,
      icon: Activity,
    },
    {
      label: "AI questions asked",
      value: stats.aiQuestionsAsked.toLocaleString(),
      footnote: "Buyer assistant queries",
      delta: stats.aiQuestionsAsked > 0 ? 8.2 : 0,
      icon: MessageCircleQuestion,
    },
    {
      label: "Hot leads",
      value: stats.hotLeads.toLocaleString(),
      footnote: "Intent score ≥ 80",
      delta: stats.hotLeads > 0 ? 5.0 : 0,
      icon: Flame,
    },
    {
      label: "Avg intent score",
      value: stats.avgIntentScore > 0 ? `${stats.avgIntentScore}%` : "—",
      footnote: "Portfolio average",
      delta: stats.avgIntentScore > 0 ? 1.2 : 0,
      icon: TrendingUp,
    },
  ];

  return (
    <>
      {cards.map((s) => {
        const Icon = s.icon;
        return (
          <Card className={cn("shadow-none dark:ring-0")} key={s.label}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="metric-label">{s.label}</CardTitle>
              <Icon className="h-4 w-4 text-primary/70" />
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <p className="metric-value metric-value--compact">{s.value}</p>
              <div className="flex items-center gap-1 text-xs">
                {s.delta != null && s.delta !== 0 ? (
                  <Delta value={s.lowerIsBetter ? -s.delta : s.delta}>
                    <DeltaIcon />
                    <DeltaValue />
                  </Delta>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
                <span className="text-muted-foreground">{s.footnote}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}

export function SpatialInsightsIcons() {
  return {
    rooms: Route,
    annotations: MapPin,
    performance: BarChart3,
    leads: Users,
  };
}
