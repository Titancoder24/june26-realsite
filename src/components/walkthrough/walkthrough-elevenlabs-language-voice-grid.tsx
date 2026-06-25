"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { ElevenLabsVoiceListItem } from "@/services/elevenlabs-voices.service";
import { previewPhraseForLanguage, toElevenLabsAgentLanguage } from "@/lib/elevenlabs-languages";
import type { ElevenLabsWalkthroughLanguageCode } from "@/lib/elevenlabs-languages";
import type { ElevenLabsStudioVoiceConfig } from "@/lib/elevenlabs-studio-voice";
import {
  getElevenLabsVoicePreviewUrl,
  languagePreviewMatches,
  voiceGenderLabel,
} from "@/lib/elevenlabs-voice-language";
import { Loader2, Pause, Play, Volume2 } from "lucide-react";
import { toast } from "sonner";

export function WalkthroughElevenLabsLanguageVoiceGrid({
  languageCode,
  languageLabel,
  nativeLabel,
  voices,
  selectedVoiceId,
  config,
  organizationId,
  onSelect,
  disabled,
  highlight,
}: {
  languageCode: ElevenLabsWalkthroughLanguageCode;
  languageLabel: string;
  nativeLabel: string;
  voices: ElevenLabsVoiceListItem[];
  selectedVoiceId?: string;
  config: ElevenLabsStudioVoiceConfig;
  organizationId?: string;
  onSelect: (voiceId: string) => void;
  disabled?: boolean;
  highlight?: boolean;
}) {
  const elevenLabsLang = toElevenLabsAgentLanguage(languageCode);
  const previewPhrase = previewPhraseForLanguage(languageCode);

  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [playingLibraryId, setPlayingLibraryId] = useState<string | null>(null);
  const [genderFilter, setGenderFilter] = useState<"all" | "male" | "female">("all");
  const libraryAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

  const stopAll = useCallback(() => {
    libraryAudioRef.current?.pause();
    ttsAudioRef.current?.pause();
    setPlayingLibraryId(null);
    setPreviewingId(null);
  }, []);

  useEffect(() => {
    stopAll();
    setGenderFilter("all");
  }, [languageCode, stopAll]);

  const filteredVoices = voices.filter((voice) => {
    if (genderFilter === "all") return true;
    const gender = voiceGenderLabel(voice);
    return gender === genderFilter;
  });

  async function playTtsPreview(voice: ElevenLabsVoiceListItem) {
    stopAll();
    setPreviewingId(voice.voiceId);
    try {
      const res = await fetch("/api/walkthrough/elevenlabs/voice-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: previewPhrase,
          organizationId,
          languageCode,
          voiceId: voice.voiceId,
          voice: { ...config, voice_id: voice.voiceId },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Preview failed");
      }
      const blob = await res.blob();
      if (!blob.size) throw new Error("Empty audio response");
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      ttsAudioRef.current = audio;
      audio.onended = () => {
        setPreviewingId(null);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setPreviewingId(null);
        URL.revokeObjectURL(url);
        toast.error("Could not play preview");
      };
      await audio.play();
    } catch (e) {
      setPreviewingId(null);
      toast.error(e instanceof Error ? e.message : "Preview failed");
    }
  }

  async function playApiPreview(voice: ElevenLabsVoiceListItem) {
    const previewUrl = getElevenLabsVoicePreviewUrl(voice, elevenLabsLang, languageCode);
    if (!previewUrl) {
      await playTtsPreview(voice);
      return;
    }

    stopAll();
    setPlayingLibraryId(voice.voiceId);
    const audio = new Audio(previewUrl);
    libraryAudioRef.current = audio;
    audio.onended = () => setPlayingLibraryId(null);
    audio.onerror = async () => {
      setPlayingLibraryId(null);
      await playTtsPreview(voice);
    };
    try {
      await audio.play();
    } catch {
      setPlayingLibraryId(null);
      await playTtsPreview(voice);
    }
  }

  if (!voices.length) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">
          No ElevenLabs voices found for {nativeLabel} ({languageLabel})
        </p>
        <p className="mt-1">
          Voices load from the ElevenLabs Voice Library filtered for {languageLabel}
          (e.g. Tamil library voices, or Marathi-tagged voices). Check API key scopes (Voices Read).
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        highlight ? "border-primary/40 bg-primary/5" : "border-border bg-muted/10",
      )}
    >
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          {highlight && (
            <p className="text-[10px] text-muted-foreground">Fixed language — buyers hear this voice</p>
          )}
          <p className="text-[10px] text-muted-foreground">
            <span className="font-medium">{nativeLabel}</span> ({languageLabel}) voices from ElevenLabs library.
            <span className="font-medium"> Play</span> = library preview.
            <span className="font-medium"> Speaker</span> = {languageLabel} TTS phrase.
          </p>
          <p className="text-[10px] text-muted-foreground">
            TTS: <span className="text-foreground">{previewPhrase}</span>
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex rounded-md border bg-background p-0.5 text-[10px]">
            {(["all", "male", "female"] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={cn(
                  "rounded px-2 py-0.5 capitalize",
                  genderFilter === option ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
                onClick={() => setGenderFilter(option)}
                disabled={disabled}
              >
                {option === "all" ? "All" : option === "male" ? "Male" : "Female"}
              </button>
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {filteredVoices.length} of {voices.length} voices
          </span>
        </div>
      </div>

      {filteredVoices.length === 0 && voices.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          No {genderFilter === "male" ? "male" : "female"} voices for {languageLabel}. Try All.
        </p>
      ) : null}

      <div className="grid max-h-[min(520px,60vh)] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
        {filteredVoices.map((voice) => {
          const selected = selectedVoiceId === voice.voiceId;
          const playingLib = playingLibraryId === voice.voiceId;
          const previewing = previewingId === voice.voiceId;
          const hasApiPreview = Boolean(
            getElevenLabsVoicePreviewUrl(voice, elevenLabsLang, languageCode),
          );
          const gender = voiceGenderLabel(voice);
          const accent =
            voice.verifiedLanguages?.find((v) =>
              languagePreviewMatches(v.language, elevenLabsLang, languageCode),
            )?.accent ?? voice.labels?.accent;

          return (
            <div
              key={voice.voiceId}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-2 transition-colors",
                selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-background",
              )}
            >
              <button
                type="button"
                className={cn(
                  "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
                  "bg-gradient-to-br from-orange-200 via-rose-300 to-violet-400",
                  "ring-1 ring-black/5 transition-transform hover:scale-105",
                  (playingLib || previewing) && "animate-pulse",
                )}
                disabled={disabled || playingLib}
                onClick={() => playApiPreview(voice)}
                aria-label={`ElevenLabs preview for ${voice.name}`}
                title={hasApiPreview ? "ElevenLabs API preview" : "Generate TTS preview"}
              >
                {playingLib ? (
                  <Pause className="h-4 w-4 text-white drop-shadow" />
                ) : (
                  <Play className="h-4 w-4 text-white drop-shadow" />
                )}
              </button>

              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  className="truncate text-left text-sm font-medium hover:underline"
                  disabled={disabled}
                  onClick={() => onSelect(voice.voiceId)}
                >
                  {voice.name}
                </button>
                <p className="truncate text-[10px] text-muted-foreground">
                  {gender ? `${gender === "male" ? "Male" : "Female"}` : "Voice"}
                  {accent ? ` · ${accent}` : ""}
                  {voice.source === "library" ? " · library" : ""}
                  {hasApiPreview ? " · API preview" : ""}
                </p>
              </div>

              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  className="rounded-md border px-2 py-1 text-[10px] hover:bg-muted"
                  disabled={disabled || previewing}
                  onClick={() => playTtsPreview(voice)}
                  title={`${languageLabel} TTS preview`}
                >
                  {previewing ? (
                    <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Volume2 className="mx-auto h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  className={cn(
                    "rounded-md px-2 py-1 text-[10px]",
                    selected ? "bg-primary text-primary-foreground" : "border hover:bg-muted",
                  )}
                  disabled={disabled}
                  onClick={() => onSelect(voice.voiceId)}
                >
                  {selected ? "Selected" : "Use"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
