import { env } from "@/lib/env";
import {
  DEFAULT_ELEVENLABS_ENABLED_LANGUAGES,
  DEFAULT_ELEVENLABS_WALKTHROUGH_LANGUAGE,
  ELEVENLABS_INDIAN_WALKTHROUGH_LANGUAGES,
  ELEVENLABS_INTERNATIONAL_WALKTHROUGH_LANGUAGES,
  normalizeEnabledElevenLabsLanguages,
  toElevenLabsAgentLanguage,
  type ElevenLabsLanguageMode,
  type ElevenLabsWalkthroughLanguageCode,
} from "@/lib/elevenlabs-languages";
import {
  GLOBAL_VOICE_LANGUAGES,
  isGlobalVoiceLanguageCode,
  type GlobalVoiceLanguageCode,
} from "@/lib/walkthrough-voice-providers";

/** Owner-configured ElevenLabs voice (stored on experience.viewer_config). */
export type ElevenLabsStudioVoiceConfig = {
  voice_id: string;
  language: GlobalVoiceLanguageCode;
  /** Languages buyers can pick on the walkthrough (owner configures in studio). */
  enabled_languages: ElevenLabsWalkthroughLanguageCode[];
  /** How buyers experience language: pick, owner default only, or auto-detect. */
  language_mode: ElevenLabsLanguageMode;
  /** ConvAI conversational TTS model id */
  convai_model: string;
  /** Batch TTS model for studio preview / fallback */
  tts_model: string;
  stability: number;
  similarity_boost: number;
  style: number;
  speed: number;
  use_speaker_boost: boolean;
  /** Per-language ElevenLabs voice ids (Hindi, Tamil, Telugu, etc.). */
  language_voices: Partial<Record<ElevenLabsWalkthroughLanguageCode, string>>;
};

export const ELEVENLABS_CONVAI_MODEL_OPTIONS = [
  { id: "eleven_v3_conversational", label: "Eleven v3 Conversational (recommended)" },
  { id: "eleven_flash_v2_5", label: "Eleven Flash v2.5" },
  { id: "eleven_flash_v2", label: "Eleven Flash v2" },
  { id: "eleven_multilingual_v2", label: "Eleven Multilingual v2" },
] as const;

export const DEFAULT_ELEVENLABS_STUDIO_VOICE: ElevenLabsStudioVoiceConfig = {
  voice_id: env.server.ELEVENLABS_VOICE_ID,
  language: DEFAULT_ELEVENLABS_WALKTHROUGH_LANGUAGE,
  enabled_languages: [...DEFAULT_ELEVENLABS_ENABLED_LANGUAGES],
  language_mode: "auto_detect",
  convai_model: "eleven_flash_v2_5",
  tts_model: env.server.ELEVENLABS_TTS_MODEL,
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0,
  speed: 1,
  use_speaker_boost: true,
  language_voices: {},
};

function clamp01(n: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

function clampSpeed(n: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1.2, Math.max(0.7, n));
}

export function parseElevenLabsStudioVoiceConfig(
  viewerConfig?: Record<string, unknown> | null,
): ElevenLabsStudioVoiceConfig {
  const raw = viewerConfig?.elevenlabs_voice;
  if (!raw || typeof raw !== "object") return { ...DEFAULT_ELEVENLABS_STUDIO_VOICE };

  const obj = raw as Record<string, unknown>;
  const languageRaw = typeof obj.language === "string" ? obj.language : DEFAULT_ELEVENLABS_WALKTHROUGH_LANGUAGE;
  const language = isGlobalVoiceLanguageCode(languageRaw) ? languageRaw : DEFAULT_ELEVENLABS_WALKTHROUGH_LANGUAGE;
  const enabledRaw = Array.isArray(obj.enabled_languages) ? (obj.enabled_languages as string[]) : undefined;
  const enabled_languages = normalizeEnabledElevenLabsLanguages(enabledRaw);
  const language_mode =
    obj.language_mode === "owner_default" ||
    obj.language_mode === "auto_detect" ||
    obj.language_mode === "buyer_choice"
      ? obj.language_mode
      : DEFAULT_ELEVENLABS_STUDIO_VOICE.language_mode;

  const language_voices: Partial<Record<ElevenLabsWalkthroughLanguageCode, string>> = {};
  const rawLangVoices = obj.language_voices;
  if (rawLangVoices && typeof rawLangVoices === "object") {
    for (const [key, value] of Object.entries(rawLangVoices as Record<string, unknown>)) {
      if (isGlobalVoiceLanguageCode(key) && typeof value === "string" && value.trim()) {
        language_voices[key] = value.trim();
      }
    }
  }

  return {
    voice_id:
      typeof obj.voice_id === "string" && obj.voice_id.trim()
        ? obj.voice_id.trim()
        : DEFAULT_ELEVENLABS_STUDIO_VOICE.voice_id,
    language,
    enabled_languages,
    language_mode,
    convai_model:
      typeof obj.convai_model === "string" && obj.convai_model.trim()
        ? obj.convai_model.trim()
        : DEFAULT_ELEVENLABS_STUDIO_VOICE.convai_model,
    tts_model:
      typeof obj.tts_model === "string" && obj.tts_model.trim()
        ? obj.tts_model.trim()
        : DEFAULT_ELEVENLABS_STUDIO_VOICE.tts_model,
    stability: clamp01(Number(obj.stability), DEFAULT_ELEVENLABS_STUDIO_VOICE.stability),
    similarity_boost: clamp01(
      Number(obj.similarity_boost),
      DEFAULT_ELEVENLABS_STUDIO_VOICE.similarity_boost,
    ),
    style: clamp01(Number(obj.style), DEFAULT_ELEVENLABS_STUDIO_VOICE.style),
    speed: clampSpeed(Number(obj.speed), DEFAULT_ELEVENLABS_STUDIO_VOICE.speed),
    use_speaker_boost: obj.use_speaker_boost !== false,
    language_voices,
  };
}

export function resolveStudioVoiceId(
  config: ElevenLabsStudioVoiceConfig,
  languageCode: string,
): string {
  if (isGlobalVoiceLanguageCode(languageCode)) {
    const mapped = config.language_voices[languageCode];
    if (mapped?.trim()) return mapped.trim();
  }
  return config.voice_id;
}

export function setStudioLanguageVoice(
  config: ElevenLabsStudioVoiceConfig,
  languageCode: ElevenLabsWalkthroughLanguageCode,
  voiceId: string,
): ElevenLabsStudioVoiceConfig {
  const language_voices = { ...config.language_voices, [languageCode]: voiceId };
  const next: ElevenLabsStudioVoiceConfig = { ...config, language_voices };
  if (config.language === languageCode) {
    next.voice_id = voiceId;
  }
  return next;
}

export function elevenLabsStudioVoiceToViewerConfig(
  config: ElevenLabsStudioVoiceConfig,
): Record<string, unknown> {
  return { elevenlabs_voice: config };
}

export function mergeElevenLabsStudioVoiceViewerConfig(
  viewerConfig: Record<string, unknown>,
  config: ElevenLabsStudioVoiceConfig,
): Record<string, unknown> {
  return { ...viewerConfig, elevenlabs_voice: config };
}

export function studioVoiceElevenLabsLanguage(config: ElevenLabsStudioVoiceConfig): string {
  return toElevenLabsAgentLanguage(config.language);
}

export function studioVoiceLanguageLabel(code: GlobalVoiceLanguageCode): string {
  const match = GLOBAL_VOICE_LANGUAGES.find((l) => l.code === code);
  return match ? `${match.nativeLabel} (${match.label})` : code;
}

export const STUDIO_INDIAN_LANGUAGE_OPTIONS = ELEVENLABS_INDIAN_WALKTHROUGH_LANGUAGES;
export const STUDIO_INTERNATIONAL_LANGUAGE_OPTIONS = ELEVENLABS_INTERNATIONAL_WALKTHROUGH_LANGUAGES;
