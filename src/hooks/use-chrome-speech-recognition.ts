"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toChromeSpeechLang } from "@/lib/speech-language-codes";

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: {
    resultIndex: number;
    results: {
      length: number;
      [index: number]: {
        isFinal: boolean;
        0?: { transcript?: string };
      };
    };
  }) => void) | null;
  start: () => void;
  abort: () => void;
};

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useChromeSpeechRecognition({
  enabled,
  paused,
  languageCode,
  onInterim,
  onFinal,
  onError,
}: {
  enabled: boolean;
  paused: boolean;
  languageCode: string;
  onInterim?: (text: string) => void;
  onFinal?: (text: string) => void;
  onError?: (message: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const enabledRef = useRef(enabled);
  const pausedRef = useRef(paused);
  enabledRef.current = enabled;
  pausedRef.current = paused;

  const stop = useCallback(() => {
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) {
      try {
        rec.abort();
      } catch {
        // ignore
      }
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor || !enabledRef.current || pausedRef.current) return;

    stop();

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = toChromeSpeechLang(languageCode);

    recognition.onstart = () => setListening(true);
    recognition.onend = () => {
      setListening(false);
      if (enabledRef.current && !pausedRef.current && recognitionRef.current === recognition) {
        try {
          recognition.start();
        } catch {
          // restart can fail if still stopping
        }
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "aborted" || event.error === "no-speech") return;
      onError?.(event.error);
    };

    recognition.onresult = (event) => {
      let interim = "";
      let finalText = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript?.trim() ?? "";
        if (!text) continue;
        if (result.isFinal) finalText = `${finalText} ${text}`.trim();
        else interim = `${interim} ${text}`.trim();
      }

      if (interim) onInterim?.(interim);
      if (finalText) onFinal?.(finalText);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Chrome speech recognition failed";
      onError?.(message);
      stop();
    }
  }, [languageCode, onError, onFinal, onInterim, stop]);

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }
    if (paused) {
      stop();
      return;
    }
    start();
    return () => stop();
  }, [enabled, paused, languageCode, start, stop]);

  return { listening, available: Boolean(getSpeechRecognitionCtor()) };
}
