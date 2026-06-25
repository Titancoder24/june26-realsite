"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChromeSpeechRecognition } from "@/hooks/use-chrome-speech-recognition";
import { useScribe, type CommitStrategy } from "@/hooks/use-scribe";
import { voiceModeLog } from "@/lib/voice-mode/voice-mode-log";
import { isChromeSpeechRecognitionAvailable, toScribeLanguageCode } from "@/lib/speech-language-codes";
import { readJsonResponse } from "@/lib/http-json";

const SCRIBE_MODEL = "scribe_v2_realtime";
const MAX_CONNECT_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500;
/** Commit latest partial if Scribe VAD does not finalize within this window. */
const PARTIAL_COMMIT_SILENCE_MS = 1000;

/** Chrome Web Speech is more reliable than Scribe realtime for buyer walkthroughs. */
function preferChromeStt(): boolean {
  return isChromeSpeechRecognitionAvailable();
}

function isTransientScribeError(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed || trimmed === "{}" || trimmed === "[object Object]") return true;
  if (/websocket error:\s*\{\}/i.test(trimmed)) return true;
  if (/websocket closed unexpectedly:\s*1006/i.test(trimmed)) return true;
  if (/connection aborted/i.test(trimmed)) return true;
  if (/closed before session started/i.test(trimmed)) return true;
  return false;
}

export function useWalkthroughRealtimeStt({
  enabled,
  commitPaused = false,
  languageCode,
  organizationId,
  onCommitted,
  onPartial,
  onListeningChange,
  onScribeConnected,
  onError,
  onScribeFailed,
}: {
  enabled: boolean;
  commitPaused?: boolean;
  languageCode: string;
  organizationId?: string;
  onCommitted: (text: string) => void;
  onPartial?: (text: string) => void;
  onListeningChange?: (listening: boolean) => void;
  onScribeConnected?: (connected: boolean) => void;
  onError?: (message: string) => void;
  onScribeFailed?: (failed: boolean) => void;
}) {
  const [chromeInterim, setChromeInterim] = useState("");
  const [scribeFailed, setScribeFailed] = useState(() => preferChromeStt());
  const [sessionReady, setSessionReady] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const chromeFallbackAvailable = isChromeSpeechRecognitionAvailable();
  const usingChromeStt = enabled && scribeFailed && chromeFallbackAvailable;

  const generationRef = useRef(0);
  const scribeConnectedRef = useRef(false);
  const connectingRef = useRef(false);
  const commitPausedRef = useRef(commitPaused);
  commitPausedRef.current = commitPaused;

  const latestPartialRef = useRef("");
  const partialSilenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCommittedPartialRef = useRef("");

  const onCommittedRef = useRef(onCommitted);
  onCommittedRef.current = onCommitted;
  const onPartialRef = useRef(onPartial);
  onPartialRef.current = onPartial;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onListeningChangeRef = useRef(onListeningChange);
  onListeningChangeRef.current = onListeningChange;
  const onScribeConnectedRef = useRef(onScribeConnected);
  onScribeConnectedRef.current = onScribeConnected;
  const onScribeFailedRef = useRef(onScribeFailed);
  onScribeFailedRef.current = onScribeFailed;

  const clearPartialSilenceTimer = useCallback(() => {
    if (partialSilenceTimerRef.current !== null) {
      clearTimeout(partialSilenceTimerRef.current);
      partialSilenceTimerRef.current = null;
    }
  }, []);

  const commitPartialIfNeeded = useCallback((reason: string) => {
    if (commitPausedRef.current) return;
    const text = latestPartialRef.current.trim();
    if (!text) return;
    if (text === lastCommittedPartialRef.current) return;

    lastCommittedPartialRef.current = text;
    latestPartialRef.current = "";
    voiceModeLog("utterance_committed", { text, reason });
    voiceModeLog("transcript_sent_to_backend", { text });
    onCommittedRef.current(text);
  }, []);

  const schedulePartialCommit = useCallback(() => {
    clearPartialSilenceTimer();
    partialSilenceTimerRef.current = setTimeout(() => {
      partialSilenceTimerRef.current = null;
      voiceModeLog("silence_detected", { timeoutMs: PARTIAL_COMMIT_SILENCE_MS });
      commitPartialIfNeeded("partial_silence_timeout");
    }, PARTIAL_COMMIT_SILENCE_MS);
  }, [clearPartialSilenceTimer, commitPartialIfNeeded]);

  const handlePartial = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      latestPartialRef.current = trimmed;
      voiceModeLog("partial_transcript_received", { text: trimmed.slice(0, 120) });
      onPartialRef.current?.(trimmed);
      schedulePartialCommit();
    },
    [schedulePartialCommit],
  );

  const reportError = useCallback((message: string, fatal = false) => {
    if (isTransientScribeError(message) && !fatal) return;
    voiceModeLog("scribe_error", { message, fatal });
    if (fatal) {
      setScribeFailed(true);
      onScribeFailedRef.current?.(true);
    }
    onErrorRef.current?.(message);
  }, []);

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const scheduleReconnectRef = useRef<(() => void) | null>(null);

  const scribe = useScribe({
    modelId: SCRIBE_MODEL,
    microphone: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    commitStrategy: "vad" as CommitStrategy,
    vadSilenceThresholdSecs: 0.8,
    vadThreshold: 0.35,
    minSpeechDurationMs: 150,
    minSilenceDurationMs: 500,
    onSessionStarted: () => {
      setSessionReady(true);
      voiceModeLog("scribe_realtime_connection_opened");
      voiceModeLog("audio_stream_attached_to_scribe");
    },
    onPartialTranscript: (data) => {
      handlePartial(data.text);
    },
    onCommittedTranscript: (data) => {
      clearPartialSilenceTimer();
      const text = data.text.trim();
      voiceModeLog("final_transcript_received", { text });
      if (commitPausedRef.current) return;
      if (!text) return;
      lastCommittedPartialRef.current = text;
      latestPartialRef.current = "";
      voiceModeLog("utterance_committed", { text, reason: "scribe_vad" });
      voiceModeLog("transcript_sent_to_backend", { text });
      onCommittedRef.current(text);
    },
    onConnect: () => {
      scribeConnectedRef.current = true;
      voiceModeLog("scribe_websocket_open");
    },
    onDisconnect: () => {
      scribeConnectedRef.current = false;
      setSessionReady(false);
      voiceModeLog("scribe_websocket_closed");
      onScribeConnectedRef.current?.(false);
      scheduleReconnectRef.current?.();
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : String(err);
      if (!isTransientScribeError(message)) reportError(message);
    },
    onAuthError: (data) => reportError(data.error, true),
    onQuotaExceededError: (data) => reportError(data.error, true),
    onTranscriberError: (data) => reportError(data.error, true),
  });

  const scribeRef = useRef(scribe);
  scribeRef.current = scribe;

  const chrome = useChromeSpeechRecognition({
    enabled: usingChromeStt,
    paused: commitPaused,
    languageCode,
    onInterim: (text) => {
      setChromeInterim(text);
      handlePartial(text);
    },
    onFinal: (text) => {
      setChromeInterim("");
      if (text.trim() && !commitPausedRef.current) {
        voiceModeLog("final_transcript_received", { text, source: "chrome" });
        voiceModeLog("utterance_committed", { text, reason: "chrome_final" });
        onCommittedRef.current(text.trim());
      }
    },
    onError: (message) => {
      if (message === "not-allowed") {
        reportError("Microphone access is blocked. Allow mic permission to use voice guide.", true);
        return;
      }
      if (message !== "network") {
        reportError(`Speech recognition: ${message}`);
      }
    },
  });

  const disconnectScribe = useCallback(() => {
    scribeRef.current.disconnect();
    scribeConnectedRef.current = false;
    setSessionReady(false);
    onScribeConnectedRef.current?.(false);
  }, []);

  const connectScribe = useCallback(async () => {
    if (connectingRef.current) return;
    connectingRef.current = true;
    setConnecting(true);
    setScribeFailed(false);
    onScribeFailedRef.current?.(false);
    voiceModeLog("scribe_connect_start", { languageCode });

    const generation = ++generationRef.current;
    let lastError = "Scribe realtime failed";
    let transientOnly = true;

    try {
      for (let attempt = 1; attempt <= MAX_CONNECT_ATTEMPTS; attempt += 1) {
        if (generation !== generationRef.current) return;

        try {
          voiceModeLog("scribe_token_requested", { attempt });
          const res = await fetch("/api/walkthrough/elevenlabs/scribe-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ organizationId }),
          });
          const data = await readJsonResponse<{ token?: string; error?: string }>(res);
          if (!res.ok || !data.token) {
            throw new Error(data.error ?? "Scribe token unavailable");
          }
          voiceModeLog("scribe_token_received", { attempt });
          if (generation !== generationRef.current) return;

          scribeRef.current.clearTranscripts();
          latestPartialRef.current = "";
          lastCommittedPartialRef.current = "";

          await scribeRef.current.connect({
            token: data.token,
            languageCode: toScribeLanguageCode(languageCode),
          });
          scribeConnectedRef.current = true;
          voiceModeLog("scribe_session_connected");
          return;
        } catch (err) {
          lastError = err instanceof Error ? err.message : "Scribe realtime failed";
          voiceModeLog("scribe_connect_attempt_failed", { attempt, lastError });
          if (!isTransientScribeError(lastError)) {
            transientOnly = false;
          }
          disconnectScribe();
          if (attempt < MAX_CONNECT_ATTEMPTS) {
            await new Promise((resolve) => window.setTimeout(resolve, RETRY_DELAY_MS * attempt));
          }
        }
      }

      voiceModeLog("scribe_connect_exhausted", { lastError, transientOnly, chromeFallbackAvailable });
      disconnectScribe();
      // Release mic hardware before Chrome fallback opens its own stream.
      await new Promise((resolve) => window.setTimeout(resolve, 350));

      if (chromeFallbackAvailable) {
        voiceModeLog("scribe_fallback_chrome");
        setScribeFailed(true);
        onScribeFailedRef.current?.(true);
        return;
      }

      reportError("Speech recognition failed. Please retry.", true);
    } finally {
      connectingRef.current = false;
      setConnecting(false);
    }
  }, [chromeFallbackAvailable, disconnectScribe, languageCode, organizationId, reportError]);

  scheduleReconnectRef.current = () => {
    if (!enabledRef.current || connectingRef.current || scribeFailed) return;
    window.setTimeout(() => {
      if (!enabledRef.current || connectingRef.current || scribeConnectedRef.current || scribeFailed) return;
      voiceModeLog("scribe_reconnect_scheduled");
      void connectScribe();
    }, RETRY_DELAY_MS);
  };

  useEffect(() => {
    if (!enabled) {
      generationRef.current += 1;
      clearPartialSilenceTimer();
      disconnectScribe();
      setScribeFailed(preferChromeStt());
      setSessionReady(false);
      onListeningChangeRef.current?.(false);
      onScribeFailedRef.current?.(false);
      return;
    }

    if (preferChromeStt()) {
      voiceModeLog("stt_chrome_primary");
      setScribeFailed(true);
      onScribeFailedRef.current?.(true);
      return;
    }

    void connectScribe();

    return () => {
      generationRef.current += 1;
      clearPartialSilenceTimer();
      disconnectScribe();
    };
  }, [clearPartialSilenceTimer, connectScribe, disconnectScribe, enabled]);

  const usingChromeFallback = usingChromeStt;
  const pipelineReady =
    enabled
    && (
      (sessionReady && scribe.isConnected)
      || (usingChromeStt && chrome.listening)
    );
  const listening = pipelineReady;

  useEffect(() => {
    onListeningChangeRef.current?.(listening);
  }, [listening]);

  useEffect(() => {
    onScribeConnectedRef.current?.(pipelineReady);
  }, [pipelineReady]);

  const livePartial = scribe.partialTranscript || chromeInterim;

  return {
    connected: scribe.isConnected,
    sessionReady,
    pipelineReady,
    listening,
    connecting,
    scribeFailed,
    usingChromeFallback,
    livePartial,
    chromeAvailable: chromeFallbackAvailable,
    scribeStatus: scribe.status,
    error: scribe.error,
  };
}
