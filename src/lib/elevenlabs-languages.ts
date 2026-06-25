import type { ConversationConfigOverrideAgentLanguage } from "@elevenlabs/types";

/** Realsite language id — maps to ElevenLabs ConvAI `agent.language` override. */
export type ElevenLabsWalkthroughLanguageCode =
  | "en"
  | "es"
  | "fr"
  | "de"
  | "pt"
  | "it"
  | "ja"
  | "ko"
  | "ar"
  | "zh"
  | "hi"
  | "ur"
  | "ta"
  | "te"
  | "kn"
  | "ml"
  | "mr"
  | "pa"
  | "gu"
  | "bho";

export const ELEVENLABS_AUTO_LANGUAGE = "auto";

export type ElevenLabsWalkthroughLanguage = {
  code: ElevenLabsWalkthroughLanguageCode;
  label: string;
  nativeLabel: string;
  region?: "indian" | "international";
  /** ElevenLabs agent language code (Bhojpuri uses Hindi). */
  elevenLabsCode: ConversationConfigOverrideAgentLanguage;
};

export const ELEVENLABS_INDIAN_WALKTHROUGH_LANGUAGES: ElevenLabsWalkthroughLanguage[] = [
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी", region: "indian", elevenLabsCode: "hi" },
  { code: "ur", label: "Urdu", nativeLabel: "اردو", region: "indian", elevenLabsCode: "ur" },
  { code: "ta", label: "Tamil", nativeLabel: "தமிழ்", region: "indian", elevenLabsCode: "ta" },
  { code: "te", label: "Telugu", nativeLabel: "తెలుగు", region: "indian", elevenLabsCode: "te" },
  { code: "kn", label: "Kannada", nativeLabel: "ಕನ್ನಡ", region: "indian", elevenLabsCode: "kn" },
  { code: "ml", label: "Malayalam", nativeLabel: "മലയാളം", region: "indian", elevenLabsCode: "ml" },
  { code: "mr", label: "Marathi", nativeLabel: "मराठी", region: "indian", elevenLabsCode: "mr" },
  { code: "pa", label: "Punjabi", nativeLabel: "ਪੰਜਾਬੀ", region: "indian", elevenLabsCode: "pa" },
  { code: "gu", label: "Gujarati", nativeLabel: "ગુજરાતી", region: "indian", elevenLabsCode: "gu" },
  {
    code: "bho",
    label: "Bhojpuri",
    nativeLabel: "भोजपुरी",
    region: "indian",
    elevenLabsCode: "hi",
  },
];

export const ELEVENLABS_INTERNATIONAL_WALKTHROUGH_LANGUAGES: ElevenLabsWalkthroughLanguage[] = [
  { code: "en", label: "English", nativeLabel: "English", region: "international", elevenLabsCode: "en" },
  { code: "es", label: "Spanish", nativeLabel: "Español", region: "international", elevenLabsCode: "es" },
  { code: "fr", label: "French", nativeLabel: "Français", region: "international", elevenLabsCode: "fr" },
  { code: "de", label: "German", nativeLabel: "Deutsch", region: "international", elevenLabsCode: "de" },
  { code: "pt", label: "Portuguese", nativeLabel: "Português", region: "international", elevenLabsCode: "pt" },
  { code: "it", label: "Italian", nativeLabel: "Italiano", region: "international", elevenLabsCode: "it" },
  { code: "ja", label: "Japanese", nativeLabel: "日本語", region: "international", elevenLabsCode: "ja" },
  { code: "ko", label: "Korean", nativeLabel: "한국어", region: "international", elevenLabsCode: "ko" },
  { code: "ar", label: "Arabic", nativeLabel: "العربية", region: "international", elevenLabsCode: "ar" },
  { code: "zh", label: "Chinese", nativeLabel: "中文", region: "international", elevenLabsCode: "zh" },
];

export const ELEVENLABS_WALKTHROUGH_LANGUAGES: ElevenLabsWalkthroughLanguage[] = [
  ...ELEVENLABS_INDIAN_WALKTHROUGH_LANGUAGES,
  ...ELEVENLABS_INTERNATIONAL_WALKTHROUGH_LANGUAGES,
];

export const DEFAULT_ELEVENLABS_WALKTHROUGH_LANGUAGE: ElevenLabsWalkthroughLanguageCode = "en";

export const DEFAULT_ELEVENLABS_ENABLED_LANGUAGES: ElevenLabsWalkthroughLanguageCode[] = [
  "en",
  "hi",
  "ur",
  "ta",
  "te",
  "kn",
  "ml",
  "mr",
  "pa",
  "gu",
  "bho",
];

export type ElevenLabsLanguageMode = "buyer_choice" | "owner_default" | "auto_detect";

const LANGUAGE_MAP = new Map(
  ELEVENLABS_WALKTHROUGH_LANGUAGES.map((l) => [l.code, l]),
);

export function isElevenLabsWalkthroughLanguageCode(
  value: string,
): value is ElevenLabsWalkthroughLanguageCode {
  return LANGUAGE_MAP.has(value as ElevenLabsWalkthroughLanguageCode);
}

export function getElevenLabsWalkthroughLanguage(code: string): ElevenLabsWalkthroughLanguage | undefined {
  return LANGUAGE_MAP.get(code as ElevenLabsWalkthroughLanguageCode);
}

export function elevenLabsWalkthroughLanguageLabel(code: string): string {
  const match = getElevenLabsWalkthroughLanguage(code);
  if (!match) return code === ELEVENLABS_AUTO_LANGUAGE ? "Auto-detect language" : code;
  return `${match.nativeLabel} (${match.label})`;
}

/** Map Realsite language id → ElevenLabs ConvAI agent language override. */
export function toElevenLabsAgentLanguage(code: string): ConversationConfigOverrideAgentLanguage {
  if (code === ELEVENLABS_AUTO_LANGUAGE) return "en";
  const match = getElevenLabsWalkthroughLanguage(code);
  if (match) return match.elevenLabsCode;
  return "en";
}

export function normalizeEnabledElevenLabsLanguages(
  codes: string[] | undefined,
): ElevenLabsWalkthroughLanguageCode[] {
  if (!codes?.length) return [...DEFAULT_ELEVENLABS_ENABLED_LANGUAGES];
  const unique = codes.filter(isElevenLabsWalkthroughLanguageCode);
  return unique.length ? unique : [...DEFAULT_ELEVENLABS_ENABLED_LANGUAGES];
}

export function parseEnabledElevenLabsLanguages(
  viewerConfig?: Record<string, unknown> | null,
): ElevenLabsWalkthroughLanguageCode[] {
  const raw = viewerConfig?.elevenlabs_voice;
  if (!raw || typeof raw !== "object") return [...DEFAULT_ELEVENLABS_ENABLED_LANGUAGES];
  const enabled = (raw as { enabled_languages?: unknown }).enabled_languages;
  if (!Array.isArray(enabled)) return [...DEFAULT_ELEVENLABS_ENABLED_LANGUAGES];
  return normalizeEnabledElevenLabsLanguages(enabled as string[]);
}

export function parseElevenLabsLanguageMode(
  viewerConfig?: Record<string, unknown> | null,
): ElevenLabsLanguageMode {
  const raw = viewerConfig?.elevenlabs_voice;
  if (!raw || typeof raw !== "object") return "auto_detect";
  const mode = (raw as { language_mode?: string }).language_mode;
  if (mode === "owner_default" || mode === "auto_detect" || mode === "buyer_choice") return mode;
  return "auto_detect";
}

export function buyerElevenLabsLanguageOptions(
  viewerConfig?: Record<string, unknown> | null,
): Array<{ code: string; label: string; nativeLabel: string }> {
  const mode = parseElevenLabsLanguageMode(viewerConfig);
  const enabled = parseEnabledElevenLabsLanguages(viewerConfig);
  const options = enabled.map((code) => {
    const lang = getElevenLabsWalkthroughLanguage(code)!;
    return { code, label: lang.label, nativeLabel: lang.nativeLabel };
  });

  if (mode === "auto_detect" || mode === "buyer_choice") {
    return [
      { code: ELEVENLABS_AUTO_LANGUAGE, label: "Auto-detect", nativeLabel: "Auto-detect" },
      ...options,
    ];
  }
  return options;
}

export function resolveBuyerSpeechLanguage(
  speechLanguageCode: string,
  viewerConfig?: Record<string, unknown> | null,
): string {
  const studioLang = parseStudioDefaultLanguage(viewerConfig);
  const enabled = parseEnabledElevenLabsLanguages(viewerConfig);
  const mode = parseElevenLabsLanguageMode(viewerConfig);

  if (mode === "owner_default") return studioLang;
  if (speechLanguageCode === ELEVENLABS_AUTO_LANGUAGE) return ELEVENLABS_AUTO_LANGUAGE;
  if (isElevenLabsWalkthroughLanguageCode(speechLanguageCode) && enabled.includes(speechLanguageCode)) {
    return speechLanguageCode;
  }
  if (mode === "auto_detect") return ELEVENLABS_AUTO_LANGUAGE;
  return enabled.includes(studioLang) ? studioLang : enabled[0] ?? DEFAULT_ELEVENLABS_WALKTHROUGH_LANGUAGE;
}

export function parseStudioDefaultLanguage(viewerConfig?: Record<string, unknown> | null): ElevenLabsWalkthroughLanguageCode {
  const raw = viewerConfig?.elevenlabs_voice;
  if (!raw || typeof raw !== "object") return DEFAULT_ELEVENLABS_WALKTHROUGH_LANGUAGE;
  const language = (raw as { language?: string }).language;
  if (language && isElevenLabsWalkthroughLanguageCode(language)) return language;
  return DEFAULT_ELEVENLABS_WALKTHROUGH_LANGUAGE;
}

/** Studio / buyer preview phrases per language (used for voice preview TTS). */
export const ELEVENLABS_LANGUAGE_PREVIEW_PHRASES: Record<ElevenLabsWalkthroughLanguageCode, string> = {
  en: "Welcome to your property tour. Ask me about amenities or say go to the kitchen.",
  es: "Bienvenido a su recorrido de la propiedad.",
  fr: "Bienvenue dans la visite de cette propriété.",
  de: "Willkommen zu Ihrer Immobilientour.",
  pt: "Bem-vindo ao tour da propriedade.",
  it: "Benvenuto al tour della proprietà.",
  ja: "物件ツアーへようこそ。",
  ko: "부동산 투어에 오신 것을 환영합니다.",
  ar: "مرحبًا بكم في جولة العقار.",
  zh: "欢迎参观这个楼盘。",
  hi: "नमस्ते, मैं आपका प्रॉपर्टी टूर गाइड हूँ। किचन या किसी भी कमरे के बारे में पूछें।",
  ur: "السلام علیکم، میں آپ کا پراپرٹی ٹور گائیڈ ہوں۔",
  ta: "வணக்கம், நான் உங்கள் சொத்து சுற்றுப்பயண வழிகாட்டி.",
  te: "నమస్కారం, నేను మీ ప్రాపర్టీ టూర్ గైడ్.",
  kn: "ನಮಸ್ಕಾರ, ನಾನು ನಿಮ್ಮ ಪ್ರಾಪರ್ಟಿ ಟೂರ್ ಗೈಡ್.",
  ml: "നമസ്കാരം, ഞാൻ നിങ്ങളുടെ പ്രോപ്പർട്ടി ടൂർ ഗൈഡ്.",
  mr: "नमस्कार, मी तुमचा प्रॉपर्टी टूर मार्गदर्शक आहे.",
  pa: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ, ਮੈਂ ਤੁਹਾਡਾ ਪ੍ਰਾਪਰਟੀ ਟੂਰ ਗਾਈਡ ਹਾਂ.",
  gu: "નમસ્તે, હું તમારો પ્રોપર્ટી ટૂર ગાઇડ છું.",
  bho: "नमस्कार, हम आपन प्रॉपर्टी टूर गाइड बानी।",
};

export function previewPhraseForLanguage(code: string): string {
  if (isElevenLabsWalkthroughLanguageCode(code)) {
    return ELEVENLABS_LANGUAGE_PREVIEW_PHRASES[code];
  }
  return ELEVENLABS_LANGUAGE_PREVIEW_PHRASES.en;
}
