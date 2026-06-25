/** Sarvam BCP-47 language codes — aligned with sarvam-mcp / Saaras v3 + Bulbul v3. */
export type SarvamLanguageCode =
  | "en-IN"
  | "hi-IN"
  | "bn-IN"
  | "ta-IN"
  | "te-IN"
  | "gu-IN"
  | "kn-IN"
  | "ml-IN"
  | "mr-IN"
  | "pa-IN"
  | "od-IN"
  | "as-IN"
  | "ur-IN"
  | "ne-IN"
  | "kok-IN"
  | "ks-IN"
  | "sd-IN"
  | "sa-IN"
  | "sat-IN"
  | "mni-IN"
  | "brx-IN"
  | "mai-IN"
  | "doi-IN";

export type SarvamWalkthroughLanguage = {
  code: SarvamLanguageCode;
  label: string;
  nativeLabel: string;
  tts: boolean;
};

export const SARVAM_WALKTHROUGH_LANGUAGES: SarvamWalkthroughLanguage[] = [
  { code: "en-IN", label: "English", nativeLabel: "English", tts: true },
  { code: "hi-IN", label: "Hindi", nativeLabel: "हिन्दी", tts: true },
  { code: "bn-IN", label: "Bengali", nativeLabel: "বাংলা", tts: true },
  { code: "ta-IN", label: "Tamil", nativeLabel: "தமிழ்", tts: true },
  { code: "te-IN", label: "Telugu", nativeLabel: "తెలుగు", tts: true },
  { code: "gu-IN", label: "Gujarati", nativeLabel: "ગુજરાતી", tts: true },
  { code: "kn-IN", label: "Kannada", nativeLabel: "ಕನ್ನಡ", tts: true },
  { code: "ml-IN", label: "Malayalam", nativeLabel: "മലയാളം", tts: true },
  { code: "mr-IN", label: "Marathi", nativeLabel: "मराठी", tts: true },
  { code: "pa-IN", label: "Punjabi", nativeLabel: "ਪੰਜਾਬੀ", tts: true },
  { code: "od-IN", label: "Odia", nativeLabel: "ଓଡ଼ିଆ", tts: true },
  { code: "as-IN", label: "Assamese", nativeLabel: "অসমীয়া", tts: false },
  { code: "ur-IN", label: "Urdu", nativeLabel: "اردو", tts: false },
  { code: "ne-IN", label: "Nepali", nativeLabel: "नेपाली", tts: false },
  { code: "kok-IN", label: "Konkani", nativeLabel: "कोंकणी", tts: false },
  { code: "ks-IN", label: "Kashmiri", nativeLabel: "कॉशुर", tts: false },
  { code: "sd-IN", label: "Sindhi", nativeLabel: "سنڌي", tts: false },
  { code: "sa-IN", label: "Sanskrit", nativeLabel: "संस्कृतम्", tts: false },
  { code: "sat-IN", label: "Santali", nativeLabel: "ᱥᱟᱱᱛᱟᱲᱤ", tts: false },
  { code: "mni-IN", label: "Manipuri", nativeLabel: "মৈতৈলোন্", tts: false },
  { code: "brx-IN", label: "Bodo", nativeLabel: "बड़ो", tts: false },
  { code: "mai-IN", label: "Maithili", nativeLabel: "मैथिली", tts: false },
  { code: "doi-IN", label: "Dogri", nativeLabel: "डोगरी", tts: false },
];

export const DEFAULT_WALKTHROUGH_LANGUAGE: SarvamLanguageCode = "en-IN";

export function isSarvamLanguageCode(value: string): value is SarvamLanguageCode {
  return SARVAM_WALKTHROUGH_LANGUAGES.some((l) => l.code === value);
}

export function getWalkthroughLanguage(code: string): SarvamWalkthroughLanguage | undefined {
  return SARVAM_WALKTHROUGH_LANGUAGES.find((l) => l.code === code);
}

export function languageSupportsSarvamTts(code: SarvamLanguageCode): boolean {
  return getWalkthroughLanguage(code)?.tts ?? false;
}
