"use client";

import { useCallback, useEffect, useRef } from "react";

type ContinuousVoiceOptions = {
  enabled: boolean;
  /** Pause utterance detection while agent speaks (keep stream hot). */
  paused: boolean;
  onUtterance: (blob: Blob) => void | Promise<void>;
  onListeningChange?: (listening: boolean) => void;
  onVolume?: (level: number) => void;
  silenceMs?: number;
  minSpeechMs?: number;
};

function rmsFromAnalyser(analyser: AnalyserNode): number {
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteTimeDomainData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const v = (data[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / data.length);
}

export function useContinuousVoiceCapture({
  enabled,
  paused,
  onUtterance,
  onListeningChange,
  onVolume,
  silenceMs = 700,
  minSpeechMs = 280,
}: ContinuousVoiceOptions) {
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const speechStartRef = useRef<number | null>(null);
  const lastSpeechRef = useRef<number>(0);
  const processingRef = useRef(false);
  const enabledRef = useRef(enabled);
  const pausedRef = useRef(paused);
  enabledRef.current = enabled;
  pausedRef.current = paused;

  const onUtteranceRef = useRef(onUtterance);
  onUtteranceRef.current = onUtterance;
  const onListeningChangeRef = useRef(onListeningChange);
  onListeningChangeRef.current = onListeningChange;
  const onVolumeRef = useRef(onVolume);
  onVolumeRef.current = onVolume;

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startRecorder = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || !enabledRef.current || pausedRef.current) return;
    if (recorderRef.current?.state === "recording") return;

    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : undefined,
    });
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunksRef.current.push(e.data);
    };
    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      chunksRef.current = [];
      speechStartRef.current = null;
      if (blob.size > 0) {
        try {
          await onUtteranceRef.current(blob);
        } finally {
          processingRef.current = false;
          if (streamRef.current && enabledRef.current && !pausedRef.current) {
            startRecorder();
          }
        }
      } else {
        processingRef.current = false;
        if (streamRef.current && enabledRef.current && !pausedRef.current) {
          startRecorder();
        }
      }
    };
    recorderRef.current = recorder;
    recorder.start(120);
  }, []);

  const finalizeUtterance = useCallback(() => {
    if (processingRef.current || pausedRef.current) return;
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    processingRef.current = true;
    recorder.stop();
  }, []);

  const startVolumeLoop = useCallback(
    (analyser: AnalyserNode) => {
      const tick = () => {
        const level = rmsFromAnalyser(analyser);
        onVolumeRef.current?.(level);
        const now = performance.now();
        const threshold = 0.018;

        if (!pausedRef.current && !processingRef.current) {
          if (level > threshold) {
            lastSpeechRef.current = now;
            if (!speechStartRef.current) speechStartRef.current = now;
          } else if (speechStartRef.current) {
            const spokeFor = now - speechStartRef.current;
            const silentFor = now - lastSpeechRef.current;
            if (silentFor >= silenceMs && spokeFor >= minSpeechMs) {
              finalizeUtterance();
            }
          }
        }

        rafRef.current = requestAnimationFrame(tick);
      };
      stopLoop();
      tick();
    },
    [finalizeUtterance, minSpeechMs, silenceMs, stopLoop],
  );

  // Boot / teardown mic stream — only when `enabled` changes.
  useEffect(() => {
    if (!enabled) {
      stopLoop();
      onListeningChangeRef.current?.(false);
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      recorderRef.current = null;
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const ctx = audioCtxRef.current ?? new AudioContext();
        audioCtxRef.current = ctx;
        if (ctx.state === "suspended") await ctx.resume();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        const source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);
        onListeningChangeRef.current?.(true);
        if (!pausedRef.current) startRecorder();
        startVolumeLoop(analyser);
      } catch {
        onListeningChangeRef.current?.(false);
      }
    })();

    return () => {
      cancelled = true;
      stopLoop();
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      recorderRef.current = null;
      onListeningChangeRef.current?.(false);
    };
  }, [enabled, startRecorder, startVolumeLoop, stopLoop]);

  // Pause/resume utterance detection without tearing down the mic stream.
  useEffect(() => {
    if (!enabled || !streamRef.current) return;
    if (paused) {
      speechStartRef.current = null;
      if (recorderRef.current?.state === "recording" && !processingRef.current) {
        recorderRef.current.stop();
        processingRef.current = false;
      }
      return;
    }
    if (!processingRef.current && recorderRef.current?.state !== "recording") {
      startRecorder();
    }
  }, [paused, enabled, startRecorder]);

  return {
    isHot: Boolean(streamRef.current),
  };
}
