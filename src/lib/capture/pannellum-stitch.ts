import { SPHERE_CAPTURE } from "@/lib/capture/capture-protocol";
import { refineFrameAlignment } from "@/lib/capture/frame-align";

export interface PanoramaConfig {
  type: "equirectangular";
  haov: number;
  vaov: number;
  vOffset: number;
  hfov: number;
}

export interface StitchResult {
  blob: Blob;
  config: PanoramaConfig;
}

export interface YawFrame {
  yaw: number;
  /** Device pitch (beta) in degrees — ~90 when phone is upright. */
  pitch?: number;
  /** Device roll (gamma) in degrees. */
  roll?: number;
  imageUrl?: string;
  blob?: Blob;
  exposure?: number;
}

const DEFAULT_VAOV = SPHERE_CAPTURE.targetVaov;
const PHONE_HFOV = SPHERE_CAPTURE.frameHfov;

interface LoadedFrame {
  centerYaw: number;
  pitchOffset: number;
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  exposure: number;
}

function normalizeYaw(yaw: number) {
  let y = yaw % 360;
  if (y > 180) y -= 360;
  if (y < -180) y += 360;
  return y;
}

function yawDelta(a: number, b: number) {
  return Math.abs(normalizeYaw(a - b));
}

function frameExposure(pixels: Uint8ClampedArray): number {
  let sum = 0;
  const step = 16;
  let n = 0;
  for (let i = 0; i < pixels.length; i += 4 * step) {
    sum += 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
    n++;
  }
  return n ? sum / n / 255 : 0.5;
}

async function loadFrameSource(frame: YawFrame): Promise<LoadedFrame> {
  let img: HTMLImageElement | ImageBitmap;

  if (frame.blob) {
    img = await createImageBitmap(frame.blob);
  } else if (frame.imageUrl) {
    img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = "anonymous";
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Failed to load frame"));
      el.src = frame.imageUrl!;
    });
  } else {
    throw new Error("Frame needs blob or imageUrl");
  }

  const canvas = document.createElement("canvas");
  canvas.width = "naturalWidth" in img ? img.naturalWidth : img.width;
  canvas.height = "naturalHeight" in img ? img.naturalHeight : img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.drawImage(img, 0, 0);
  if ("close" in img) (img as ImageBitmap).close();

  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const exp = frame.exposure ?? frameExposure(data);
  // Keep yaw in its monotonic 0..360 domain — wrap-safe ops handle projection,
  // and registration needs a monotonic chain.
  const pitchOffset =
    frame.pitch != null && Number.isFinite(frame.pitch)
      ? Math.max(-12, Math.min(12, frame.pitch - 90))
      : 0;

  return {
    centerYaw: frame.yaw,
    pitchOffset,
    pixels: data,
    width: canvas.width,
    height: canvas.height,
    exposure: exp,
  };
}

function sampleBilinear(
  pixels: Uint8ClampedArray,
  w: number,
  h: number,
  x: number,
  y: number,
  expScale: number,
): [number, number, number] {
  const cx = Math.max(0, Math.min(w - 1, x));
  const cy = Math.max(0, Math.min(h - 1, y));
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(x0 + 1, w - 1);
  const y1 = Math.min(y0 + 1, h - 1);
  const tx = cx - x0;
  const ty = cy - y0;

  const i00 = (y0 * w + x0) * 4;
  const i10 = (y0 * w + x1) * 4;
  const i01 = (y1 * w + x0) * 4;
  const i11 = (y1 * w + x1) * 4;

  const r =
    (pixels[i00] * (1 - tx) * (1 - ty) + pixels[i10] * tx * (1 - ty) +
      pixels[i01] * (1 - tx) * ty + pixels[i11] * tx * ty) * expScale;
  const g =
    (pixels[i00 + 1] * (1 - tx) * (1 - ty) + pixels[i10 + 1] * tx * (1 - ty) +
      pixels[i01 + 1] * (1 - tx) * ty + pixels[i11 + 1] * tx * ty) * expScale;
  const b =
    (pixels[i00 + 2] * (1 - tx) * (1 - ty) + pixels[i10 + 2] * tx * (1 - ty) +
      pixels[i01 + 2] * (1 - tx) * ty + pixels[i11 + 2] * tx * ty) * expScale;

  return [Math.min(255, r), Math.min(255, g), Math.min(255, b)];
}

function sampleRectilinear(frame: LoadedFrame, relYaw: number, pitch: number, vaov: number, targetExp: number) {
  const u = (relYaw / PHONE_HFOV + 0.5) * frame.width;
  const v = (0.5 - (pitch - frame.pitchOffset) / vaov) * frame.height;
  // Clamp gain so exposure normalization never blows out or crushes a frame
  const scale = Math.max(0.75, Math.min(1.35, targetExp / Math.max(0.08, frame.exposure)));
  return sampleBilinear(frame.pixels, frame.width, frame.height, u, v, scale);
}

const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0));

export interface StitchOptions {
  /** Target ~5s processing — lower resolution, coarser scan. */
  fast?: boolean;
}

export async function stitchFramesToEquirectangular(
  frames: { angleLabel?: string; imageUrl?: string; yaw?: number; blob?: Blob; exposure?: number; pitch?: number; roll?: number }[],
  onProgress?: (pct: number) => void,
  options?: StitchOptions,
): Promise<StitchResult> {
  const yawFrames: YawFrame[] = frames.map((f, i) => ({
    yaw: f.yaw ?? i * (360 / frames.length),
    imageUrl: f.imageUrl,
    blob: f.blob,
    exposure: f.exposure,
    pitch: f.pitch,
    roll: f.roll,
  }));

  if (yawFrames.length < 2) throw new Error("Need at least 2 frames");

  const ordered = [...yawFrames].sort((a, b) => a.yaw - b.yaw);
  const loaded = await Promise.all(ordered.map(loadFrameSource));
  const targetExp = loaded.reduce((s, f) => s + f.exposure, 0) / loaded.length;

  const haov = ordered.length >= SPHERE_CAPTURE.minBuckets ? 360 : Math.min(360, ordered.length * (PHONE_HFOV * 0.78));
  const vaov = DEFAULT_VAOV;
  const vOffset = 0;

  // Registration pass: align every seam by image content, not just the compass.
  // This is what removes shake/drift and makes seams invisible.
  try {
    await refineFrameAlignment(loaded, PHONE_HFOV, vaov);
  } catch {
    // Sensor-only placement still produces a valid panorama
  }

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const outW = options?.fast ? 2048 : isMobile ? 4096 : 8192;
  const outH = outW / 2;
  const rowStep = options?.fast ? 2 : 1;
  const yieldEvery = options?.fast ? 24 : 48;

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");

  const imageData = ctx.createImageData(outW, outH);
  const out = imageData.data;
  const total = outH * outW;

  for (let y = 0; y < outH; y += rowStep) {
    for (let x = 0; x < outW; x++) {
      const yaw = (x / outW) * haov - haov / 2;
      const pitch = vOffset + vaov / 2 - (y / outH) * vaov;

      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let wSum = 0;

      for (const frame of loaded) {
        const delta = yawDelta(yaw, frame.centerYaw);
        if (delta > PHONE_HFOV / 2 + 5) continue;

        const t = delta / (PHONE_HFOV / 2);
        const weight = Math.pow(Math.max(0, Math.cos(t * Math.PI / 2)), 2);
        const [r, g, b] = sampleRectilinear(frame, normalizeYaw(yaw - frame.centerYaw), pitch, vaov, targetExp);
        rSum += r * weight;
        gSum += g * weight;
        bSum += b * weight;
        wSum += weight;
      }

      const idx = (y * outW + x) * 4;
      if (wSum > 0.01) {
        out[idx] = Math.round(rSum / wSum);
        out[idx + 1] = Math.round(gSum / wSum);
        out[idx + 2] = Math.round(bSum / wSum);
        out[idx + 3] = 255;
      }
    }
    if (y % yieldEvery === 0) {
      onProgress?.(Math.round(((y * outW) / total) * 100));
      await yieldToUi();
    }
  }

  // Fast mode: fill skipped rows by duplicating nearest rendered row
  if (rowStep > 1) {
    for (let y = 0; y < outH; y++) {
      const srcY = Math.floor(y / rowStep) * rowStep;
      if (y === srcY) continue;
      for (let x = 0; x < outW; x++) {
        const dst = (y * outW + x) * 4;
        const src = (srcY * outW + x) * 4;
        out[dst] = out[src];
        out[dst + 1] = out[src + 1];
        out[dst + 2] = out[src + 2];
        out[dst + 3] = 255;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  onProgress?.(100);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Export failed"))), "image/jpeg", 0.96);
  });

  return { blob, config: { type: "equirectangular", haov, vaov, vOffset, hfov: 100 } };
}

export function scoreCaptureQuality(frameCount: number): string {
  if (frameCount >= SPHERE_CAPTURE.bucketCount) return "Excellent";
  if (frameCount >= SPHERE_CAPTURE.minBuckets) return "Great";
  if (frameCount >= 20) return "Good";
  if (frameCount >= 12) return "Fair";
  return "Needs retake";
}
