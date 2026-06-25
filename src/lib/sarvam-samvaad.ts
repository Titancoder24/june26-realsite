import type { SarvamLanguageCode } from "@/lib/sarvam-languages";
import { env } from "@/lib/env";

/** Samvaad (Sarvam conversational AI) app configuration. */
export type SamvaadAppConfig = {
  org_id: string;
  workspace_id: string;
  app_id: string;
  version?: number;
};

export type SamvaadViewerConfig = SamvaadAppConfig & {
  enabled?: boolean;
};

export type SamvaadInteractionConfig = {
  user_identifier_type: string;
  user_identifier: string;
  org_id: string;
  workspace_id: string;
  app_id: string;
  version?: number;
  interaction_type: "call";
  input_sample_rate: 16000;
  output_sample_rate: 16000;
  agent_variables: Record<string, string>;
  initial_language_name: string;
  initial_bot_message: string;
  speech_hotwords: string[];
};

export type SamvaadSessionBundle = {
  apiKey: string;
  baseUrl: string;
  config: SamvaadInteractionConfig;
};

export type SamvaadSessionParams = {
  organizationId: string;
  propertyId: string;
  experienceId: string;
  sessionId?: string;
  propertyName: string;
  projectName?: string;
  speechLanguageCode: string;
  activeSceneId?: string;
  scenes: { id: string; title: string }[];
  samvaad: SamvaadAppConfig;
};

export const SAMVAAD_PROXY_API_KEY = "__samvaad_proxy__";

export function samvaadRuntimeProxyBaseUrl(): string {
  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return `${appUrl}/api/walkthrough/samvaad/runtime/`;
}

export function parseSamvaadViewerConfig(
  viewerConfig?: Record<string, unknown> | null,
): SamvaadViewerConfig | null {
  const raw = viewerConfig?.samvaad;
  if (!raw || typeof raw !== "object") {
    const fromEnv = samvaadConfigFromEnv();
    return fromEnv ? { ...fromEnv, enabled: true } : null;
  }
  const obj = raw as Record<string, unknown>;
  const org_id = asString(obj.org_id) ?? env.server.SARVAM_SAMVAAD_ORG_ID;
  const workspace_id = asString(obj.workspace_id) ?? env.server.SARVAM_SAMVAAD_WORKSPACE_ID;
  const app_id = asString(obj.app_id) ?? env.server.SARVAM_SAMVAAD_APP_ID;
  if (!org_id || !workspace_id || !app_id) return null;
  const version = typeof obj.version === "number" ? obj.version : undefined;
  const enabled = obj.enabled !== false;
  return { org_id, workspace_id, app_id, version, enabled };
}

export function samvaadConfigFromEnv(): SamvaadAppConfig | null {
  const org_id = env.server.SARVAM_SAMVAAD_ORG_ID;
  const workspace_id = env.server.SARVAM_SAMVAAD_WORKSPACE_ID;
  const app_id = env.server.SARVAM_SAMVAAD_APP_ID;
  if (!org_id || !workspace_id || !app_id) return null;
  return { org_id, workspace_id, app_id };
}

export function isSamvaadConfigured(viewerConfig?: Record<string, unknown> | null): boolean {
  const cfg = parseSamvaadViewerConfig(viewerConfig);
  return Boolean(cfg?.enabled && cfg.org_id && cfg.workspace_id && cfg.app_id);
}

/** Map Sarvam language codes to Samvaad tool language names. */
export function sarvamCodeToSamvaadLanguage(code: string): string {
  const map: Record<string, string> = {
    "hi-IN": "Hindi",
    "bn-IN": "Bengali",
    "gu-IN": "Gujarati",
    "kn-IN": "Kannada",
    "ml-IN": "Malayalam",
    "ta-IN": "Tamil",
    "te-IN": "Telugu",
    "pa-IN": "Punjabi",
    "or-IN": "Odia",
    "mr-IN": "Marathi",
    "en-IN": "English",
  };
  return map[code as SarvamLanguageCode] ?? "English";
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}
