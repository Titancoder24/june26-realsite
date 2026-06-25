"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentState } from "@/components/ui/orb";
import { playVoiceAudioBlob, stopVoiceAudio } from "@/lib/voice-mode/voice-audio";

function sampleAnalyserVolume(analyser: AnalyserNode): number {
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  return sum / data.length / 255;
}

export function useVoiceAgentOrb() {
  const [agentState, setAgentState] = useState<AgentState>(null);
  const inputVolumeRef = useRef(0);
  const outputVolumeRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const outputRafRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  const stopOutputRaf = useCallback(() => {
    if (outputRafRef.current !== null) {
      cancelAnimationFrame(outputRafRef.current);
      outputRafRef.current = null;
    }
  }, []);

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const stopActiveAudio = useCallback(() => {
    stopVoiceAudio();
    stopOutputRaf();
    outputVolumeRef.current = 0;
  }, [stopOutputRaf]);

  useEffect(() => {
    return () => {
      // Do NOT stop global greeting audio on unmount — Strict Mode remount would
      // kill in-flight playback and leave the greeting promise hung forever.
      stopRaf();
      micStreamRef.current = null;
    };
  }, [stopRaf]);

  const startMicVolumeLoop = useCallback(
    (stream: MediaStream, analyser: AnalyserNode) => {
      micStreamRef.current = stream;
      setAgentState("listening");
      const tick = () => {
        inputVolumeRef.current = sampleAnalyserVolume(analyser);
        rafRef.current = requestAnimationFrame(tick);
      };
      stopRaf();
      tick();
    },
    [stopRaf],
  );

  const stopMicVolumeLoop = useCallback(() => {
    stopRaf();
    inputVolumeRef.current = 0;
    micStreamRef.current = null;
  }, [stopRaf]);

  const createMicAnalyser = useCallback(async (stream: MediaStream) => {
    const ctx = audioContextRef.current ?? new AudioContext();
    audioContextRef.current = ctx;
    if (ctx.state === "suspended") await ctx.resume();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);
    return analyser;
  }, []);

  const playAudioBlob = useCallback(
    async (
      blob: Blob,
      hooks?: { onStarted?: () => void; onCompleted?: () => void },
    ): Promise<{ started: boolean; completed: boolean }> => {
      stopActiveAudio();
      setAgentState("talking");

      let outputRaf: number | null = null;
      const startedAt = performance.now();
      const pulseOutput = () => {
        const t = (performance.now() - startedAt) / 1000;
        outputVolumeRef.current = Math.min(
          1,
          Math.max(0, 0.55 + Math.sin(t * 4.8) * 0.28),
        );
        outputRaf = requestAnimationFrame(pulseOutput);
      };
      outputRaf = requestAnimationFrame(pulseOutput);

      try {
        const result = await playVoiceAudioBlob(blob, {
          onStarted: () => {
            hooks?.onStarted?.();
          },
          onCompleted: () => {
            hooks?.onCompleted?.();
          },
        });

        return result;
      } finally {
        if (outputRaf !== null) cancelAnimationFrame(outputRaf);
        stopOutputRaf();
        outputVolumeRef.current = 0;
        setAgentState(null);
      }
    },
    [stopActiveAudio, stopOutputRaf],
  );

  const setListening = useCallback(() => {
    setAgentState("listening");
  }, []);

  const setThinking = useCallback(() => {
    stopMicVolumeLoop();
    setAgentState("thinking");
  }, [stopMicVolumeLoop]);

  const reset = useCallback(() => {
    stopMicVolumeLoop();
    setAgentState(null);
  }, [stopMicVolumeLoop]);

  return {
    agentState,
    inputVolumeRef,
    outputVolumeRef,
    createMicAnalyser,
    startMicVolumeLoop,
    stopMicVolumeLoop,
    playAudioBlob,
    stopActiveAudio,
    setThinking,
    setListening,
    reset,
  };
}
