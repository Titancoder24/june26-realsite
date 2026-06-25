"use client";

import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { TrendingUp } from "lucide-react";

type Funnel = {
  viewed: number;
  askedAi: number;
  clickedContact: number;
  bookedVisit: number;
};

const chartConfig = {
  count: { label: "Buyers", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function ConversionFunnelCard({ funnel }: { funnel: Funnel }) {
  const steps = [
    { step: "Viewed", count: funnel.viewed },
    { step: "Asked AI", count: funnel.askedAi },
    { step: "Contact", count: funnel.clickedContact },
    { step: "Booked visit", count: funnel.bookedVisit },
  ];

  const hasData = steps.some((s) => s.count > 0);

  return (
    <Card className={cn("col-span-1 flex flex-col shadow-none dark:ring-0 sm:col-span-2 lg:col-span-2")}>
      <CardHeader className="items-center space-y-1 pb-0 sm:items-start">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary/70" />
          <CardTitle>Conversion funnel</CardTitle>
        </div>
        <CardDescription>Viewed → asked AI → clicked contact → booked visit</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {!hasData ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed text-center">
            <p className="text-sm font-medium">No funnel data yet</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Publish a walkthrough and share the link — buyer progression will appear here.
            </p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[240px] w-full">
            <BarChart data={steps} layout="vertical" margin={{ left: 8, right: 8 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" hide />
              <YAxis dataKey="step" type="category" width={96} tickLine={false} axisLine={false} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
