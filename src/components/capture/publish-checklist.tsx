"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface ChecklistData {
  ready: boolean;
  issues: string[];
  stats: {
    scenes: number;
    captureRooms: number;
    completeRooms: number;
    checkpoints: number;
    hasFloorMap: boolean;
  };
}

export function PublishChecklist({ experienceId, onPublish }: { experienceId: string; onPublish?: (url: string) => void }) {
  const [data, setData] = useState<ChecklistData | null>(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    fetch(`/api/capture/${experienceId}/checklist`).then((r) => r.json()).then(setData).catch(() => {});
  }, [experienceId]);

  async function publish() {
    setPublishing(true);
    const res = await fetch(`/api/experiences/${experienceId}/publish`, { method: "POST" });
    const result = await res.json();
    setPublishing(false);
    if (!res.ok) return toast.error(result.error);
    toast.success("Tour published!");
    onPublish?.(result.publishedUrl);
  }

  if (!data) return <div className="text-sm text-muted-foreground">Loading checklist…</div>;

  const items = [
    { label: "All rooms captured", ok: data.stats.completeRooms === data.stats.captureRooms && data.stats.captureRooms > 0 },
    { label: "Scenes created", ok: data.stats.scenes > 0 },
    { label: "Starting views set", ok: !data.issues.some((i) => i.includes("starting view")) },
    { label: "Rooms connected", ok: !data.issues.some((i) => i.includes("not connected")) },
    { label: "Floor map linked", ok: data.stats.hasFloorMap || data.stats.scenes <= 1 },
    { label: "Annotations added", ok: data.stats.checkpoints > 0 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Preview Checklist</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-sm">
              {item.ok ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-amber-500" />}
              <span>{item.label}</span>
              <Badge variant={item.ok ? "secondary" : "outline"} className="ml-auto text-xs">{item.ok ? "Done" : "Pending"}</Badge>
            </div>
          ))}
        </div>
        {data.issues.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {data.issues.map((issue) => <p key={issue}>• {issue}</p>)}
          </div>
        )}
        <Button className="w-full" disabled={publishing} onClick={publish}>
          {publishing ? "Publishing…" : data.ready ? "Publish Tour" : "Publish Anyway"}
        </Button>
      </CardContent>
    </Card>
  );
}
