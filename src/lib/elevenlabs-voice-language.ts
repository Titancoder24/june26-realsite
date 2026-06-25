import {
  ELEVENLABS_INDIAN_WALKTHROUGH_LANGUAGES,
  ELEVENLABS_WALKTHROUGH_LANGUAGES,
  getElevenLabsWalkthroughLanguage,
  isElevenLabsWalkthroughLanguageCode,
  toElevenLabsAgentLanguage,
  type ElevenLabsWalkthroughLanguageCode,
} from "@/lib/elevenlabs-languages";

export type ElevenLabsVoiceLanguageFields = {
  voiceId: string;
  name: string;
  previewUrl?: string;
  labels?: Record<string, string>;
  category?: string;
  description?: string;
  verifiedLanguages?: Array<{
    language: string;
    accent?: string;
    locale?: string;
    previewUrl?: string;
  }>;
  source?: "account" | "library";
};

export type ElevenLabsLibraryVoiceQuery = {
  language?: string;
  search?: string;
};

const INDIAN_LANGUAGE_CODES = new Set(
  ELEVENLABS_INDIAN_WALKTHROUGH_LANGUAGES.map((l) => l.code),
);

/** Other Indian language names — used to reject cross-language library noise. */
const OTHER_INDIAN_LANGUAGE_NAMES: Record<ElevenLabsWalkthroughLanguageCode, string[]> = {
  hi: ["tamil", "telugu", "kannada", "malayalam", "marathi", "punjabi", "gujarati", "urdu", "bengali", "bhojpuri"],
  ur: ["tamil", "telugu", "kannada", "malayalam", "marathi", "punjabi", "gujarati", "hindi", "bengali", "bhojpuri"],
  ta: ["hindi", "telugu", "kannada", "malayalam", "marathi", "punjabi", "gujarati", "urdu", "bengali", "bhojpuri"],
  te: ["tamil", "hindi", "kannada", "malayalam", "marathi", "punjabi", "gujarati", "urdu", "bengali", "bhojpuri"],
  kn: ["tamil", "telugu", "hindi", "malayalam", "marathi", "punjabi", "gujarati", "urdu", "bengali", "bhojpuri"],
  ml: ["tamil", "telugu", "kannada", "hindi", "marathi", "punjabi", "gujarati", "urdu", "bengali", "bhojpuri"],
  mr: ["tamil", "telugu", "kannada", "malayalam", "hindi", "punjabi", "gujarati", "urdu", "bengali", "bhojpuri"],
  pa: ["tamil", "telugu", "kannada", "malayalam", "marathi", "hindi", "gujarati", "urdu", "bengali", "bhojpuri"],
  gu: ["tamil", "telugu", "kannada", "malayalam", "marathi", "punjabi", "hindi", "urdu", "bengali", "bhojpuri"],
  bho: ["tamil", "telugu", "kannada", "malayalam", "marathi", "punjabi", "gujarati", "urdu", "bengali"],
  en: [],
  es: [],
  fr: [],
  de: [],
  pt: [],
  it: [],
  ja: [],
  ko: [],
  ar: [],
  zh: [],
};

/** Extra name/description signals per language (ElevenLabs library metadata is inconsistent). */
const LANGUAGE_INCLUDE_SIGNALS: Partial<Record<ElevenLabsWalkthroughLanguageCode, string[]>> = {
  ta: ["tamil", "tanglish", "thanglish"],
  te: ["telugu", "telangana"],
  kn: ["kannada", "kannadiga"],
  ml: ["malayalam", "kerala"],
  mr: ["marathi", "maharashtrian"],
  pa: ["punjabi", "punjab"],
  gu: ["gujarati", "gujarat"],
  ur: ["urdu"],
  hi: ["hindi", "hindustani", "hinglish"],
  bho: ["bhojpuri", "hindi"],
};

/**
 * ElevenLabs Voice Library API queries per walkthrough language.
 * Many Indian languages only work via `search` (not `language` ISO code).
 */
export function getLibraryQueriesForWalkthrough(
  walkthroughCode: string,
): ElevenLabsLibraryVoiceQuery[] {
  if (!isElevenLabsWalkthroughLanguageCode(walkthroughCode)) {
    return [{ language: toElevenLabsAgentLanguage(walkthroughCode) }];
  }

  const code = walkthroughCode;
  switch (code) {
    case "ta":
      return [{ language: "ta" }, { search: "Tamil" }];
    case "hi":
      return [{ language: "hi" }];
    case "bho":
      return [{ language: "hi" }, { search: "Bhojpuri" }];
    case "mr":
      return [{ search: "Marathi" }, { search: "Marathi", language: "hi" }];
    case "te":
      return [{ search: "Telugu" }];
    case "kn":
      return [{ search: "Kannada" }];
    case "ml":
      return [{ search: "Malayalam" }];
    case "pa":
      return [{ search: "Punjabi" }];
    case "gu":
      return [{ search: "Gujarati" }];
    case "ur":
      return [{ search: "Urdu" }];
    case "en":
      return [{ language: "en" }];
    case "es":
      return [{ language: "es" }];
    case "fr":
      return [{ language: "fr" }];
    case "de":
      return [{ language: "de" }];
    case "pt":
      return [{ language: "pt" }];
    case "it":
      return [{ language: "it" }];
    case "ja":
      return [{ language: "ja" }];
    case "ko":
      return [{ language: "ko" }];
    case "ar":
      return [{ language: "ar" }];
    case "zh":
      return [{ language: "zh" }];
    default:
      return [{ language: toElevenLabsAgentLanguage(code) }];
  }
}

export function isIndianWalkthroughLanguage(code?: string): boolean {
  return code ? INDIAN_LANGUAGE_CODES.has(code as ElevenLabsWalkthroughLanguageCode) : false;
}

export function normalizeLangToken(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, "-");
}

export function languageSearchTokens(
  elevenLabsLang: string,
  walkthroughCode?: string,
): string[] {
  const tokens = new Set<string>();
  const code = normalizeLangToken(elevenLabsLang);
  if (code) tokens.add(code);

  const walkthrough =
    walkthroughCode ? getElevenLabsWalkthroughLanguage(walkthroughCode) : undefined;

  if (walkthrough) {
    tokens.add(normalizeLangToken(walkthrough.code));
    tokens.add(normalizeLangToken(walkthrough.label));
    tokens.add(normalizeLangToken(walkthrough.elevenLabsCode));
  }

  const includes = walkthroughCode && isElevenLabsWalkthroughLanguageCode(walkthroughCode)
    ? LANGUAGE_INCLUDE_SIGNALS[walkthroughCode]
    : undefined;
  if (includes) for (const s of includes) tokens.add(normalizeLangToken(s));

  if (walkthroughCode === "bho" || code === "hi") {
    tokens.add("hi");
    tokens.add("hindi");
  }

  return [...tokens].filter((t) => t.length >= 2);
}

export function languagePreviewMatches(
  language: string,
  elevenLabsLang: string,
  walkthroughCode?: string,
): boolean {
  const tokens = languageSearchTokens(elevenLabsLang, walkthroughCode);
  return textMatchesLanguageTokens(language, tokens);
}

export function textMatchesLanguageTokens(text: string, tokens: string[]): boolean {
  const norm = normalizeLangToken(text);
  if (!norm || tokens.length === 0) return false;
  return tokens.some(
    (token) => norm === token || norm.startsWith(`${token}-`) || norm.includes(token),
  );
}

function voiceLanguageTexts(voice: ElevenLabsVoiceLanguageFields): string[] {
  const texts: string[] = [];
  if (voice.labels?.language) texts.push(voice.labels.language);
  if (voice.labels?.accent) texts.push(voice.labels.accent);
  if (voice.labels?.locale) texts.push(voice.labels.locale);
  if (voice.name) texts.push(voice.name);
  if (voice.description) texts.push(voice.description);
  for (const v of voice.verifiedLanguages ?? []) {
    if (v.language) texts.push(v.language);
    if (v.locale) texts.push(v.locale);
    if (v.accent) texts.push(v.accent);
  }
  return texts;
}

function textHasLanguageSignal(text: string, signal: string): boolean {
  const norm = normalizeLangToken(text);
  const sig = normalizeLangToken(signal);
  if (!norm || !sig) return false;
  if (norm === sig) return true;
  if (sig.length <= 2) {
    return norm === sig || norm.startsWith(`${sig}-`);
  }
  return norm.includes(sig);
}

function voiceTextsMatchSignals(voice: ElevenLabsVoiceLanguageFields, signals: string[]): boolean {
  const texts = voiceLanguageTexts(voice);
  return texts.some((t) => signals.some((s) => textHasLanguageSignal(t, s)));
}

function voicePrimaryText(voice: ElevenLabsVoiceLanguageFields): string {
  return [voice.name, voice.description].filter(Boolean).join(" ").toLowerCase();
}

function primaryMentionsTargetLanguage(
  walkthroughCode: ElevenLabsWalkthroughLanguageCode,
  primary: string,
): boolean {
  const lang = getElevenLabsWalkthroughLanguage(walkthroughCode);
  if (!lang) return false;

  const signals = [
    lang.label,
    lang.code,
    toElevenLabsAgentLanguage(walkthroughCode),
    ...(LANGUAGE_INCLUDE_SIGNALS[walkthroughCode] ?? []),
  ];

  return signals.some((signal) => {
    const sig = normalizeLangToken(signal);
    if (!sig) return false;
    if (sig.length <= 2) {
      return primary === sig || primary.includes(` ${sig} `) || primary.startsWith(`${sig} `) || primary.endsWith(` ${sig}`);
    }
    return primary.includes(sig);
  });
}

/** Reject voices whose name/description clearly targets another Indian language. */
function primaryMentionsOtherIndianLanguage(
  walkthroughCode: ElevenLabsWalkthroughLanguageCode,
  primary: string,
): boolean {
  if (!primary.trim()) return false;
  if (primaryMentionsTargetLanguage(walkthroughCode, primary)) return false;

  const exclude = OTHER_INDIAN_LANGUAGE_NAMES[walkthroughCode] ?? [];
  return exclude.some((other) => primary.includes(other));
}

function verifiedSupportsWalkthroughLanguage(
  voice: ElevenLabsVoiceLanguageFields,
  walkthroughCode: ElevenLabsWalkthroughLanguageCode,
): boolean {
  const agentLang = toElevenLabsAgentLanguage(walkthroughCode);
  return (voice.verifiedLanguages ?? []).some(
    (v) =>
      languagePreviewMatches(v.language, agentLang, walkthroughCode)
      || (v.locale && languagePreviewMatches(v.locale, agentLang, walkthroughCode)),
  );
}

/** Strict filter: voice must belong to this walkthrough language only. */
export function voiceBelongsToWalkthroughLanguage(
  voice: ElevenLabsVoiceLanguageFields,
  walkthroughCode: string,
): boolean {
  if (!isElevenLabsWalkthroughLanguageCode(walkthroughCode)) return false;

  const lang = getElevenLabsWalkthroughLanguage(walkthroughCode);
  if (!lang) return false;

  const primary = voicePrimaryText(voice);

  if (isIndianWalkthroughLanguage(walkthroughCode)) {
    if (primaryMentionsOtherIndianLanguage(walkthroughCode, primary)) return false;

    if (primaryMentionsTargetLanguage(walkthroughCode, primary)) return true;

    // Multilingual library voices often only expose ISO codes in verified_languages.
    return verifiedSupportsWalkthroughLanguage(voice, walkthroughCode);
  }

  const agentLang = toElevenLabsAgentLanguage(walkthroughCode);
  const includeSignals = [
    lang.label,
    lang.code,
    agentLang,
    ...(LANGUAGE_INCLUDE_SIGNALS[walkthroughCode] ?? []),
  ];

  const hasInclude =
    voiceTextsMatchSignals(voice, includeSignals)
    || verifiedSupportsWalkthroughLanguage(voice, walkthroughCode);

  if (!hasInclude) return false;

  const excludeSignals = OTHER_INDIAN_LANGUAGE_NAMES[walkthroughCode] ?? [];
  const blob = voiceLanguageTexts(voice).join(" ").toLowerCase();
  const labelLower = lang.label.toLowerCase();

  for (const other of excludeSignals) {
    if (blob.includes(other) && !blob.includes(labelLower)) {
      if (!includeSignals.some((sig) => blob.includes(sig.toLowerCase()))) {
        return false;
      }
    }
  }

  return true;
}

export function voiceHasVerifiedLanguage(
  voice: ElevenLabsVoiceLanguageFields,
  walkthroughCode: string,
): boolean {
  if (!voiceBelongsToWalkthroughLanguage(voice, walkthroughCode)) return false;
  const agentLang = toElevenLabsAgentLanguage(walkthroughCode);
  const verified = voice.verifiedLanguages ?? [];
  if (!verified.length) return voice.source === "library";

  return verified.some(
    (v) =>
      languagePreviewMatches(v.language, agentLang, walkthroughCode)
      || (v.locale && languagePreviewMatches(v.locale, agentLang, walkthroughCode)),
  );
}

export function findLanguagePreviewUrl(
  voice: ElevenLabsVoiceLanguageFields,
  elevenLabsLang: string,
  walkthroughCode?: string,
): string | undefined {
  const verified = voice.verifiedLanguages?.find(
    (v) =>
      languagePreviewMatches(v.language, elevenLabsLang, walkthroughCode)
      || (v.locale && languagePreviewMatches(v.locale, elevenLabsLang, walkthroughCode)),
  );
  return verified?.previewUrl;
}

export function getElevenLabsVoicePreviewUrl(
  voice: ElevenLabsVoiceLanguageFields,
  elevenLabsLang: string,
  walkthroughCode?: string,
): string | undefined {
  const langPreview = findLanguagePreviewUrl(voice, elevenLabsLang, walkthroughCode);
  if (langPreview) return langPreview;
  if (voice.previewUrl?.trim()) return voice.previewUrl.trim();
  const firstVerified = voice.verifiedLanguages?.find((v) => v.previewUrl?.trim());
  return firstVerified?.previewUrl?.trim();
}

export function sortVoicesForWalkthroughLanguage(
  voices: ElevenLabsVoiceLanguageFields[],
  walkthroughCode: string,
): ElevenLabsVoiceLanguageFields[] {
  const agentLang = toElevenLabsAgentLanguage(walkthroughCode);

  return [...voices].sort((a, b) => {
    const aName = a.name.toLowerCase().includes(getElevenLabsWalkthroughLanguage(walkthroughCode)?.label.toLowerCase() ?? "");
    const bName = b.name.toLowerCase().includes(getElevenLabsWalkthroughLanguage(walkthroughCode)?.label.toLowerCase() ?? "");
    if (aName !== bName) return aName ? -1 : 1;

    const aVerified = (a.verifiedLanguages ?? []).some((v) =>
      languagePreviewMatches(v.language, agentLang, walkthroughCode),
    );
    const bVerified = (b.verifiedLanguages ?? []).some((v) =>
      languagePreviewMatches(v.language, agentLang, walkthroughCode),
    );
    if (aVerified !== bVerified) return aVerified ? -1 : 1;

    return a.name.localeCompare(b.name);
  });
}

export function voiceGenderLabel(voice: ElevenLabsVoiceLanguageFields): string | undefined {
  const g = voice.labels?.gender?.trim().toLowerCase();
  if (!g) return undefined;
  if (g === "male" || g === "female") return g;
  return voice.labels?.gender;
}
