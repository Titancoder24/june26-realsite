"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createVolumeSmoother } from "@/lib/voice-mode/orb-volume";
import { requestMicAccess } from "@/lib/voice-mode/mic-access";
import { voiceModeLog } from "@/lib/voice-mode/voice-mode-log";

export type MicPermissionState = "unknown" | "granted" | "denied" | "not_found" | "unsupported";

function sampleAnalyserVolume(analyser: AnalyserNode): number {
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  return sum / data.length / 255;
}

export function useVoiceMicMonitor({
  enabled,
  onVolume,
  onError,
  /** When true, release the mic hardware after permission so Scribe can open its own stream. */
  releaseForStt = false,
  /** After STT owns the mic, open a lightweight stream for orb visualization only. */
  volumeOnlyAfterRelease = false,
}: {
  enabled: boolean;
  onVolume?: (level: number) => void;
  onError?: (message: string) => void;
  releaseForStt?: boolean;
  volumeOnlyAfterRelease?: boolean;
}) {
  const [permission, setPermission] = useState<MicPermissionState>("unknown");
  const [active, setActive] = useState(false);
  const [volume, setVolume] = useState(0);
  const [orbScale, setOrbScale] = useState(1);
  const [failed, setFailed] = useState(false);
  const [releasedForStt, setReleasedForStt] = useState(false);
  const [deviceId, setDeviceId] = useState<string | undefined>();

  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const permissionAttemptedRef = useRef(false);
  const volumeOnlyAttemptedRef = useRef(false);
  const smootherRef = useRef(createVolumeSmoother());
  const onVolumeRef = useRef(onVolume);
  const onErrorRef = useRef(onError);
  onVolumeRef.current = onVolume;
  onErrorRef.current = onError;

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    stopLoop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    analyserRef.current = null;
    setActive(false);
  }, [stopLoop]);

  const releaseTracksForStt = useCallback(() => {
    voiceModeLog("mic_released_for_scribe");
    stopStream();
    smootherRef.current.reset();
    setVolume(0);
    setOrbScale(1);
    onVolumeRef.current?.(0);
    setReleasedForStt(true);
  }, [stopStream]);

  const attachAnalyser = useCallback(async (stream: MediaStream) => {
    streamRef.current = stream;
    const trackDeviceId = stream.getAudioTracks()[0]?.getSettings().deviceId;
    if (trackDeviceId) setDeviceId(trackDeviceId);

    const ctx = audioContextRef.current ?? new AudioContext();
    audioContextRef.current = ctx;
    if (ctx.state === "suspended") await ctx.resume();
    voiceModeLog("audio_context_created", { state: ctx.state });

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);
    analyserRef.current = analyser;
    voiceModeLog("analyser_created", { fftSize: analyser.fftSize });

    setActive(true);
    return analyser;
  }, []);

  const startLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    stopLoop();
    const tick = () => {
      const raw = sampleAnalyserVolume(analyser);
      const level = smootherRef.current.push(raw);
      const scale = smootherRef.current.scale;
      setVolume(level);
      setOrbScale(scale);
      onVolumeRef.current?.(level);
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, [stopLoop]);

  // Phase 1: permission + optional brief volume sample, then release for Scribe.
  useEffect(() => {
    if (!enabled) {
      permissionAttemptedRef.current = false;
      volumeOnlyAttemptedRef.current = false;
      setFailed(false);
      setReleasedForStt(false);
      smootherRef.current.reset();
      stopStream();
      return;
    }

    if (permissionAttemptedRef.current || failed) return;
    permissionAttemptedRef.current = true;
    voiceModeLog("attempting_microphone_start");

    let cancelled = false;

    void (async () => {
      const result = await requestMicAccess();
      if (cancelled) return;

      if (!result.ok) {
        voiceModeLog("microphone_permission", { granted: false, reason: result.reason, message: result.message });
        setFailed(true);
        setPermission(
          result.reason === "denied"
            ? "denied"
            : result.reason === "not_found"
              ? "not_found"
              : result.reason === "unsupported"
                ? "unsupported"
                : "unknown",
        );
        onErrorRef.current?.(result.message);
        return;
      }

      setPermission("granted");
      voiceModeLog("microphone_permission", { granted: true });
      voiceModeLog("media_stream_acquired", {
        tracks: result.stream.getAudioTracks().length,
      });

      if (releaseForStt) {
        result.stream.getTracks().forEach((track) => track.stop());
        setReleasedForStt(true);
        voiceModeLog("mic_released_for_scribe", { immediate: true });
        return;
      }

      await attachAnalyser(result.stream);
      voiceModeLog("listening_active", { source: "mic_monitor" });
      startLoop();
    })();

    return () => {
      cancelled = true;
    };
  }, [attachAnalyser, enabled, failed, releaseForStt, startLoop, stopStream]);

  // Release tracks when Scribe is about to connect (parent sets releaseForStt).
  useEffect(() => {
    if (!enabled || !releaseForStt || releasedForStt || failed) return;
    if (!streamRef.current) return;
    releaseTracksForStt();
  }, [enabled, failed, releaseForStt, releasedForStt, releaseTracksForStt]);

  // Phase 2: volume-only stream for orb after Scribe owns STT mic.
  useEffect(() => {
    if (!enabled || !volumeOnlyAfterRelease || !releasedForStt || failed) return;
    if (volumeOnlyAttemptedRef.current) return;
    volumeOnlyAttemptedRef.current = true;

    let cancelled = false;

    void (async () => {
      voiceModeLog("volume_only_stream_start");
      const result = await requestMicAccess();
      if (cancelled) return;
      if (!result.ok) {
        voiceModeLog("volume_only_stream_failed", { reason: result.reason });
        return;
      }

      await attachAnalyser(result.stream);
      voiceModeLog("volume_only_stream_active");
      startLoop();
    })();

    return () => {
      cancelled = true;
    };
  }, [attachAnalyser, enabled, failed, releasedForStt, startLoop, volumeOnlyAfterRelease]);

  useEffect(() => {
    if (!enabled) return;
    return () => stopStream();
  }, [enabled, stopStream]);

  return {
    permission,
    active,
    volume,
    orbScale,
    failed,
    releasedForStt,
    deviceId,
    releaseTracksForStt,
    pauseLoop: stopLoop,
    resumeLoop: startLoop,
  };
}
