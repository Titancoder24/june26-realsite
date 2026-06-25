"use client";

import { cn } from "@/lib/utils";
import {
  WALKTHROUGH_VOICE_PROFILES,
  type WalkthroughVoiceProfile,
} from "@/lib/walkthrough-voice-providers";
import { WalkthroughElevenLabsStudioSettings } from "@/components/walkthrough/walkthrough-elevenlabs-studio-settings";

export function WalkthroughOwnerVoiceSettings({
  value,
  onChange,
  disabled,
  experienceId,
  organizationId,
  viewerConfig,
  onViewerConfigChange,
}: {
  value: WalkthroughVoiceProfile;
  onChange: (profile: WalkthroughVoiceProfile) => void;
  disabled?: boolean;
  experienceId?: string;
  organizationId?: string;
  viewerConfig?: Record<string, unknown>;
  onViewerConfigChange?: (config: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-2 overflow-visible">
      <p className="text-sm font-medium">Buyer voice AI language mode</p>
      <p className="text-xs text-muted-foreground">
        Buyers hear and speak with this voice stack automatically — they do not pick languages in the walkthrough.
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {WALKTHROUGH_VOICE_PROFILES.map((profile) => {
          const active = value === profile.id;
          return (
            <button
              key={profile.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(profile.id)}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors",
                active
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:bg-muted/50",
                disabled && "opacity-60 pointer-events-none",
              )}
            >
              <p className="text-sm font-medium">{profile.title}</p>
              <p className="text-xs text-muted-foreground">{profile.subtitle}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">Powered by {profile.poweredBy}</p>
            </button>
          );
        })}
      </div>

      {value === "global-voice" && experienceId && viewerConfig && onViewerConfigChange && (
        <WalkthroughElevenLabsStudioSettings
          experienceId={experienceId}
          organizationId={organizationId}
          viewerConfig={viewerConfig}
          onViewerConfigChange={onViewerConfigChange}
          disabled={disabled}
        />
      )}
    </div>
  );
}
