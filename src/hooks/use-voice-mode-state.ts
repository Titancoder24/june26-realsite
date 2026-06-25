"use client";

import { useCallback, useRef, useState } from "react";
import type { VoiceModeState } from "@/lib/voice-mode/types";

export function useVoiceModeState(initial: VoiceModeState = "GREETING") {
  const [state, setState] = useState<VoiceModeState>(initial);
  const stateRef = useRef(state);
  stateRef.current = state;

  const transition = useCallback((next: VoiceModeState) => {
    if (process.env.NODE_ENV === "development") {
      console.info("[voice-mode] transition", { from: stateRef.current, to: next });
    }
    setState(next);
  }, []);

  const isListeningPhase = state === "LISTENING" || state === "TRANSCRIBING";
  const isBusy =
    state === "GREETING"
    || state === "THINKING"
    || state === "RESPONDING"
    || state === "NAVIGATING";

  return {
    state,
    stateRef,
    transition,
    isListeningPhase,
    isBusy,
  };
}
