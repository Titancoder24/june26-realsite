import { analyzeFrame } from "@/lib/capture/frame-quality";
import {
  SPHERE_CAPTURE,
  VIDEO_CAPTURE,
  bucketForYaw,
  type CapturedSphereFrame,
} from "@/lib/capture/capture-protocol";
import type { OrientationSample } from "@/lib/capture/video-recorder";

interface CandidatePoint {
  timeMs: number;
  bucketIndex: number;
  yaw: number;
  devicePitch?: number;
  deviceRoll?: number;
}

/** Wait for a video element to finish seeking to the given time. */
function seekTo(video: HTMLVideoElement, timeSec: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Video seek failed"));
    };
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      clearTimeout(timer);
    };
    // Some mobile browsers occasionally drop the seeked event; don't hang forever
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, 2000);
    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });
    video.currentTime = timeSec;
  });
}

/**
 * MediaRecorder webm blobs often report duration=Infinity until forced to
 * compute it by seeking far past the end.
 */
async function resolveDuration(video: HTMLVideoElement, fallbackMs: number): Promise<number> {
  if (Number.isFinite(video.duration) && video.duration > 0) return video.duration * 1000;

  const fixed = new Promise<number>((resolve) => {
    const onDuration = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        video.removeEventListener("durationchange", onDuration);
        resolve(video.duration * 1000);
      }
    };
    video.addEventListener("durationchange", onDuration);
    setTimeout(() => {
      video.removeEventListener("durationchange", onDuration);
      resolve(fallbackMs);
    }, 1500);
  });

  video.currentTime = Number.MAX_SAFE_INTEGER;
  const duration = await fixed;
  video.currentTime = 0;
  return duration;
}

/** Shortest angular distance between two yaws. */
function yawDiff(a: number, b: number) {
  return Math.abs(((a - b + 540) % 360) - 180);
}

/**
 * Build extraction points from the orientation timeline: for each yaw bucket,
 * pick the moments where rotation speed was LOWEST — those frames have the
 * least motion blur, which is the key to gimbal-quality output from a
 * handheld sweep. Badly tilted moments are rejected up front.
 */
function candidatesFromTimeline(samples: OrientationSample[], durationMs: number): CandidatePoint[] {
  // Instantaneous rotation speed (deg/s) from neighboring samples
  const speeds = new Float32Array(samples.length);
  for (let k = 0; k < samples.length; k++) {
    const lo = Math.max(0, k - 1);
    const hi = Math.min(samples.length - 1, k + 1);
    const dt = samples[hi].t - samples[lo].t;
    speeds[k] = dt > 0 ? (yawDiff(samples[hi].yaw, samples[lo].yaw) / dt) * 1000 : 0;
  }

  const byBucket = new Map<number, { sample: OrientationSample; speed: number }[]>();
  for (let k = 0; k < samples.length; k++) {
    const s = samples[k];
    if (s.t < 0 || s.t > durationMs) continue;
    // Reject moments where the phone was badly tilted
    if (Number.isFinite(s.pitch) && Math.abs(s.pitch - 90) > 25) continue;
    const idx = bucketForYaw(s.yaw);
    const entry = { sample: s, speed: speeds[k] };
    const list = byBucket.get(idx);
    if (list) list.push(entry);
    else byBucket.set(idx, [entry]);
  }

  const points: CandidatePoint[] = [];
  for (const [bucketIndex, list] of byBucket) {
    // Slowest-motion moments first; keep candidates temporally separated so a
    // single blurry instant can't claim every slot
    list.sort((a, b) => a.speed - b.speed);
    const chosen: typeof list = [];
    for (const entry of list) {
      if (chosen.length >= VIDEO_CAPTURE.candidatesPerBucket) break;
      if (chosen.some((c) => Math.abs(c.sample.t - entry.sample.t) < 80)) continue;
      chosen.push(entry);
    }
    for (const { sample } of chosen) {
      points.push({
        timeMs: sample.t,
        bucketIndex,
        yaw: sample.yaw,
        devicePitch: sample.pitch,
        deviceRoll: sample.roll,
      });
    }
  }
  return points;
}

/**
 * No orientation data — assume constant rotation speed over the recording and
 * distribute buckets evenly across the duration.
 */
function candidatesFromConstantRotation(durationMs: number): CandidatePoint[] {
  const points: CandidatePoint[] = [];
  const usable = Math.max(1000, durationMs - 500); // skip trailing stop fumble
  for (let i = 0; i < SPHERE_CAPTURE.bucketCount; i++) {
    const base = (i / SPHERE_CAPTURE.bucketCount) * usable;
    const yaw = i * SPHERE_CAPTURE.bucketStep;
    points.push({ timeMs: base, bucketIndex: i, yaw });
    const second = base + VIDEO_CAPTURE.fallbackCandidateSpreadMs;
    if (second < usable) points.push({ timeMs: second, bucketIndex: i, yaw });
  }
  return points;
}

/** Sweep coverage of a timeline in % of buckets touched. */
export function timelineCoveragePct(samples: OrientationSample[]): number {
  const touched = new Set<number>();
  for (const s of samples) touched.add(bucketForYaw(s.yaw));
  return Math.round((touched.size / SPHERE_CAPTURE.bucketCount) * 100);
}

/**
 * Extract the sharpest frame per yaw bucket from a recorded rotation video.
 * Runs entirely in-browser: hidden video element + canvas, no ffmpeg.
 */
export async function extractFramesFromVideo(
  videoBlob: Blob,
  samples: OrientationSample[],
  recordedDurationMs: number,
  onProgress?: (pct: number) => void,
): Promise<CapturedSphereFrame[]> {
  const url = URL.createObjectURL(videoBlob);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not load recorded video"));
    });

    const durationMs = await resolveDuration(video, recordedDurationMs);

    const hasTimeline = timelineCoveragePct(samples) >= 40;
    const points = hasTimeline
      ? candidatesFromTimeline(samples, durationMs)
      : candidatesFromConstantRotation(durationMs);

    if (!points.length) throw new Error("No frames to extract");

    // Forward-only seeks are dramatically faster on mobile
    points.sort((a, b) => a.timeMs - b.timeMs);

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unsupported");

    const best = new Map<number, CapturedSphereFrame>();

    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      await seekTo(video, Math.min(point.timeMs, durationMs - 50) / 1000);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const quality = analyzeFrame(canvas);

      const existing = best.get(point.bucketIndex);
      if (!existing || quality.sharpness > existing.sharpness) {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", 0.92),
        );
        if (blob) {
          best.set(point.bucketIndex, {
            bucketIndex: point.bucketIndex,
            yaw: point.yaw,
            pitch: 0,
            blob,
            sharpness: quality.sharpness,
            brightness: quality.brightness,
            exposure: quality.brightness,
            devicePitch: point.devicePitch,
            deviceRoll: point.deviceRoll,
          });
        }
      }

      onProgress?.(Math.round(((i + 1) / points.length) * 100));
    }

    return [...best.values()].sort((a, b) => a.bucketIndex - b.bucketIndex);
  } finally {
    video.src = "";
    URL.revokeObjectURL(url);
  }
}
