"use client";

import { Switch } from "@/components/ui/switch";
import {
  brainProviderMeta,
  readBrainProvider,
  storeBrainProvider,
  type WalkthroughBrainProvider,
} from "@/lib/walkthrough-brain-provider";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export function WalkthroughBrainProviderToggle({
  experienceId,
  disabled = false,
  className,
  onChange,
}: {
  experienceId: string;
  disabled?: boolean;
  className?: string;
  onChange?: (provider: WalkthroughBrainProvider) => void;
}) {
  const [provider, setProvider] = useState<WalkthroughBrainProvider>(() =>
    readBrainProvider(experienceId),
  );

  useEffect(() => {
    setProvider(readBrainProvider(experienceId));
  }, [experienceId]);

  const useGeminiNative = provider === "google-ai-studio";
  const meta = brainProviderMeta(provider);

  return (
    <div
      className={cn(
        "wt-brain-provider-toggle flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/45 px-2.5 py-2 backdrop-blur-md",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[0.68rem] font-medium text-white/90">Property brain</p>
        <p className="truncate text-[0.6rem] text-white/55">
          {useGeminiNative ? "Gemini 3.5 Flash · AI Studio" : "Vertex Cloud · GCP"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="text-[0.58rem] text-white/45">Cloud</span>
        <Switch
          checked={useGeminiNative}
          disabled={disabled}
          aria-label="Toggle between Vertex Cloud and Gemini Native brain"
          onCheckedChange={(checked) => {
            const next: WalkthroughBrainProvider = checked ? "google-ai-studio" : "vertex";
            setProvider(next);
            storeBrainProvider(experienceId, next);
            onChange?.(next);
          }}
        />
        <span className="text-[0.58rem] text-white/45">Native</span>
      </div>
      <span className="sr-only">{meta.description}</span>
    </div>
  );
}
