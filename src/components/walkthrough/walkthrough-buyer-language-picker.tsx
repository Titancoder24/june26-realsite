"use client";

import {
  buyerLanguagePickerOptions,
  shouldShowBuyerLanguagePicker,
  storeVoicePreferences,
  type WalkthroughVoicePreferences,
} from "@/lib/walkthrough-voice-providers";
import { elevenLabsWalkthroughLanguageLabel, ELEVENLABS_AUTO_LANGUAGE } from "@/lib/elevenlabs-languages";

export function WalkthroughBuyerLanguagePicker({
  experienceId,
  viewerConfig,
  prefs,
  onChange,
  disabled,
  compact = false,
}: {
  experienceId: string;
  viewerConfig?: Record<string, unknown> | null;
  prefs: WalkthroughVoicePreferences;
  onChange: (prefs: WalkthroughVoicePreferences) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  if (!shouldShowBuyerLanguagePicker(viewerConfig)) return null;

  const options = buyerLanguagePickerOptions(viewerConfig);
  const value = prefs.speechLanguageCode;

  return (
    <div className={`wt-voice-lang-picker ${compact ? "wt-voice-lang-picker--compact" : ""}`}>
      <label className="wt-voice-lang-label" htmlFor={`wt-voice-lang-select-${experienceId}`}>
        {compact ? "Language" : "Your language"}
      </label>
      <select
        id={`wt-voice-lang-select-${experienceId}`}
        className="wt-voice-lang-select"
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const code = e.target.value;
          const next = {
            ...prefs,
            speechLanguageCode: code,
            chatLanguageCode: code,
          };
          onChange(next);
          storeVoicePreferences(experienceId, next);
        }}
      >
        {options.map((opt) => (
          <option key={opt.code} value={opt.code}>
            {opt.code === ELEVENLABS_AUTO_LANGUAGE
              ? compact ? "Auto-detect" : "Auto-detect — I'll match your language"
              : compact
                ? opt.nativeLabel
                : `${opt.nativeLabel} (${opt.label})`}
          </option>
        ))}
      </select>
      {!compact && (
        <p className="wt-voice-lang-hint">
          {value === ELEVENLABS_AUTO_LANGUAGE
            ? "Speak in any enabled language — the guide adapts automatically."
            : `Speaking: ${elevenLabsWalkthroughLanguageLabel(value)}`}
        </p>
      )}
    </div>
  );
}
