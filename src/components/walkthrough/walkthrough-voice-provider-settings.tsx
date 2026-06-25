"use client";

import { cn } from "@/lib/utils";
import {
  GLOBAL_VOICE_LANGUAGES,
  WALKTHROUGH_VOICE_PROFILES,
  type GlobalVoiceLanguage,
  type WalkthroughVoicePreferences,
  type WalkthroughVoiceProfile,
} from "@/lib/walkthrough-voice-providers";
import {
  SARVAM_WALKTHROUGH_LANGUAGES,
  type SarvamWalkthroughLanguage,
} from "@/lib/sarvam-languages";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type LanguageOption = {
  code: string;
  label: string;
  nativeLabel: string;
  tts?: boolean;
};

function formatLanguageLabel(code: string, options: LanguageOption[]): string {
  const match = options.find((o) => o.code === code);
  if (!match) return code;
  return `${match.nativeLabel} (${match.label})`;
}

function LanguageSelect({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: string;
  onChange: (code: string) => void;
  options: LanguageOption[];
  className?: string;
}) {
  const safeValue = options.some((o) => o.code === value) ? value : options[0]?.code ?? value;

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={safeValue} onValueChange={onChange} disabled={options.length === 0}>
        <SelectTrigger className={cn("min-h-[40px] w-full bg-background", className)}>
          <SelectValue placeholder="Select language">
            {formatLanguageLabel(safeValue, options)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-64">
          {options.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              <span className="flex items-center gap-2">
                <span>{lang.nativeLabel}</span>
                <span className="text-muted-foreground">({lang.label})</span>
                {lang.tts === false && (
                  <span className="text-[10px] text-muted-foreground">STT only</span>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function WalkthroughVoiceProviderSettings({
  prefs,
  onChange,
  indianLanguages,
}: {
  prefs: WalkthroughVoicePreferences;
  onChange: (prefs: WalkthroughVoicePreferences) => void;
  indianLanguages?: SarvamWalkthroughLanguage[];
}) {
  const profileMeta = WALKTHROUGH_VOICE_PROFILES.find((p) => p.id === prefs.voiceProfile);
  const indianOptions =
    indianLanguages?.length ? indianLanguages : SARVAM_WALKTHROUGH_LANGUAGES;
  const globalOptions: GlobalVoiceLanguage[] = GLOBAL_VOICE_LANGUAGES;

  function setProfile(profile: WalkthroughVoiceProfile) {
    if (profile === "global-voice") {
      onChange({
        ...prefs,
        voiceProfile: profile,
        speechLanguageCode: "en",
        chatLanguageCode: "en",
      });
    } else {
      const defaultCode = indianOptions[0]?.code ?? "en-IN";
      onChange({
        ...prefs,
        voiceProfile: profile,
        speechLanguageCode: defaultCode,
        chatLanguageCode: defaultCode,
      });
    }
  }

  return (
    <div className="space-y-3 border-b px-4 py-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {WALKTHROUGH_VOICE_PROFILES.map((profile) => {
          const active = prefs.voiceProfile === profile.id;
          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => setProfile(profile.id)}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors",
                active
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:bg-muted/50",
              )}
            >
              <p className="text-sm font-medium">{profile.title}</p>
              <p className="text-xs text-muted-foreground">{profile.subtitle}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">Powered by {profile.poweredBy}</p>
            </button>
          );
        })}
      </div>

      {profileMeta && (
        <p className="text-xs text-muted-foreground">{profileMeta.description}</p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {prefs.voiceProfile === "indian-languages" ? (
          <>
            <LanguageSelect
              label="Speak in (mic / voice input)"
              value={prefs.speechLanguageCode}
              onChange={(code) => onChange({ ...prefs, speechLanguageCode: code })}
              options={indianOptions}
            />
            <LanguageSelect
              label="Chat & hear replies in"
              value={prefs.chatLanguageCode}
              onChange={(code) => onChange({ ...prefs, chatLanguageCode: code })}
              options={indianOptions}
            />
          </>
        ) : (
          <>
            <LanguageSelect
              label="Speak in"
              value={prefs.speechLanguageCode}
              onChange={(code) =>
                onChange({ ...prefs, speechLanguageCode: code, chatLanguageCode: code })
              }
              options={globalOptions}
            />
            <LanguageSelect
              label="Chat & hear replies in"
              value={prefs.chatLanguageCode}
              onChange={(code) => onChange({ ...prefs, chatLanguageCode: code })}
              options={globalOptions}
            />
          </>
        )}
      </div>

      <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
        <div>
          <p className="text-sm font-medium">Live speech conversation</p>
          <p className="text-xs text-muted-foreground">
            After the AI speaks, mic turns on again for real-time back-and-forth
          </p>
        </div>
        <Switch
          checked={prefs.liveConversation}
          onCheckedChange={(liveConversation) => onChange({ ...prefs, liveConversation })}
        />
      </div>
    </div>
  );
}
