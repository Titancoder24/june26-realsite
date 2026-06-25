import type { MotionType } from "@/types/scene-intelligence";

export interface MotionKeyframe {
  /** Progress 0–1 through the scene */
  t: number;
  scale: number;
  translateX: number;
  translateY: number;
  rotate: number;
}

/** Browser-rendered Ken Burns keyframes per motion type */
export function getMotionKeyframes(type: MotionType, intensity = 1): MotionKeyframe[] {
  const k = Math.min(1.5, Math.max(0.5, intensity));

  const presets: Record<MotionType, MotionKeyframe[]> = {
    push_in: [
      { t: 0, scale: 1, translateX: 0, translateY: 0, rotate: 0 },
      { t: 1, scale: 1 + 0.12 * k, translateX: 0, translateY: 0, rotate: 0 },
    ],
    pull_out: [
      { t: 0, scale: 1 + 0.14 * k, translateX: 0, translateY: 0, rotate: 0 },
      { t: 1, scale: 1, translateX: 0, translateY: 0, rotate: 0 },
    ],
    truck_left: [
      { t: 0, scale: 1.05, translateX: 4 * k, translateY: 0, rotate: 0 },
      { t: 1, scale: 1.05, translateX: -4 * k, translateY: 0, rotate: 0 },
    ],
    truck_right: [
      { t: 0, scale: 1.05, translateX: -4 * k, translateY: 0, rotate: 0 },
      { t: 1, scale: 1.05, translateX: 4 * k, translateY: 0, rotate: 0 },
    ],
    pedestal_up: [
      { t: 0, scale: 1.08, translateX: 0, translateY: 3 * k, rotate: 0 },
      { t: 1, scale: 1.08, translateX: 0, translateY: -3 * k, rotate: 0 },
    ],
    pedestal_down: [
      { t: 0, scale: 1.08, translateX: 0, translateY: -3 * k, rotate: 0 },
      { t: 1, scale: 1.08, translateX: 0, translateY: 3 * k, rotate: 0 },
    ],
    slow_rotate: [
      { t: 0, scale: 1.06, translateX: -1 * k, translateY: 0, rotate: -0.4 * k },
      { t: 1, scale: 1.06, translateX: 1 * k, translateY: 0, rotate: 0.4 * k },
    ],
    drone_up: [
      { t: 0, scale: 1, translateX: 0, translateY: 5 * k, rotate: 0 },
      { t: 1, scale: 1.1 * k, translateX: 0, translateY: -2 * k, rotate: 0 },
    ],
    cinematic_zoom: [
      { t: 0, scale: 1, translateX: -2 * k, translateY: 1 * k, rotate: 0 },
      { t: 0.5, scale: 1.08 * k, translateX: 0, translateY: 0, rotate: 0 },
      { t: 1, scale: 1.14 * k, translateX: 2 * k, translateY: -1 * k, rotate: 0 },
    ],
    static_premium: [
      { t: 0, scale: 1, translateX: 0, translateY: 0, rotate: 0 },
      { t: 0.5, scale: 1.02, translateX: 0, translateY: -0.3, rotate: 0 },
      { t: 1, scale: 1, translateX: 0, translateY: 0, rotate: 0 },
    ],
    depth_parallax: [
      { t: 0, scale: 1.04, translateX: -3 * k, translateY: 0, rotate: 0 },
      { t: 1, scale: 1.08, translateX: 3 * k, translateY: -1 * k, rotate: 0 },
    ],
  };

  return presets[type] ?? presets.push_in;
}

export function interpolateMotion(keyframes: MotionKeyframe[], progress: number): MotionKeyframe {
  const p = Math.min(1, Math.max(0, progress));
  let i = 0;
  while (i < keyframes.length - 1 && keyframes[i + 1].t < p) i++;
  const a = keyframes[i];
  const b = keyframes[Math.min(i + 1, keyframes.length - 1)];
  if (a.t === b.t) return a;
  const f = (p - a.t) / (b.t - a.t);
  return {
    t: p,
    scale: a.scale + (b.scale - a.scale) * f,
    translateX: a.translateX + (b.translateX - a.translateX) * f,
    translateY: a.translateY + (b.translateY - a.translateY) * f,
    rotate: a.rotate + (b.rotate - a.rotate) * f,
  };
}

/** Map normalized pin position through current image transform */
export function mapPinToScreen(
  x: number,
  y: number,
  frame: MotionKeyframe,
  crop: { x: number; y: number; width: number; height: number },
): { left: string; top: string } {
  const cx = crop.x + crop.width / 2;
  const cy = crop.y + crop.height / 2;
  const px = (x - cx) / crop.width;
  const py = (y - cy) / crop.height;
  const tx = 50 + px * 100 * frame.scale + frame.translateX;
  const ty = 50 + py * 100 * frame.scale + frame.translateY;
  return { left: `${tx}%`, top: `${ty}%` };
}
