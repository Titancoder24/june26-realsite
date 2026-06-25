import { env } from "@/lib/env";
import { toElevenLabsAgentLanguage } from "@/lib/elevenlabs-languages";

/** ElevenLabs ConvAI (ElevenAgents) app configuration. */
export type ElevenLabsConvaiConfig = {
  agent_id: string;
  branch_id?: string;
  environment?: string;
};

export type ElevenLabsConvaiViewerConfig = ElevenLabsConvaiConfig & {
  enabled?: boolean;
};

export type ElevenLabsConvaiSessionBundle = {
  conversationToken: string;
  connectionType: "webrtc";
  agentId: string;
  dynamicVariables: Record<string, string>;
  overrides: {
    agent?: {
      firstMessage?: string;
      language?: string;
    };
    asr?: {
      keywords?: string[];
    };
    tts?: {
      voiceId?: string;
      speed?: number;
      stability?: number;
      similarityBoost?: number;
    };
  };
  ragToolUrl: string;
};

export function parseElevenLabsConvaiViewerConfig(
  viewerConfig?: Record<string, unknown> | null,
): ElevenLabsConvaiViewerConfig | null {
  if (!env.server.ELEVENLABS_API_KEY?.trim()) return null;

  const raw = viewerConfig?.elevenlabs_convai ?? viewerConfig?.elevenlabs;
  if (!raw || typeof raw !== "object") {
    const fromEnv = elevenLabsConvaiConfigFromEnv();
    return {
      agent_id: fromEnv?.agent_id ?? "",
      enabled: isConvaiVoiceModeEnabled(),
    };
  }
  const obj = raw as Record<string, unknown>;
  const agent_id = asString(obj.agent_id) ?? env.server.ELEVENLABS_AGENT_ID ?? "";
  const branch_id = asString(obj.branch_id);
  const environment = asString(obj.environment);
  const enabled = obj.enabled !== false;
  return {
    agent_id,
    branch_id,
    environment,
    enabled,
  };
}

export function elevenLabsConvaiConfigFromEnv(): ElevenLabsConvaiConfig | null {
  const agent_id = env.server.ELEVENLABS_AGENT_ID;
  if (!agent_id) return null;
  return { agent_id };
}

/** ConvAI WebRTC is opt-in; REST TTS + Gemini brain is the default buyer voice path. */
export function isConvaiVoiceModeEnabled(): boolean {
  if (typeof process !== "undefined") {
    const mode = process.env.NEXT_PUBLIC_VOICE_MODE?.trim().toLowerCase();
    if (mode === "convai") return true;
    if (mode === "rest") return false;
  }
  return false;
}

export function isElevenLabsConvaiConfigured(
  viewerConfig?: Record<string, unknown> | null,
): boolean {
  const raw = viewerConfig?.elevenlabs_convai ?? viewerConfig?.elevenlabs;
  if (!raw || typeof raw !== "object") {
    return isConvaiVoiceModeEnabled();
  }
  const obj = raw as Record<string, unknown>;
  if (obj.enabled === true) return true;
  if (obj.enabled === false) return false;
  return isConvaiVoiceModeEnabled();
}

/** Map global voice language codes to ElevenLabs agent language override. */
export function globalCodeToElevenLabsLanguage(code: string): string {
  return toElevenLabsAgentLanguage(code);
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}
