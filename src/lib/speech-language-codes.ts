import { ELEVENLABS_AUTO_LANGUAGE, toElevenLabsAgentLanguage } from "@/lib/elevenlabs-languages";

/** Map walkthrough / global voice codes to Chrome SpeechRecognition `lang`. */
export function toChromeSpeechLang(code: string): string {
  if (!code || code === ELEVENLABS_AUTO_LANGUAGE) return "en-US";

  const map: Record<string, string> = {
    en: "en-US",
    hi: "hi-IN",
    ur: "ur-PK",
    ta: "ta-IN",
    te: "te-IN",
    kn: "kn-IN",
    ml: "ml-IN",
    mr: "mr-IN",
    pa: "pa-IN",
    gu: "gu-IN",
    bho: "hi-IN",
    es: "es-ES",
    fr: "fr-FR",
    de: "de-DE",
    pt: "pt-BR",
    it: "it-IT",
    ja: "ja-JP",
    ko: "ko-KR",
    ar: "ar-SA",
    zh: "zh-CN",
  };

  return map[code] ?? `${toElevenLabsAgentLanguage(code)}-${code === "en" ? "US" : "IN"}`;
}

/** ElevenLabs Scribe realtime language code (ISO 639-1). */
export function toScribeLanguageCode(code: string): string | undefined {
  if (!code || code === ELEVENLABS_AUTO_LANGUAGE) return undefined;
  return toElevenLabsAgentLanguage(code);
}

export function isChromeSpeechRecognitionAvailable(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as Window & {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}
