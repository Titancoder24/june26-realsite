/** Exponential smoothing — higher = snappier, lower = smoother. */
const SMOOTHING = 0.18;

/** Gate noise floor (raw analyser 0–1). */
const SILENCE_THRESHOLD = 0.04;

/**
 * Maps raw mic level (0–1) to orb scale:
 * silent → 1.0, soft → ~1.08, normal → ~1.18, loud → 1.30 max
 */
export function orbScaleFromVolume(level: number): number {
  if (level <= SILENCE_THRESHOLD) return 1;

  const normalized = Math.min(1, (level - SILENCE_THRESHOLD) / (1 - SILENCE_THRESHOLD));
  const curved = Math.pow(normalized, 0.55);
  return 1 + curved * 0.3;
}

export function smoothVolume(raw: number, previous: number): number {
  const clamped = Math.max(0, Math.min(1, raw));
  if (clamped <= SILENCE_THRESHOLD) {
    return previous * (1 - SMOOTHING);
  }
  return previous * (1 - SMOOTHING) + clamped * SMOOTHING;
}

export function createVolumeSmoother() {
  let smoothed = 0;
  return {
    push(raw: number): number {
      smoothed = smoothVolume(raw, smoothed);
      return smoothed;
    },
    reset() {
      smoothed = 0;
    },
    get scale() {
      return orbScaleFromVolume(smoothed);
    },
    get level() {
      return smoothed;
    },
  };
}
