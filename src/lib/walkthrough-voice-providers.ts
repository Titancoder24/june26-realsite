import {
  buyerElevenLabsLanguageOptions,
  DEFAULT_ELEVENLABS_WALKTHROUGH_LANGUAGE,
  ELEVENLABS_AUTO_LANGUAGE,
  ELEVENLABS_WALKTHROUGH_LANGUAGES,
  isElevenLabsWalkthroughLanguageCode,
  resolveBuyerSpeechLanguage,
  type ElevenLabsWalkthroughLanguageCode,
} from "@/lib/elevenlabs-languages";
import { isElevenLabsConvaiConfigured } from "@/lib/elevenlabs-convai";
import {
  DEFAULT_WALKTHROUGH_LANGUAGE,
  SARVAM_WALKTHROUGH_LANGUAGES,
  type SarvamLanguageCode,
} from "@/lib/sarvam-languages";
export type WalkthroughVoiceProfile = "indian-languages" | "global-voice";

export type WalkthroughVoiceProfileMeta = {
  id: WalkthroughVoiceProfile;
  title: string;
  subtitle: string;
  description: string;
  poweredBy: string;
};

export const WALKTHROUGH_VOICE_PROFILES: WalkthroughVoiceProfileMeta[] = [
  {
    id: "indian-languages",
    title: "Indian Languages AI",
    subtitle: "Speak & hear in Indian languages",
    description:
      "Full speech-to-speech for Hindi, Tamil, Telugu, Bengali, and 20+ Indian languages via Sarvam.",
    poweredBy: "Sarvam AI",
  },
  {
    id: "global-voice",
    title: "Global Voice AI",
    subtitle: "English, Indian & international voices",
    description:
      "ElevenLabs duplex voice with Hindi, Tamil, Telugu, Urdu, Marathi, and more — buyers can pick their language or auto-detect.",
    poweredBy: "ElevenLabs",
  },
];

export const DEFAULT_VOICE_PROFILE: WalkthroughVoiceProfile = "indian-languages";

export type GlobalVoiceLanguageCode = ElevenLabsWalkthroughLanguageCode;

export type GlobalVoiceLanguage = {
  code: GlobalVoiceLanguageCode;
  label: string;
  nativeLabel: string;
  region?: "indian" | "international";
};

export const GLOBAL_VOICE_LANGUAGES: GlobalVoiceLanguage[] = ELEVENLABS_WALKTHROUGH_LANGUAGES.map((l) => ({
  code: l.code,
  label: l.label,
  nativeLabel: l.nativeLabel,
  region: l.region,
}));

export const DEFAULT_GLOBAL_LANGUAGE: GlobalVoiceLanguageCode = DEFAULT_ELEVENLABS_WALKTHROUGH_LANGUAGE;

export function isWalkthroughVoiceProfile(value: string): value is WalkthroughVoiceProfile {
  return value === "indian-languages" || value === "global-voice";
}

export function isGlobalVoiceLanguageCode(value: string): value is GlobalVoiceLanguageCode {
  return isElevenLabsWalkthroughLanguageCode(value);
}

export function getVoiceProfileMeta(id: WalkthroughVoiceProfile): WalkthroughVoiceProfileMeta {
  return WALKTHROUGH_VOICE_PROFILES.find((p) => p.id === id) ?? WALKTHROUGH_VOICE_PROFILES[0];
}

export type WalkthroughVoicePreferences = {
  voiceProfile: WalkthroughVoiceProfile;
  speechLanguageCode: string;
  chatLanguageCode: string;
  liveConversation: boolean;
};

export function defaultVoicePreferences(profile: WalkthroughVoiceProfile): WalkthroughVoicePreferences {
  if (profile === "global-voice") {
    return {
      voiceProfile: "global-voice",
      speechLanguageCode: ELEVENLABS_AUTO_LANGUAGE,
      chatLanguageCode: ELEVENLABS_AUTO_LANGUAGE,
      liveConversation: false,
    };
  }
  return {
    voiceProfile: "indian-languages",
    speechLanguageCode: DEFAULT_WALKTHROUGH_LANGUAGE,
    chatLanguageCode: DEFAULT_WALKTHROUGH_LANGUAGE,
    liveConversation: false,
  };
}

export function voicePreferencesStorageKey(experienceId: string) {
  return `walkthrough-voice-prefs-${experienceId}`;
}

export function readVoicePreferences(experienceId: string): WalkthroughVoicePreferences {
  if (typeof window === "undefined") return defaultVoicePreferences(DEFAULT_VOICE_PROFILE);
  try {
    const raw = localStorage.getItem(voicePreferencesStorageKey(experienceId));
    if (!raw) return defaultVoicePreferences(DEFAULT_VOICE_PROFILE);
    const parsed = JSON.parse(raw) as Partial<WalkthroughVoicePreferences>;
    const profile = parsed.voiceProfile && isWalkthroughVoiceProfile(parsed.voiceProfile)
      ? parsed.voiceProfile
      : DEFAULT_VOICE_PROFILE;
    const defaults = defaultVoicePreferences(profile);
    return {
      voiceProfile: profile,
      speechLanguageCode: parsed.speechLanguageCode ?? defaults.speechLanguageCode,
      chatLanguageCode: parsed.chatLanguageCode ?? defaults.chatLanguageCode,
      liveConversation: parsed.liveConversation ?? false,
    };
  } catch {
    return defaultVoicePreferences(DEFAULT_VOICE_PROFILE);
  }
}

export function storeVoicePreferences(experienceId: string, prefs: WalkthroughVoicePreferences) {
  if (typeof window === "undefined") return;
  localStorage.setItem(voicePreferencesStorageKey(experienceId), JSON.stringify(prefs));
}

/** Ensure stored language codes match the active voice profile. */
export function normalizeVoicePreferences(
  prefs: WalkthroughVoicePreferences,
): WalkthroughVoicePreferences {
  if (prefs.voiceProfile === "global-voice") {
    const speech = isGlobalVoiceLanguageCode(prefs.speechLanguageCode)
      ? prefs.speechLanguageCode
      : prefs.speechLanguageCode === ELEVENLABS_AUTO_LANGUAGE
        ? ELEVENLABS_AUTO_LANGUAGE
        : DEFAULT_GLOBAL_LANGUAGE;
    const chat =
      prefs.chatLanguageCode === ELEVENLABS_AUTO_LANGUAGE || isGlobalVoiceLanguageCode(prefs.chatLanguageCode)
        ? prefs.chatLanguageCode
        : speech;
    return { ...prefs, speechLanguageCode: speech, chatLanguageCode: chat };
  }

  const indianCodes = SARVAM_WALKTHROUGH_LANGUAGES.map((l) => l.code);
  const speech = indianCodes.includes(prefs.speechLanguageCode as SarvamLanguageCode)
    ? prefs.speechLanguageCode
    : DEFAULT_WALKTHROUGH_LANGUAGE;
  const chat = indianCodes.includes(prefs.chatLanguageCode as SarvamLanguageCode)
    ? prefs.chatLanguageCode
    : speech;
  return {
    ...prefs,
    voiceProfile: "indian-languages",
    speechLanguageCode: speech,
    chatLanguageCode: chat,
  };
}

/** Cinematic walkthrough buyer profile — ElevenLabs Global Voice when ConvAI is available. */
export function parseViewerVoiceProfile(
  viewerConfig?: Record<string, unknown> | null,
): WalkthroughVoiceProfile {
  const raw = viewerConfig?.voice_profile;
  if (typeof raw === "string" && isWalkthroughVoiceProfile(raw)) return raw;
  if (isElevenLabsConvaiConfigured(viewerConfig)) return "global-voice";
  return DEFAULT_VOICE_PROFILE;
}

export function viewerVoicePreferences(profile: WalkthroughVoiceProfile): WalkthroughVoicePreferences {
  return normalizeVoicePreferences(defaultVoicePreferences(profile));
}

/** Buyer ElevenLabs preferences — studio default + localStorage overrides. */
export function buyerElevenLabsVoicePreferences(
  experienceId: string,
  viewerConfig?: Record<string, unknown> | null,
): WalkthroughVoicePreferences {
  const stored = normalizeVoicePreferences(readVoicePreferences(experienceId));
  const speech = resolveBuyerSpeechLanguage(stored.speechLanguageCode, viewerConfig);
  const chat = resolveBuyerSpeechLanguage(stored.chatLanguageCode, viewerConfig);
  return {
    voiceProfile: "global-voice",
    speechLanguageCode: speech,
    chatLanguageCode: chat,
    liveConversation: stored.liveConversation,
  };
}

export function buyerVoicePreferences(
  voiceProfile: WalkthroughVoiceProfile,
  experienceId: string,
  viewerConfig?: Record<string, unknown> | null,
): WalkthroughVoicePreferences {
  if (voiceProfile === "global-voice") {
    return buyerElevenLabsVoicePreferences(experienceId, viewerConfig);
  }
  return viewerVoicePreferences(voiceProfile);
}

export function shouldShowBuyerLanguagePicker(
  viewerConfig?: Record<string, unknown> | null,
): boolean {
  return false;
}

export function buyerLanguagePickerOptions(
  viewerConfig?: Record<string, unknown> | null,
) {
  return buyerElevenLabsLanguageOptions(viewerConfig);
}

export function walkthroughVoiceApiConfig() {
  return {
    profiles: WALKTHROUGH_VOICE_PROFILES,
    defaultProfile: DEFAULT_VOICE_PROFILE,
    indianLanguages: SARVAM_WALKTHROUGH_LANGUAGES,
    defaultIndianLanguage: DEFAULT_WALKTHROUGH_LANGUAGE,
    globalLanguages: GLOBAL_VOICE_LANGUAGES,
    defaultGlobalLanguage: DEFAULT_GLOBAL_LANGUAGE,
  };
}

/** Normalize chat language to Sarvam code when using Indian profile. */
export function resolveIndianChatLanguage(code: string): SarvamLanguageCode {
  const match = SARVAM_WALKTHROUGH_LANGUAGES.find((l) => l.code === code);
  return match?.code ?? DEFAULT_WALKTHROUGH_LANGUAGE;
}

export function resolveIndianSpeechLanguage(code: string): SarvamLanguageCode {
  return resolveIndianChatLanguage(code);
}
