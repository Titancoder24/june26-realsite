import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export type WalkthroughAIProvider = "vertex";

export interface VertexAIConfig {
  api_key?: string;
  project_id?: string;
  location?: string;
  planner_model?: string;
  image_model?: string;
  video_model?: string;
  embedding_model?: string;
}

export interface SuperAdminConfig {
  username: string;
  email: string;
  password_hash?: string;
  configured: boolean;
}

const cache = new Map<string, { value: unknown; expires: number }>();
const TTL_MS = 30_000;

/** Env-backed defaults — walkthrough AI is Vertex-only. */
export const VERTEX_DEFAULTS = {
  planner_model: "gemini-2.5-flash",
  image_model: "gemini-3.1-flash-image",
  video_model: "veo-3.1-fast-generate-001",
  embedding_model: "gemini-embedding-001",
  location: "us-central1",
} as const;

function trimEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** Vertex express tokens (AQ.*) beat generic GCP keys (AIza*) when both are configured. */
function pickVertexApiKey(dbKey?: string, envKey?: string): string | undefined {
  const db = trimEnv(dbKey);
  const env = trimEnv(envKey);
  if (db?.startsWith("AQ.") && env?.startsWith("AIza")) return db;
  return env ?? db;
}

/** Read Vertex env vars at call time (not module init) so .env.local changes apply after restart. */
function readVertexEnv(): Partial<VertexAIConfig> {
  return {
    api_key: trimEnv(process.env.GOOGLE_VERTEX_API_KEY) ?? env.server.GOOGLE_VERTEX_API_KEY,
    project_id: trimEnv(process.env.GOOGLE_CLOUD_PROJECT) ?? env.server.GOOGLE_CLOUD_PROJECT,
    location: trimEnv(process.env.GOOGLE_CLOUD_LOCATION) ?? env.server.GOOGLE_CLOUD_LOCATION ?? VERTEX_DEFAULTS.location,
    planner_model: VERTEX_DEFAULTS.planner_model,
    image_model: VERTEX_DEFAULTS.image_model,
    video_model: VERTEX_DEFAULTS.video_model,
    embedding_model: VERTEX_DEFAULTS.embedding_model,
  };
}

function envVertexConfig(): Partial<VertexAIConfig> {
  return readVertexEnv();
}

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;

  const admin = createAdminClient();
  const { data } = await admin.from("platform_settings").select("value").eq("key", key).maybeSingle();
  const value = (data?.value as T) ?? fallback;
  cache.set(key, { value, expires: Date.now() + TTL_MS });
  return value;
}

export async function setPlatformSetting(key: string, value: unknown, updatedBy?: string) {
  const admin = createAdminClient();
  await admin.from("platform_settings").upsert({
    key,
    value,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy ?? null,
  });
  cache.delete(key);
}

/** Walkthrough pipeline always uses Vertex AI (env credentials required). */
export async function getWalkthroughAIProvider(): Promise<WalkthroughAIProvider> {
  return "vertex";
}

/** Merged config: environment variables override platform_settings DB values. */
export async function getVertexAIConfig(): Promise<VertexAIConfig> {
  const fromDb = await getSetting<VertexAIConfig>("vertex_ai_config", {
    planner_model: VERTEX_DEFAULTS.planner_model,
    image_model: VERTEX_DEFAULTS.image_model,
    video_model: VERTEX_DEFAULTS.video_model,
    embedding_model: VERTEX_DEFAULTS.embedding_model,
    location: VERTEX_DEFAULTS.location,
  });
  const fromEnv = readVertexEnv();
  const merged = {
    ...fromDb,
    ...Object.fromEntries(Object.entries(fromEnv).filter(([, v]) => v != null && v !== "")),
  } as VertexAIConfig;
  merged.api_key = pickVertexApiKey(fromDb.api_key, fromEnv.api_key);
  return merged;
}

/** Resolve Vertex credentials from platform_settings DB + environment (env wins). */
export async function resolveVertexCredentials(): Promise<{ apiKey: string; projectId: string; location: string }> {
  const cfg = await getVertexAIConfig();
  const apiKey = trimEnv(cfg.api_key);
  const projectId = trimEnv(cfg.project_id);
  const location = trimEnv(cfg.location) ?? VERTEX_DEFAULTS.location;

  if (!apiKey) {
    throw new Error(
      "GOOGLE_VERTEX_API_KEY is not configured. Add it to .env.local (GOOGLE_VERTEX_API_KEY=...) or save it in Admin → Walkthrough AI, then restart `npm run dev`.",
    );
  }
  if (!projectId) {
    throw new Error(
      "GOOGLE_CLOUD_PROJECT is not configured. Add it to .env.local (GOOGLE_CLOUD_PROJECT=...) or save it in Admin → Walkthrough AI.",
    );
  }
  return { apiKey, projectId, location };
}

/** @deprecated Use resolveVertexCredentials() — sync env-only check misses DB credentials. */
export function requireVertexCredentials(): { apiKey: string; projectId: string; location: string } {
  const apiKey = trimEnv(process.env.GOOGLE_VERTEX_API_KEY) ?? env.server.GOOGLE_VERTEX_API_KEY;
  const projectId = trimEnv(process.env.GOOGLE_CLOUD_PROJECT) ?? env.server.GOOGLE_CLOUD_PROJECT;
  const location = trimEnv(process.env.GOOGLE_CLOUD_LOCATION) ?? env.server.GOOGLE_CLOUD_LOCATION ?? VERTEX_DEFAULTS.location;
  if (!apiKey) {
    throw new Error("GOOGLE_VERTEX_API_KEY is not configured in environment.");
  }
  if (!projectId) {
    throw new Error("GOOGLE_CLOUD_PROJECT is not configured in environment.");
  }
  return { apiKey, projectId, location };
}

export async function getSuperAdminConfig(): Promise<SuperAdminConfig> {
  return getSetting<SuperAdminConfig>("super_admin", {
    username: "superadmin",
    email: "superadmin@realsite.platform",
    configured: false,
  });
}

export function clearPlatformSettingsCache() {
  cache.clear();
}
