"use client";

import { WalkthroughVoicePanel } from "@/components/walkthrough/walkthrough-voice-panel";
import type { WalkthroughAICommand } from "@/lib/walkthrough-player-controller";

export function WalkthroughBuyerChat({
  organizationId,
  propertyId,
  experienceId,
  sessionId,
  activeSceneId,
  onCommand,
  onClose,
}: {
  organizationId: string;
  propertyId: string;
  experienceId: string;
  sessionId?: string;
  activeSceneId?: string;
  onCommand: (cmd: WalkthroughAICommand) => void;
  onClose: () => void;
}) {
  return (
    <WalkthroughVoicePanel
      variant="viewer"
      organizationId={organizationId}
      propertyId={propertyId}
      experienceId={experienceId}
      sessionId={sessionId}
      activeSceneId={activeSceneId}
      onCommand={(cmd) => {
        if (typeof cmd !== "string" && cmd?.command) onCommand(cmd);
      }}
      onClose={onClose}
    />
  );
}
