/** Premium sphere capture protocol — Google Photo Sphere class, web-only. */

export const SPHERE_CAPTURE = {
  /** 5° buckets → 72 stops for denser overlap and seamless 360°. */
  bucketCount: 72,
  bucketStep: 5,
  /** Minimum buckets before stitch allowed (~78% coverage). */
  minBuckets: 56,
  /** Auto-capture when within this many degrees of an uncovered bucket center. */
  alignThreshold: 7,
  /** Must hold alignment this long. */
  stabilityMs: 280,
  /** Min ms between captures. */
  minCaptureIntervalMs: 380,
  /** Max rotation speed (deg/s) — Google-style slow rotation. */
  maxRotationSpeed: 35,
  /** Phone upright tolerance (degrees from portrait). */
  maxTilt: 15,
  frameHfov: 75,
  /** Vertical field captured per stitch — wider = more scene visible. */
  targetVaov: 110,
  /** Pitch ring for optional ceiling detail (phase 2). */
  pitchRings: ["horizon"] as const,
} as const;

/** One-take video capture — record a single rotation, extract frames per bucket. */
export const VIDEO_CAPTURE = {
  /** Hard stop for a recording session. */
  maxDurationMs: 60_000,
  /** Candidate frames sampled per yaw bucket; sharpest wins (shake tolerance). */
  candidatesPerBucket: 2,
  /** Allow finishing once this % of buckets have been swept. */
  minCoveragePct: 75,
  /** Preferred encoder bitrate for crisp extracted frames. */
  videoBitsPerSecond: 12_000_000,
  /** Spacing of fallback candidates when no orientation timeline exists (ms). */
  fallbackCandidateSpreadMs: 120,
} as const;

export function isVideoCaptureSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof MediaRecorder.isTypeSupported === "function"
  );
}

export type CapturePhase =
  | "setup"
  | "countdown"
  | "capturing"
  | "processing"
  | "preview"
  | "complete";

export interface CoverageBucket {
  index: number;
  centerYaw: number;
  covered: boolean;
  thumbnail?: string;
}

export interface CapturedSphereFrame {
  bucketIndex: number;
  yaw: number;
  pitch: number;
  blob: Blob;
  imageUrl?: string;
  sharpness: number;
  brightness: number;
  exposure: number;
  /** Device pitch (beta, ~90 upright) when this frame was taken. */
  devicePitch?: number;
  /** Device roll (gamma) when this frame was taken. */
  deviceRoll?: number;
}

export interface CaptureQualityReport {
  score: number;
  label: "Excellent" | "Great" | "Good" | "Fair" | "Poor";
  coveragePct: number;
  avgSharpness: number;
  issues: string[];
}

export function buildCoverage(): CoverageBucket[] {
  const step = SPHERE_CAPTURE.bucketStep;
  return Array.from({ length: SPHERE_CAPTURE.bucketCount }, (_, i) => ({
    index: i,
    centerYaw: i * step,
    covered: false,
  }));
}

export function bucketForYaw(yaw: number) {
  const n = ((yaw % 360) + 360) % 360;
  return Math.floor(n / SPHERE_CAPTURE.bucketStep) % SPHERE_CAPTURE.bucketCount;
}

export function yawDistance(a: number, b: number) {
  return Math.abs(((a - b + 540) % 360) - 180);
}

export function relativeYaw(heading: number, origin: number) {
  return ((heading - origin + 360) % 360);
}

export function coverageStats(buckets: CoverageBucket[]) {
  const done = buckets.filter((b) => b.covered).length;
  return {
    done,
    total: buckets.length,
    pct: Math.round((done / buckets.length) * 100),
    complete: done >= SPHERE_CAPTURE.minBuckets,
    full: done === buckets.length,
  };
}

export function nearestUncoveredBucket(buckets: CoverageBucket[], currentYaw: number): CoverageBucket | null {
  const uncovered = buckets.filter((b) => !b.covered);
  if (!uncovered.length) return null;
  return uncovered.reduce((best, b) =>
    yawDistance(currentYaw, b.centerYaw) < yawDistance(currentYaw, best.centerYaw) ? b : best,
  );
}

export function computeQualityReport(buckets: CoverageBucket[], frames: CapturedSphereFrame[]): CaptureQualityReport {
  const stats = coverageStats(buckets);
  const avgSharp = frames.length
    ? frames.reduce((s, f) => s + f.sharpness, 0) / frames.length
    : 0;
  const issues: string[] = [];
  if (stats.pct < 80) issues.push("Some angles missing — rotate to fill gaps");
  if (avgSharp < 0.02) issues.push("Some frames were blurry");
  const dark = frames.filter((f) => f.brightness < 0.15).length;
  if (dark > frames.length * 0.2) issues.push("Room was under-lit in places");

  let score = stats.pct * 0.5 + Math.min(avgSharp * 800, 30) + (stats.full ? 20 : 0);
  score = Math.round(Math.min(100, score));
  const label =
    score >= 90 ? "Excellent" : score >= 75 ? "Great" : score >= 60 ? "Good" : score >= 45 ? "Fair" : "Poor";

  return { score, label, coveragePct: stats.pct, avgSharpness: avgSharp, issues };
}
