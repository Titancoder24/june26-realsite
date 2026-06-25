"use client";

import { Switch } from "@/components/ui/switch";
import {
  brainProviderMeta,
  type WalkthroughBrainProvider,
} from "@/lib/walkthrough-brain-provider";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export function WalkthroughBrainSettings({
  value,
  onChange,
  disabled = false,
  className,
  title = "Property AI brain",
  description = "Choose the LLM that answers buyer questions during the walkthrough.",
}: {
  value: WalkthroughBrainProvider;
  onChange: (provider: WalkthroughBrainProvider) => void;
  disabled?: boolean;
  className?: string;
  title?: string;
  description?: string;
}) {
  const [availability, setAvailability] = useState({ vertex: true, googleAiStudio: true });

  useEffect(() => {
    fetch("/api/walkthrough/brain-config")
      .then((r) => r.json())
      .then((data: { availability?: { vertex?: boolean; googleAiStudio?: boolean } }) => {
        setAvailability({
          vertex: data.availability?.vertex ?? true,
          googleAiStudio: data.availability?.googleAiStudio ?? true,
        });
      })
      .catch(() => undefined);
  }, []);

  const useGeminiNative = value === "google-ai-studio";
  const meta = brainProviderMeta(value);
  const nativeDisabled = disabled || !availability.googleAiStudio;
  const cloudDisabled = disabled || !availability.vertex;

  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium">{meta.label}</p>
          <p className="text-xs text-muted-foreground">
            {useGeminiNative
              ? "Gemini 3.5 Flash · Google AI Studio"
              : "Gemini 2.5 Flash · Vertex Cloud"}
          </p>
          {!availability.googleAiStudio && useGeminiNative && (
            <p className="mt-1 text-xs text-amber-700">GEMINI_API_KEY is not configured on the server.</p>
          )}
          {!availability.vertex && !useGeminiNative && (
            <p className="mt-1 text-xs text-amber-700">Vertex credentials are not configured on the server.</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-muted-foreground">Cloud</span>
          <Switch
            checked={useGeminiNative}
            disabled={useGeminiNative ? nativeDisabled : cloudDisabled}
            aria-label="Toggle between Vertex Cloud and Gemini Native property brain"
            onCheckedChange={(checked) => {
              onChange(checked ? "google-ai-studio" : "vertex");
            }}
          />
          <span className="text-xs text-muted-foreground">Native</span>
        </div>
      </div>
    </div>
  );
}
