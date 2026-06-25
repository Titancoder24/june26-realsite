"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { WalkthroughElevenLabsLanguageVoiceGrid } from "@/components/walkthrough/walkthrough-elevenlabs-language-voice-grid";
import {
  DEFAULT_ELEVENLABS_STUDIO_VOICE,
  ELEVENLABS_CONVAI_MODEL_OPTIONS,
  mergeElevenLabsStudioVoiceViewerConfig,
  parseElevenLabsStudioVoiceConfig,
  resolveStudioVoiceId,
  setStudioLanguageVoice,
  studioVoiceLanguageLabel,
  STUDIO_INDIAN_LANGUAGE_OPTIONS,
  STUDIO_INTERNATIONAL_LANGUAGE_OPTIONS,
  type ElevenLabsStudioVoiceConfig,
} from "@/lib/elevenlabs-studio-voice";
import {
  GLOBAL_VOICE_LANGUAGES,
  isGlobalVoiceLanguageCode,
} from "@/lib/walkthrough-voice-providers";
import type { ElevenLabsLanguageMode, ElevenLabsWalkthroughLanguageCode } from "@/lib/elevenlabs-languages";
import {
  ELEVENLABS_WALKTHROUGH_LANGUAGES,
  previewPhraseForLanguage,
} from "@/lib/elevenlabs-languages";
import type { ElevenLabsVoiceListItem } from "@/services/elevenlabs-voices.service";
import { readJsonResponse } from "@/lib/http-json";
import { Loader2, Play, Volume2 } from "lucide-react";
import { toast } from "sonner";

type TtsModelOption = {
  modelId: string;
  name: string;
  description?: string;
  canUseStyle?: boolean;
  canUseSpeakerBoost?: boolean;
};

export function WalkthroughElevenLabsStudioSettings({
  experienceId,
  organizationId,
  viewerConfig,
  onViewerConfigChange,
  disabled,
}: {
  experienceId: string;
  organizationId?: string;
  viewerConfig: Record<string, unknown>;
  onViewerConfigChange: (config: Record<string, unknown>) => void;
  disabled?: boolean;
}) {
  const [config, setConfig] = useState<ElevenLabsStudioVoiceConfig>(() =>
    parseElevenLabsStudioVoiceConfig(viewerConfig),
  );
  const [voicesByLanguage, setVoicesByLanguage] = useState<
    Partial<Record<ElevenLabsWalkthroughLanguageCode, ElevenLabsVoiceListItem[]>>
  >({});
  const [loadingVoicesByLanguage, setLoadingVoicesByLanguage] = useState<
    Partial<Record<ElevenLabsWalkthroughLanguageCode, boolean>>
  >({});
  const [ttsModels, setTtsModels] = useState<TtsModelOption[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewText, setPreviewText] = useState(() =>
    previewPhraseForLanguage(parseElevenLabsStudioVoiceConfig(viewerConfig).language),
  );
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setConfig(parseElevenLabsStudioVoiceConfig(viewerConfig));
  }, [viewerConfig]);

  useEffect(() => {
    let cancelled = false;
    setLoadingCatalog(true);
    fetch("/api/walkthrough/elevenlabs/models")
      .then(async (r) => readJsonResponse<{ ttsModels?: TtsModelOption[] }>(r))
      .then((modelsRes) => {
        if (cancelled) return;
        if (Array.isArray(modelsRes.ttsModels)) {
          setTtsModels(modelsRes.ttsModels);
        }
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not load ElevenLabs models.");
      })
      .finally(() => {
        if (!cancelled) setLoadingCatalog(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const enabledLanguageOptions = useMemo(
    () =>
      ELEVENLABS_WALKTHROUGH_LANGUAGES.filter((lang) =>
        config.enabled_languages.includes(lang.code),
      ),
    [config.enabled_languages],
  );

  useEffect(() => {
    let cancelled = false;

    for (const lang of enabledLanguageOptions) {
      setLoadingVoicesByLanguage((prev) => ({ ...prev, [lang.code]: true }));
      fetch(
        `/api/walkthrough/elevenlabs/voices?walkthroughCode=${encodeURIComponent(lang.code)}`,
      )
        .then(async (r) => readJsonResponse<{ voices?: ElevenLabsVoiceListItem[]; error?: string }>(r))
        .then((voicesRes) => {
          if (cancelled) return;
          if (Array.isArray(voicesRes.voices)) {
            setVoicesByLanguage((prev) => ({
              ...prev,
              [lang.code]: voicesRes.voices as ElevenLabsVoiceListItem[],
            }));
          } else if (voicesRes.error) {
            toast.error(`${lang.label}: ${voicesRes.error}`);
          }
        })
        .catch(() => {
          if (!cancelled) {
            toast.error(`Could not load voices for ${lang.label}.`);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoadingVoicesByLanguage((prev) => ({ ...prev, [lang.code]: false }));
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [enabledLanguageOptions]);

  const selectedTtsModel = useMemo(
    () => ttsModels.find((m) => m.modelId === config.tts_model),
    [ttsModels, config.tts_model],
  );

  const selectedLanguageMeta = useMemo(
    () => ELEVENLABS_WALKTHROUGH_LANGUAGES.find((l) => l.code === config.language),
    [config.language],
  );

  function selectLanguageVoice(languageCode: ElevenLabsWalkthroughLanguageCode, voiceId: string) {
    setConfig((prev) => setStudioLanguageVoice(prev, languageCode, voiceId));
  }

  useEffect(() => {
    setPreviewText(previewPhraseForLanguage(config.language));
  }, [config.language]);

  const updateConfig = useCallback((patch: Partial<ElevenLabsStudioVoiceConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  async function saveConfig(next: ElevenLabsStudioVoiceConfig) {
    setSaving(true);
    try {
      const mergedViewerConfig = mergeElevenLabsStudioVoiceViewerConfig(viewerConfig, next);
      const res = await fetch(`/api/experiences/${experienceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewer_config: mergedViewerConfig }),
      });
      const data = await readJsonResponse<{ error?: string }>(res).catch(
        (): { error?: string } => ({ error: undefined }),
      );
      if (!res.ok) throw new Error(data.error ?? "Failed to save voice settings");

      onViewerConfigChange(mergedViewerConfig);

      await fetch("/api/walkthrough/elevenlabs/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice: next }),
      }).catch(() => {
        // Agent sync is best-effort if provision route fails
      });

      toast.success("ElevenLabs voice settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save voice settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    await saveConfig(config);
  }

  async function playCustomPreview() {
    if (!previewText.trim()) return;
    setPreviewing(true);
    try {
      const res = await fetch("/api/walkthrough/elevenlabs/voice-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: previewText.trim(),
          organizationId,
          languageCode: config.language,
          voiceId: resolveStudioVoiceId(config, config.language),
          voice: config,
        }),
      });
      if (!res.ok) {
        const data = await readJsonResponse<{ error?: string }>(res).catch(
          (): { error?: string } => ({ error: undefined }),
        );
        throw new Error(data.error ?? "Preview failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current.src = url;
        await previewAudioRef.current.play();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setPreviewing(false);
    }
  }

  return (
    <div className="space-y-4 border-t pt-4">
      <div>
        <p className="text-sm font-medium">ElevenLabs voice & language</p>
        <p className="text-xs text-muted-foreground">
          Choose voice, default language, buyer language options, model, and tone. Indian languages use ElevenLabs ConvAI codes (Hindi, Tamil, Telugu, Urdu, etc.).
        </p>
      </div>

      {loadingCatalog ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading ElevenLabs settings…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="relative isolate space-y-1.5">
              <Label className="text-xs text-muted-foreground">Default tour language</Label>
              <Select
                value={config.language}
                onValueChange={(code) => {
                  if (!isGlobalVoiceLanguageCode(code)) return;
                  const mapped = config.language_voices[code];
                  updateConfig({
                    language: code,
                    ...(mapped ? { voice_id: mapped } : {}),
                  });
                }}
                disabled={disabled || saving}
              >
                <SelectTrigger className="min-h-[40px] w-full bg-background">
                  <SelectValue>{studioVoiceLanguageLabel(config.language)}</SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {GLOBAL_VOICE_LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.nativeLabel} ({lang.label})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="relative isolate space-y-1.5">
              <Label className="text-xs text-muted-foreground">ConvAI voice model (live duplex)</Label>
              <Select
                value={config.convai_model}
                onValueChange={(modelId) => updateConfig({ convai_model: modelId })}
                disabled={disabled || saving}
              >
                <SelectTrigger className="min-h-[40px] w-full bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ELEVENLABS_CONVAI_MODEL_OPTIONS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="relative isolate space-y-1.5">
              <Label className="text-xs text-muted-foreground">Buyer language experience</Label>
              <Select
                value={config.language_mode}
                onValueChange={(mode) =>
                  updateConfig({ language_mode: mode as ElevenLabsLanguageMode })
                }
                disabled={disabled || saving}
              >
                <SelectTrigger className="min-h-[40px] w-full bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buyer_choice">Buyer picks language (+ auto-detect option)</SelectItem>
                  <SelectItem value="auto_detect">Auto-detect only</SelectItem>
                  <SelectItem value="owner_default">Fixed — use default language only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
            <p className="text-xs font-medium text-muted-foreground">Languages buyers can use</p>
            <p className="text-[10px] text-muted-foreground">
              Enable Hindi, Urdu, Tamil, Telugu, Kannada, Malayalam, Marathi, Punjabi, Gujarati, Bhojpuri, and English.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground">Indian languages</p>
                {STUDIO_INDIAN_LANGUAGE_OPTIONS.map((lang) => {
                  const checked = config.enabled_languages.includes(lang.code);
                  return (
                    <label key={lang.code} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        className="rounded border-input"
                        checked={checked}
                        disabled={disabled || saving}
                        onChange={() => {
                          const next = checked
                            ? config.enabled_languages.filter((c) => c !== lang.code)
                            : [...config.enabled_languages, lang.code];
                          if (next.length === 0) return;
                          updateConfig({ enabled_languages: next });
                        }}
                      />
                      <span>{lang.nativeLabel} ({lang.label})</span>
                    </label>
                  );
                })}
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground">International</p>
                {STUDIO_INTERNATIONAL_LANGUAGE_OPTIONS.map((lang) => {
                  const checked = config.enabled_languages.includes(lang.code);
                  return (
                    <label key={lang.code} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        className="rounded border-input"
                        checked={checked}
                        disabled={disabled || saving}
                        onChange={() => {
                          const next = checked
                            ? config.enabled_languages.filter((c) => c !== lang.code)
                            : [...config.enabled_languages, lang.code as ElevenLabsWalkthroughLanguageCode];
                          if (next.length === 0) return;
                          updateConfig({ enabled_languages: next });
                        }}
                      />
                      <span>{lang.nativeLabel} ({lang.label})</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {enabledLanguageOptions.length > 0 && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Voices per language</Label>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Pick a male or female ElevenLabs voice for each enabled language. Tamil shows Tamil-only voices; Marathi uses Marathi-tagged library voices.
                </p>
              </div>
              {enabledLanguageOptions.map((lang) => {
                const loadingLang = loadingVoicesByLanguage[lang.code];
                const voices = voicesByLanguage[lang.code] ?? [];
                return (
                  <div key={lang.code} className="space-y-2">
                    {loadingLang ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading voices for {lang.label}…
                      </div>
                    ) : (
                      <WalkthroughElevenLabsLanguageVoiceGrid
                        languageCode={lang.code}
                        languageLabel={lang.label}
                        nativeLabel={lang.nativeLabel}
                        voices={voices}
                        selectedVoiceId={
                          config.language_voices[lang.code]
                          ?? (config.language === lang.code ? config.voice_id : undefined)
                        }
                        config={config}
                        organizationId={organizationId}
                        onSelect={(voiceId) => selectLanguageVoice(lang.code, voiceId)}
                        disabled={disabled || saving}
                        highlight={
                          config.language === lang.code || config.language_mode === "owner_default"
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="relative isolate space-y-1.5">
            <Label className="text-xs text-muted-foreground">Preview TTS model (studio test & fallback)</Label>
            <Select
              value={config.tts_model}
              onValueChange={(modelId) => updateConfig({ tts_model: modelId })}
              disabled={disabled || saving}
            >
              <SelectTrigger className="min-h-[40px] w-full bg-background">
                <SelectValue placeholder="Select TTS model">
                  {selectedTtsModel?.name ?? config.tts_model}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {ttsModels.map((m) => (
                  <SelectItem key={m.modelId} value={m.modelId}>
                    <span>{m.name}</span>
                    {m.description && (
                      <span className="text-muted-foreground"> — {m.description}</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground">Tone & delivery</p>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span>Stability</span>
                <span className="text-muted-foreground">{config.stability.toFixed(2)}</span>
              </div>
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={[config.stability]}
                onValueChange={([v]) => updateConfig({ stability: v })}
                disabled={disabled || saving}
              />
              <p className="text-[10px] text-muted-foreground">Lower = more expressive; higher = steadier.</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span>Similarity</span>
                <span className="text-muted-foreground">{config.similarity_boost.toFixed(2)}</span>
              </div>
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={[config.similarity_boost]}
                onValueChange={([v]) => updateConfig({ similarity_boost: v })}
                disabled={disabled || saving}
              />
            </div>

            {selectedTtsModel?.canUseStyle && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span>Style exaggeration</span>
                  <span className="text-muted-foreground">{config.style.toFixed(2)}</span>
                </div>
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={[config.style]}
                  onValueChange={([v]) => updateConfig({ style: v })}
                  disabled={disabled || saving}
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span>Speed</span>
                <span className="text-muted-foreground">{config.speed.toFixed(2)}×</span>
              </div>
              <Slider
                min={0.7}
                max={1.2}
                step={0.01}
                value={[config.speed]}
                onValueChange={([v]) => updateConfig({ speed: v })}
                disabled={disabled || saving}
              />
            </div>

            {selectedTtsModel?.canUseSpeakerBoost && (
              <div className="flex items-center justify-between">
                <Label className="text-xs">Speaker boost</Label>
                <Switch
                  checked={config.use_speaker_boost}
                  onCheckedChange={(use_speaker_boost) => updateConfig({ use_speaker_boost })}
                  disabled={disabled || saving}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Preview script ({selectedLanguageMeta?.label ?? config.language})
            </Label>
            <Input
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
              disabled={disabled || saving}
              className="min-h-[40px]"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || previewing || saving}
                onClick={() => playCustomPreview()}
              >
                {previewing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Play with current tone settings
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled || saving}
                onClick={() => setConfig({ ...DEFAULT_ELEVENLABS_STUDIO_VOICE })}
              >
                Reset defaults
              </Button>
            </div>
            <audio ref={previewAudioRef} className="hidden" />
          </div>

          <Button type="button" onClick={handleSave} disabled={disabled || saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving voice settings…
              </>
            ) : (
              <>
                <Volume2 className="mr-2 h-4 w-4" />
                Save ElevenLabs voice for this walkthrough
              </>
            )}
          </Button>
        </>
      )}
    </div>
  );
}
