"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { subscribeWorldLabsJob } from "@/lib/supabase/realtime";
import { Box, Layers, ScanLine, Sparkles, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

const ESTIMATED_SECONDS = 420; // ~7 minutes
const POLL_MS = 10_000;

const STAGES = [
  { label: "Analyzing your photo", icon: ScanLine, until: 60 },
  { label: "Mapping depth & space", icon: Layers, until: 180 },
  { label: "Building 3D geometry", icon: Box, until: 300 },
  { label: "Rendering textures", icon: Sparkles, until: 390 },
  { label: "Finalizing immersive world", icon: Sparkles, until: ESTIMATED_SECONDS },
] as const;

function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ImmersiveGenerationLoader({
  jobId,
  startedAt,
  onReady,
  onRetry,
}: {
  jobId: string;
  startedAt?: string | null;
  onReady?: () => void;
  onRetry?: () => void;
}) {
  const [status, setStatus] = useState("worldlabs_processing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [apiProgress, setApiProgress] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const anchor = useMemo(() => {
    if (startedAt) return new Date(startedAt).getTime();
    return Date.now();
  }, [startedAt]);

  useEffect(() => {
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - anchor) / 1000)));
    tick();
    const clock = setInterval(tick, 1000);
    return () => clearInterval(clock);
  }, [anchor]);

  useEffect(() => {
    async function poll() {
      const res = await fetch(`/api/immersive/jobs/${jobId}`);
      const data = await res.json();
      if (!data.status) return;
      setStatus(data.status);
      if (data.errorMessage) setErrorMessage(data.errorMessage);
      if (typeof data.progress === "number") setApiProgress(data.progress);
      if (data.status === "ready_for_review" || data.status === "published") onReady?.();
    }

    poll();
    const unsub = subscribeWorldLabsJob(jobId, (row) => {
      setStatus(row.status as string);
      if (row.status === "ready_for_review" || row.status === "published") onReady?.();
    });
    const interval = setInterval(poll, POLL_MS);
    return () => { clearInterval(interval); unsub(); };
  }, [jobId, onReady]);

  const failed = status.includes("failed");
  const complete = status === "ready_for_review" || status === "published";

  const timeProgress = Math.min((elapsed / ESTIMATED_SECONDS) * 95, complete ? 100 : 95);
  const progress = complete
    ? 100
    : apiProgress != null
      ? Math.max(timeProgress, Math.round(apiProgress * 100))
      : timeProgress;

  const remaining = Math.max(0, ESTIMATED_SECONDS - elapsed);
  const stageIndex = STAGES.findIndex((s) => elapsed < s.until);
  const stage = STAGES[stageIndex === -1 ? STAGES.length - 1 : stageIndex];
  const StageIcon = stage.icon;

  return (
    <Card className="overflow-hidden border-primary/20">
      <CardContent className="space-y-6 p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Echo 3D Generation</p>
            <h3 className="text-lg font-semibold">{complete ? "World ready!" : failed ? "Generation failed" : stage.label}</h3>
          </div>
          <Badge variant={failed ? "destructive" : complete ? "success" : "secondary"}>
            {failed ? "Failed" : complete ? "Complete" : "Processing"}
          </Badge>
        </div>

        {/* Animated orb */}
        {!failed && !complete && (
          <div className="relative mx-auto flex h-40 w-40 items-center justify-center">
            <div className="absolute inset-0 animate-ping rounded-full bg-primary/10 [animation-duration:3s]" />
            <div className="absolute inset-3 animate-pulse rounded-full bg-primary/15 [animation-duration:2s]" />
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-dashed border-primary/30 [animation-duration:12s]" />
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 shadow-inner ring-4 ring-primary/5">
              <StageIcon className="h-10 w-10 animate-pulse text-primary" />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium tabular-nums">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {!failed && !complete && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
              <Timer className="h-4 w-4 shrink-0 text-primary" />
              <span>
                Elapsed <strong className="tabular-nums">{formatClock(elapsed)}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
              <Sparkles className="h-4 w-4 shrink-0 text-primary" />
              <span>
                ~<strong className="tabular-nums">{formatClock(remaining)}</strong> remaining
              </span>
            </div>
          </div>
        )}

        {/* Stage pills */}
        {!failed && !complete && (
          <div className="flex flex-wrap gap-2">
            {STAGES.map((s, i) => {
              const active = i === stageIndex;
              const done = i < stageIndex;
              const Icon = s.icon;
              return (
                <span
                  key={s.label}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                    active && "border-primary bg-primary/10 text-primary",
                    done && "border-primary/30 text-primary/70",
                    !active && !done && "border-border text-muted-foreground",
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {s.label}
                </span>
              );
            })}
          </div>
        )}

        {failed && errorMessage && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {errorMessage}
          </p>
        )}

        <p className="text-sm text-muted-foreground">
          {complete
            ? "Your immersive world is ready. Continue to annotate and publish."
            : failed
              ? "Try again with a clear, well-lit property photo."
              : "Typical generation takes 6–8 minutes. You can refresh this page — progress is saved."}
        </p>

        {failed && onRetry && (
          <Button onClick={onRetry} variant="outline">
            Try again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
