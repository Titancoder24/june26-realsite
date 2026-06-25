"use client";

import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DoorOpen, MapPin } from "lucide-react";

type RankedItem = { label: string; count: number };

export function RoomAnnotationInsightsCard({
  rooms,
  annotations,
}: {
  rooms: RankedItem[];
  annotations: RankedItem[];
}) {
  return (
    <>
      <Card className={cn("col-span-1 shadow-none dark:ring-0")}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DoorOpen className="h-4 w-4 text-primary/70" />
            <CardTitle className="text-base">Most viewed rooms</CardTitle>
          </div>
          <CardDescription>Top scenes by viewer events</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {!rooms.length ? (
            <p className="text-sm text-muted-foreground">Room analytics populate as buyers scroll through clips.</p>
          ) : (
            rooms.map((room, i) => (
              <div key={`${room.label}-${i}`} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span className="truncate">{room.label}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{room.count}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className={cn("col-span-1 shadow-none dark:ring-0")}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary/70" />
            <CardTitle className="text-base">Most clicked annotations</CardTitle>
          </div>
          <CardDescription>High-performing pins & CTAs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {!annotations.length ? (
            <p className="text-sm text-muted-foreground">Annotation clicks appear after buyers interact with scene pins.</p>
          ) : (
            annotations.map((ann, i) => (
              <div key={`${ann.label}-${i}`} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span className="truncate">{ann.label}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{ann.count}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}
