import {
  SPHERE_CAPTURE,
  bucketForYaw,
  yawDistance,
  type CoverageBucket,
} from "@/lib/capture/capture-protocol";

export interface HeadingSample {
  yaw: number;
  pitch: number;
  roll: number;
  timestamp: number;
}

export class CaptureEngine {
  private history: HeadingSample[] = [];
  private lastCaptureAt = 0;
  private stableSince: number | null = null;
  private lastBucket = -1;

  reset() {
    this.history = [];
    this.lastCaptureAt = 0;
    this.stableSince = null;
    this.lastBucket = -1;
  }

  push(sample: HeadingSample) {
    this.history.push(sample);
    if (this.history.length > 20) this.history.shift();
  }

  rotationSpeed(): number {
    if (this.history.length < 2) return 0;
    const a = this.history[this.history.length - 2];
    const b = this.history[this.history.length - 1];
    const dt = (b.timestamp - a.timestamp) / 1000;
    if (dt <= 0) return 0;
    const dy = yawDistance(a.yaw, b.yaw);
    return dy / dt;
  }

  isUpright(pitch: number | null) {
    return pitch != null && Math.abs(pitch - 90) <= SPHERE_CAPTURE.maxTilt;
  }

  shouldCapture(params: {
    currentYaw: number;
    pitch: number | null;
    buckets: CoverageBucket[];
    capturing: boolean;
  }): { fire: boolean; bucket: CoverageBucket | null; reason: string } {
    const { currentYaw, pitch, buckets, capturing } = params;
    if (capturing) return { fire: false, bucket: null, reason: "" };

    if (!this.isUpright(pitch)) {
      this.stableSince = null;
      return { fire: false, bucket: null, reason: "Hold phone upright — keep it vertical" };
    }

    const speed = this.rotationSpeed();
    if (speed > SPHERE_CAPTURE.maxRotationSpeed) {
      this.stableSince = null;
      return { fire: false, bucket: null, reason: "Rotate slower — like a slow pirouette" };
    }

    const bucketIdx = bucketForYaw(currentYaw);
    const bucket = buckets[bucketIdx];
    if (!bucket || bucket.covered) {
      const nearest = buckets
        .filter((b) => !b.covered)
        .sort((a, b) => yawDistance(currentYaw, a.centerYaw) - yawDistance(currentYaw, b.centerYaw))[0];
      if (nearest) {
        const dist = yawDistance(currentYaw, nearest.centerYaw);
        if (dist > SPHERE_CAPTURE.alignThreshold) {
          const turn = ((nearest.centerYaw - currentYaw + 360) % 360) > 180 ? "left" : "right";
          this.stableSince = null;
          return { fire: false, bucket: nearest, reason: `Turn ${turn} to fill the next gap` };
        }
      }
      this.stableSince = null;
      return { fire: false, bucket: null, reason: "Keep rotating to cover all angles" };
    }

    const dist = yawDistance(currentYaw, bucket.centerYaw);
    if (dist > SPHERE_CAPTURE.alignThreshold) {
      this.stableSince = null;
      return { fire: false, bucket, reason: "Align with the glowing target" };
    }

    const now = Date.now();
    if (now - this.lastCaptureAt < SPHERE_CAPTURE.minCaptureIntervalMs) {
      return { fire: false, bucket, reason: "Hold steady…" };
    }

    if (!this.stableSince) this.stableSince = now;
    if (now - this.stableSince < SPHERE_CAPTURE.stabilityMs) {
      return { fire: false, bucket, reason: "Almost there — hold steady" };
    }

    if (bucketIdx === this.lastBucket) {
      return { fire: false, bucket, reason: "Keep rotating" };
    }

    return { fire: true, bucket, reason: "Capturing!" };
  }

  markCaptured(bucketIndex: number) {
    this.lastCaptureAt = Date.now();
    this.stableSince = null;
    this.lastBucket = bucketIndex;
  }
}
