"use client";

import { WalkthroughVoicePanel } from "@/components/walkthrough/walkthrough-voice-panel";
import type { WalkthroughBrainProvider } from "@/lib/walkthrough-brain-provider";
import type { WalkthroughVoiceProfile } from "@/lib/walkthrough-voice-providers";

export function WalkthroughVoiceTest({
  organizationId,
  propertyId,
  experienceId,
  activeSceneId,
  lockedVoiceProfile,
  brainProvider,
  onAnswer,
  onCommand,
}: {
  organizationId: string;
  propertyId: string;
  experienceId: string;
  activeSceneId?: string;
  lockedVoiceProfile?: WalkthroughVoiceProfile;
  brainProvider?: WalkthroughBrainProvider;
  onAnswer?: (answer: string) => void;
  onCommand?: (command: string) => void;
}) {
  return (
    <WalkthroughVoicePanel
      variant="studio"
      organizationId={organizationId}
      propertyId={propertyId}
      experienceId={experienceId}
      activeSceneId={activeSceneId}
      lockedVoiceProfile={lockedVoiceProfile}
      brainProvider={brainProvider}
      hideSettings={Boolean(lockedVoiceProfile)}
      onAnswer={onAnswer}
      onCommand={(cmd) => {
        if (typeof cmd === "string") onCommand?.(cmd);
        else if (cmd.command) onCommand?.(cmd.command);
      }}
    />
  );
}
