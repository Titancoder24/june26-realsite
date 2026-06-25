/**
 * Image-based frame registration — refines noisy sensor yaw/pitch using the
 * actual pixel content of overlapping frames. This is what turns shaky
 * handheld capture into mounted-camera-quality stitches: every seam is
 * aligned by matching the images themselves, not the compass.
 */

export interface AlignableFrame {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  /** Yaw in a monotonic 0..360+ domain (sorted ascending). Refined in place. */
  centerYaw: number;
  /** Pitch offset above horizon in degrees. Refined in place. */
  pitchOffset: number;
}

const THUMB_W = 144;
/** Pairs further apart than this can't be registered reliably. */
const MAX_PAIR_GAP_DEG = 16;
/** Search window around the sensor-predicted shift (thumb px). */
const DX_SEARCH = 12;
const DY_SEARCH = 9;
/** Registration may move a frame at most this far from the sensor reading. */
const MAX_YAW_CORRECTION_DEG = 3.5;
const MAX_PITCH_OFFSET_DEG = 10;

interface Thumb {
  l: Float32Array;
  w: number;
  h: number;
  mean: number;
}

function makeThumb(f: AlignableFrame): Thumb {
  const w = THUMB_W;
  const h = Math.max(40, Math.round((f.height / f.width) * THUMB_W));
  const l = new Float32Array(w * h);
  let sum = 0;
  for (let y = 0; y < h; y++) {
    const sy = Math.min(f.height - 1, Math.round(((y + 0.5) / h) * f.height));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(f.width - 1, Math.round(((x + 0.5) / w) * f.width));
      const i = (sy * f.width + sx) * 4;
      const v = 0.299 * f.pixels[i] + 0.587 * f.pixels[i + 1] + 0.114 * f.pixels[i + 2];
      l[y * w + x] = v;
      sum += v;
    }
  }
  return { l, w, h, mean: sum / (w * h) };
}

/** Mean-normalized SAD between A shifted by (s, dy) and B — exposure invariant. */
function zeroMeanSad(a: Thumb, b: Thumb, s: number, dy: number): number {
  const xStart = Math.max(0, -s);
  const xEnd = Math.min(b.w, a.w - s);
  const yStart = Math.max(0, -dy);
  const yEnd = Math.min(b.h, a.h - dy);
  if (xEnd - xStart < 24 || yEnd - yStart < 16) return Infinity;

  const bias = a.mean - b.mean;
  let sad = 0;
  let n = 0;
  for (let y = yStart; y < yEnd; y += 2) {
    const rowA = (y + dy) * a.w + s;
    const rowB = y * b.w;
    for (let x = xStart; x < xEnd; x += 2) {
      sad += Math.abs(a.l[rowA + x] - b.l[rowB + x] - bias);
      n++;
    }
  }
  return n ? sad / n : Infinity;
}

/** Parabolic sub-pixel refinement around a discrete minimum. */
function subPixelPeak(prev: number, best: number, next: number): number {
  const denom = prev - 2 * best + next;
  if (!Number.isFinite(denom) || Math.abs(denom) < 1e-6) return 0;
  const delta = (0.5 * (prev - next)) / denom;
  return Math.max(-1, Math.min(1, delta));
}

interface PairResult {
  dyawDeg: number;
  dpitchDeg: number;
  ok: boolean;
}

function alignPair(
  a: Thumb,
  b: Thumb,
  expectedDeltaDeg: number,
  hfovDeg: number,
  vaovDeg: number,
): PairResult {
  const expectedS = Math.round((expectedDeltaDeg / hfovDeg) * THUMB_W);

  let bestS = expectedS;
  let bestDy = 0;
  let bestVal = Infinity;
  const vals: number[] = [];

  for (let s = expectedS - DX_SEARCH; s <= expectedS + DX_SEARCH; s++) {
    for (let dy = -DY_SEARCH; dy <= DY_SEARCH; dy++) {
      const v = zeroMeanSad(a, b, s, dy);
      vals.push(v);
      if (v < bestVal) {
        bestVal = v;
        bestS = s;
        bestDy = dy;
      }
    }
  }

  if (!Number.isFinite(bestVal)) return { dyawDeg: expectedDeltaDeg, dpitchDeg: 0, ok: false };

  // Confidence: minimum should be clearly below the median candidate cost
  const finite = vals.filter(Number.isFinite).sort((x, y) => x - y);
  const median = finite[Math.floor(finite.length / 2)] ?? Infinity;
  const confident = bestVal < median * 0.8;

  // Sub-pixel refinement on both axes
  const sPrev = zeroMeanSad(a, b, bestS - 1, bestDy);
  const sNext = zeroMeanSad(a, b, bestS + 1, bestDy);
  const dyPrev = zeroMeanSad(a, b, bestS, bestDy - 1);
  const dyNext = zeroMeanSad(a, b, bestS, bestDy + 1);
  const sSub = bestS + subPixelPeak(sPrev, bestVal, sNext);
  const dySub = bestDy + subPixelPeak(dyPrev, bestVal, dyNext);

  const dyawDeg = (sSub / THUMB_W) * hfovDeg;
  const dpitchDeg = (-dySub * vaovDeg) / a.h;

  return { dyawDeg, dpitchDeg, ok: confident };
}

const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * Refines centerYaw and pitchOffset of every frame in place.
 * Frames must be sorted by centerYaw ascending in a monotonic domain.
 */
export async function refineFrameAlignment(
  frames: AlignableFrame[],
  hfovDeg: number,
  vaovDeg: number,
  onProgress?: (pct: number) => void,
): Promise<void> {
  const n = frames.length;
  if (n < 4) return;

  const thumbs = frames.map(makeThumb);

  const wrapGap = frames[0].centerYaw + 360 - frames[n - 1].centerYaw;
  const fullCircle = wrapGap < MAX_PAIR_GAP_DEG;
  const pairCount = fullCircle ? n : n - 1;

  const deltas: number[] = [];
  const pitchDeltas: number[] = [];

  for (let i = 0; i < pairCount; i++) {
    const j = (i + 1) % n;
    const sensorDelta =
      j === 0 ? frames[0].centerYaw + 360 - frames[i].centerYaw : frames[j].centerYaw - frames[i].centerYaw;

    if (sensorDelta > MAX_PAIR_GAP_DEG || sensorDelta <= 0) {
      deltas.push(sensorDelta);
      pitchDeltas.push(0);
      continue;
    }

    const result = alignPair(thumbs[i], thumbs[j], sensorDelta, hfovDeg, vaovDeg);
    if (result.ok) {
      // Bound corrections so a bad match can't wreck the chain
      const clamped = Math.max(
        sensorDelta - MAX_YAW_CORRECTION_DEG,
        Math.min(sensorDelta + MAX_YAW_CORRECTION_DEG, result.dyawDeg),
      );
      deltas.push(clamped);
      pitchDeltas.push(Math.max(-3, Math.min(3, result.dpitchDeg)));
    } else {
      deltas.push(sensorDelta);
      pitchDeltas.push(0);
    }

    if (i % 10 === 9) {
      onProgress?.(Math.round((i / pairCount) * 100));
      await yieldToUi();
    }
  }

  // Loop closure: a full circle must sum to exactly 360°
  if (fullCircle) {
    const sum = deltas.reduce((s, d) => s + d, 0);
    const err = (sum - 360) / pairCount;
    for (let i = 0; i < deltas.length; i++) deltas[i] -= err;

    const pitchSum = pitchDeltas.reduce((s, d) => s + d, 0);
    const pitchErr = pitchSum / pairCount;
    for (let i = 0; i < pitchDeltas.length; i++) pitchDeltas[i] -= pitchErr;
  }

  // Integrate refined positions from the first frame
  let yaw = frames[0].centerYaw;
  let pitch = 0;
  const pitchChain: number[] = [pitch];
  for (let i = 1; i < n; i++) {
    yaw += deltas[i - 1];
    frames[i].centerYaw = yaw;
    pitch += pitchDeltas[i - 1];
    pitchChain.push(pitch);
  }

  // Remove mean pitch drift so the horizon stays level
  const meanPitch = pitchChain.reduce((s, p) => s + p, 0) / n;
  for (let i = 0; i < n; i++) {
    const refined = pitchChain[i] - meanPitch + frames[i].pitchOffset * 0.3;
    frames[i].pitchOffset = Math.max(-MAX_PITCH_OFFSET_DEG, Math.min(MAX_PITCH_OFFSET_DEG, refined));
  }

  onProgress?.(100);
}
