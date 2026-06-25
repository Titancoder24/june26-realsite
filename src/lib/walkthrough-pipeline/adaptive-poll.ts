import { VEO_PIPELINE } from "./config";

/** Adaptive poll interval based on elapsed time since generation started. */
export function getAdaptivePollIntervalMs(elapsedMs: number): number {
  const { fast, medium, slow, fastUntilMs, mediumUntilMs } = VEO_PIPELINE.pollIntervalsMs;
  if (elapsedMs < fastUntilMs) return fast;
  if (elapsedMs < mediumUntilMs) return medium;
  return slow;
}

export function estimateRemainingSeconds(params: {
  totalScenes: number;
  completedScenes: number;
  mode: "fast" | "quality";
  concurrency?: number;
  /** Average duration of completed jobs in this batch (ms), when available. */
  avgCompletedDurationMs?: number | null;
}): number | null {
  const remaining = Math.max(0, params.totalScenes - params.completedScenes);
  if (remaining === 0) return 0;

  const concurrency = params.concurrency ?? VEO_PIPELINE.maxConcurrency;

  if (params.avgCompletedDurationMs && params.avgCompletedDurationMs > 0) {
    const perSceneSec = params.avgCompletedDurationMs / 1000;
    return Math.ceil((remaining * perSceneSec) / concurrency);
  }

  const perScene = VEO_PIPELINE.estimatedSecondsPerScene[params.mode];
  return Math.ceil((remaining * perScene) / concurrency);
}

/** Human-readable pipeline stage from job counts. */
export function describeVideoPipelineStage(params: {
  pending: number;
  completed: number;
  failed: number;
  total: number;
  jobStatuses: string[];
}): string {
  if (params.total === 0) return "queued";
  if (params.pending === 0 && params.completed > 0) return "completed";
  if (params.jobStatuses.some((s) => s === "processing" || s === "retrying")) return "generating";
  if (params.jobStatuses.some((s) => s === "submitted")) return "submitted";
  if (params.jobStatuses.some((s) => s === "queued")) return "queued";
  if (params.pending > 0) return "polling";
  return "generating";
}
