"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { subscribeWorldLabsJob } from "@/lib/supabase/realtime";
import type { WorldLabsJobStatus as JobStatus } from "@/types/domain";

const PROGRESS_MAP: Partial<Record<JobStatus, number>> = {
  worldlabs_generation_requested: 40,
  worldlabs_processing: 60,
  worldlabs_succeeded: 75,
  downloading_assets: 85,
  optimizing_viewer_assets: 90,
  ready_for_review: 100,
  published: 100,
};

const LABELS: Record<string, string> = {
  worldlabs_processing: "Generating 3D world",
  ready_for_review: "Ready for review",
};

export function WorldLabsJobStatus({ jobId, onReady }: { jobId: string; onReady?: () => void }) {
  const [status, setStatus] = useState("worldlabs_processing");
  const [developerLabel, setDeveloperLabel] = useState("Generating 3D world");

  useEffect(() => {
    async function poll() {
      const res = await fetch(`/api/worldlabs/jobs/${jobId}`);
      const data = await res.json();
      if (data.status) applyUpdate(data.status, data.developerLabel);
    }

    function applyUpdate(s: string, label?: string) {
      setStatus(s);
      setDeveloperLabel(label ?? LABELS[s] ?? "Processing");
      if (s === "ready_for_review" || s === "published") onReady?.();
    }

    poll();
    const unsubRealtime = subscribeWorldLabsJob(jobId, (row) => {
      applyUpdate(row.status as string);
    });
    const interval = setInterval(poll, 15000);
    return () => { clearInterval(interval); unsubRealtime(); };
  }, [jobId, onReady]);

  const progress = PROGRESS_MAP[status as JobStatus] ?? 50;
  const failed = status.includes("failed");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{developerLabel}</CardTitle>
        <Badge variant={failed ? "destructive" : progress >= 100 ? "success" : "secondary"}>
          {failed ? "Failed" : progress >= 100 ? "Complete" : "Processing"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={progress} />
        <p className="text-sm text-muted-foreground">Realtime + polling active. Typical generation ~5 minutes.</p>
      </CardContent>
    </Card>
  );
}
