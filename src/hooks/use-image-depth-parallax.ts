"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MAX_SHIFT_PX = 14;
const MAX_SCALE = 1.018;
const LERP = 0.12;

function prefersReducedMotion() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isLowPowerDevice() {
  if (typeof navigator === "undefined") return false;
  const cores = navigator.hardwareConcurrency ?? 4;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (conn?.saveData) return true;
  if (conn?.effectiveType && /(^2g$|^slow-2g$)/.test(conn.effectiveType)) return true;
  return cores < 2;
}

export function useImageDepthParallax(enabled: boolean, containerRef: React.RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(false);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const lowPower = useRef(false);

  useEffect(() => {
    lowPower.current = isLowPowerDevice();
    setActive(enabled && !prefersReducedMotion() && !lowPower.current);
  }, [enabled]);

  const tick = useCallback(() => {
    const cur = currentRef.current;
    const tgt = targetRef.current;
    cur.x += (tgt.x - cur.x) * LERP;
    cur.y += (tgt.y - cur.y) * LERP;

    if (Math.abs(cur.x - tgt.x) < 0.05 && Math.abs(cur.y - tgt.y) < 0.05 && tgt.x === 0 && tgt.y === 0) {
      cur.x = 0;
      cur.y = 0;
    }

    const dist = Math.sqrt(cur.x * cur.x + cur.y * cur.y);
    const scale = 1 + (dist / MAX_SHIFT_PX) * (MAX_SCALE - 1);
    setTransform({ x: cur.x, y: cur.y, scale });
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (!active) {
      targetRef.current = { x: 0, y: 0 };
      currentRef.current = { x: 0, y: 0 };
      setTransform({ x: 0, y: 0, scale: 1 });
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, tick]);

  useEffect(() => {
    if (!active) return;
    const el = containerRef.current;
    if (!el) return;

    const setTarget = (nx: number, ny: number) => {
      targetRef.current = {
        x: Math.max(-MAX_SHIFT_PX, Math.min(MAX_SHIFT_PX, nx)),
        y: Math.max(-MAX_SHIFT_PX, Math.min(MAX_SHIFT_PX, ny)),
      };
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const py = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      setTarget(px * MAX_SHIFT_PX * 0.55, py * MAX_SHIFT_PX * 0.55);
    };

    const onPointerLeave = () => setTarget(0, 0);

    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      const gx = Math.max(-1, Math.min(1, e.gamma / 30));
      const gy = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
      setTarget(gx * MAX_SHIFT_PX * 0.45, gy * MAX_SHIFT_PX * 0.35);
    };

    el.addEventListener("pointermove", onPointerMove, { passive: true });
    el.addEventListener("pointerleave", onPointerLeave, { passive: true });

    let orientationAttached = false;
    if (typeof DeviceOrientationEvent !== "undefined") {
      const attach = () => {
        window.addEventListener("deviceorientation", onOrientation, { passive: true });
        orientationAttached = true;
      };
      const req = (DeviceOrientationEvent as typeof DeviceOrientationEvent & {
        requestPermission?: () => Promise<string>;
      }).requestPermission;
      if (typeof req === "function") {
        req().then((s) => { if (s === "granted") attach(); }).catch(() => {});
      } else {
        attach();
      }
    }

    return () => {
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerleave", onPointerLeave);
      if (orientationAttached) window.removeEventListener("deviceorientation", onOrientation);
      setTarget(0, 0);
    };
  }, [active, containerRef]);

  return {
    transform,
    depthActive: active,
    lowPowerBlocked: lowPower.current,
    reducedMotion: prefersReducedMotion(),
  };
}
