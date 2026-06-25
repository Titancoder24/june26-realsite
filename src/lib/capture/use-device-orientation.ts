"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface OrientationState {
  heading: number | null;
  pitch: number | null;
  roll: number | null;
  supported: boolean;
  permission: "granted" | "denied" | "prompt" | "unknown";
}

function readHeading(e: DeviceOrientationEvent): number | null {
  const ios = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
  if (typeof ios === "number" && !Number.isNaN(ios)) return ios;
  if (e.alpha != null && !Number.isNaN(e.alpha)) return (360 - e.alpha) % 360;
  return null;
}

export function useDeviceOrientation() {
  const [state, setState] = useState<OrientationState>({
    heading: null,
    pitch: null,
    roll: null,
    supported: typeof window !== "undefined" && "DeviceOrientationEvent" in window,
    permission: "unknown",
  });
  const activeRef = useRef(false);

  const onMotion = useCallback((e: DeviceOrientationEvent) => {
    const heading = readHeading(e);
    setState((s) => ({
      ...s,
      heading,
      pitch: e.beta ?? null,
      roll: e.gamma ?? null,
      permission: "granted",
    }));
  }, []);

  const requestAccess = useCallback(async () => {
    if (!state.supported) {
      setState((s) => ({ ...s, permission: "denied" }));
      return false;
    }

    const req = (DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<"granted" | "denied">;
    }).requestPermission;

    if (typeof req === "function") {
      try {
        const result = await req();
        if (result !== "granted") {
          setState((s) => ({ ...s, permission: "denied" }));
          return false;
        }
      } catch {
        setState((s) => ({ ...s, permission: "denied" }));
        return false;
      }
    }

    if (!activeRef.current) {
      window.addEventListener("deviceorientation", onMotion, true);
      activeRef.current = true;
    }
    setState((s) => ({ ...s, permission: "granted" }));
    return true;
  }, [onMotion, state.supported]);

  const stop = useCallback(() => {
    if (activeRef.current) {
      window.removeEventListener("deviceorientation", onMotion, true);
      activeRef.current = false;
    }
  }, [onMotion]);

  useEffect(() => () => stop(), [stop]);

  const isUpright = state.pitch != null && Math.abs(state.pitch - 90) <= 18;

  return { ...state, isUpright, requestAccess, stop };
}
