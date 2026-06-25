/** VEO walkthrough pipeline — bounded concurrency, polling, retries (VEO 3.1 only). */

export const VEO_PIPELINE = {
  /** Concurrent Veo jobs per poll cycle (worker pool size). */
  maxConcurrency: 6,
  /** Max retries per job — same model only, exponential backoff. */
  maxRetries: 4,
  retryDelaysMs: [2_000, 5_000, 10_000, 20_000] as const,
  /** Adaptive client poll intervals (ms). */
  pollIntervalsMs: {
    fast: 2_000,
    medium: 4_000,
    slow: 6_000,
    fastUntilMs: 20_000,
    mediumUntilMs: 60_000,
  },
  /** Estimated seconds per scene for ETA — conservative; actual Veo jobs often take 8–20 min each. */
  estimatedSecondsPerScene: { fast: 600, quality: 1200 } as const,
  veoDurationSeconds: 6,
  veoResolution: "720p" as const,
} as const;

export type PipelineStage =
  | "queued"
  | "preparing"
  | "submitting"
  | "generating"
  | "polling"
  | "downloading"
  | "uploading"
  | "completed"
  | "failed"
  | "retrying";
