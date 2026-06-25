import type { WalkthroughAICommand } from "@/lib/walkthrough-player-controller";
import type { WalkthroughVoiceProfile } from "@/lib/walkthrough-voice-providers";

/** Pluggable inference surface — swap Vertex / ElevenLabs / Sarvam / on-prem later. */
export type WalkthroughInferenceRequest = {
  organizationId: string;
  propertyId: string;
  experienceId: string;
  query: string;
  activeSceneId?: string;
  sessionId?: string;
  voiceProfile: WalkthroughVoiceProfile;
  speechLanguageCode: string;
  chatLanguageCode: string;
};

export type WalkthroughInferenceResult = {
  answer: string;
  displayAnswer: string;
  transcript?: string;
  confidenceScore: number;
  command: WalkthroughAICommand;
  speechLanguageCode: string;
  chatLanguageCode: string;
  voiceProfile: WalkthroughVoiceProfile;
  voiceProvider: "sarvam" | "elevenlabs";
  audioBuffer: ArrayBuffer;
  fastPath?: boolean;
};

export interface WalkthroughInferenceAdapter {
  readonly id: string;
  processTextQuery(params: WalkthroughInferenceRequest): Promise<WalkthroughInferenceResult>;
  processAudioQuery(
    params: WalkthroughInferenceRequest & { audio: Blob },
  ): Promise<WalkthroughInferenceResult>;
  generateGreeting(
    params: WalkthroughInferenceRequest & { propertyName?: string; projectName?: string },
  ): Promise<WalkthroughInferenceResult>;
}
