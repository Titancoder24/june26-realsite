"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WalkthroughVoicePreferences } from "@/lib/walkthrough-voice-providers";

function floatToPcm16(samples: Float32Array): Uint8Array {
  const buffer = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buffer);
}

type RealtimeProcessContext = {
  organizationId: string;
  propertyId: string;
  experienceId: string;
  sessionId?: string;
  activeSceneId?: string;
  prefs: WalkthroughVoicePreferences;
};

export function useSarvamRealtimeVoice({
  enabled,
  paused,
  prefs,
  context,
  onUtteranceReady,
  onListeningChange,
  onVolume,
}: {
  enabled: boolean;
  paused: boolean;
  prefs: WalkthroughVoicePreferences;
  context: RealtimeProcessContext;
  onUtteranceReady: (transcript: string) => Promise<void>;
  onListeningChange?: (listening: boolean) => void;
  onVolume?: (level: number) => void;
}) {
  const [realtimeSessionId, setRealtimeSessionId] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const processingUtteranceRef = useRef(false);
  const onUtteranceReadyRef = useRef(onUtteranceReady);
  onUtteranceReadyRef.current = onUtteranceReady;

  const pushLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pcmChunksRef = useRef<Uint8Array[]>([]);

  const flushPcm = useCallback(async () => {
    if (!realtimeSessionId || pcmChunksRef.current.length === 0) return;
    const parts = pcmChunksRef.current;
    pcmChunksRef.current = [];
    const total = parts.reduce((n, p) => n + p.length, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
      merged.set(part, offset);
      offset += part.length;
    }
    let binary = "";
    for (let i = 0; i < merged.length; i++) binary += String.fromCharCode(merged[i]);
    const pcmBase64 = btoa(binary);
    try {
      const res = await fetch("/api/walkthrough/voice/realtime/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: realtimeSessionId, pcmBase64 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;

      if (data.utteranceReady && data.transcript && !processingUtteranceRef.current && !paused) {
        processingUtteranceRef.current = true;
        try {
          await onUtteranceReadyRef.current(data.transcript);
        } finally {
          processingUtteranceRef.current = false;
        }
      }
    } catch {
      // keep session alive on transient errors
    }
  }, [realtimeSessionId, paused]);

  useEffect(() => {
    if (!enabled) {
      onListeningChange?.(false);
      if (pushLoopRef.current) clearInterval(pushLoopRef.current);
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (realtimeSessionId) {
        fetch(`/api/walkthrough/voice/realtime/session?sessionId=${realtimeSessionId}`, {
          method: "DELETE",
        }).catch(() => {});
        setRealtimeSessionId(null);
      }
      return;
    }

    let cancelled = false;

    async function boot() {
      try {
        const sessionRes = await fetch("/api/walkthrough/voice/realtime/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ speechLanguageCode: prefs.speechLanguageCode }),
        });
        const sessionData = await sessionRes.json().catch(() => ({}));
        if (!sessionRes.ok) throw new Error(sessionData.error ?? "Realtime session failed");
        if (cancelled) return;
        setRealtimeSessionId(sessionData.sessionId);

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

        const ctx = new AudioContext({ sampleRate: 16000 });
        audioCtxRef.current = ctx;
        if (ctx.state === "suspended") await ctx.resume();

        const source = ctx.createMediaStreamSource(stream);
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (paused || processingUtteranceRef.current) return;
          const input = e.inputBuffer.getChannelData(0);
          let sum = 0;
          for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
          onVolume?.(Math.sqrt(sum / input.length));

          pcmChunksRef.current.push(floatToPcm16(input));
        };

        source.connect(processor);
        processor.connect(ctx.destination);
        onListeningChange?.(true);

        pushLoopRef.current = setInterval(() => {
          void flushPcm();
        }, 120);
      } catch {
        onListeningChange?.(false);
      }
    }

    boot();

    return () => {
      cancelled = true;
      if (pushLoopRef.current) clearInterval(pushLoopRef.current);
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      onListeningChange?.(false);
    };
  }, [enabled, flushPcm, onListeningChange, onVolume, paused, prefs.speechLanguageCode]);

  const processTranscript = useCallback(
    async (transcript: string) => {
      const res = await fetch("/api/walkthrough/voice/realtime/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: context.organizationId,
          propertyId: context.propertyId,
          experienceId: context.experienceId,
          sessionId: context.sessionId,
          activeSceneId: context.activeSceneId,
          transcript,
          voiceProfile: context.prefs.voiceProfile,
          speechLanguageCode: context.prefs.speechLanguageCode,
          chatLanguageCode: context.prefs.chatLanguageCode,
        }),
      });
      return res;
    },
    [context],
  );

  return { realtimeSessionId, processTranscript };
}
