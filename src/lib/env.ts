import { z } from "zod";

const serverSchema = z.object({
  WORLD_LABS_API_KEY: z.string().min(1).optional(),
  WORLD_LABS_API_BASE: z.string().url().default("https://api.worldlabs.ai"),
  SPAITIAL_API_KEY: z.string().min(1).optional(),
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OPENROUTER_PRIMARY_MODEL: z.string().default("google/gemini-3.5-flash"),
  OPENROUTER_PLANNER_MODEL: z.string().default("google/gemini-3.5-flash"),
  OPENROUTER_IMAGE_MODEL: z.string().default("google/gemini-3.1-flash-image-preview"),
  OPENROUTER_VIDEO_MODEL: z.string().default("google/veo-3.1-lite"),
  GOOGLE_VERTEX_API_KEY: z.string().min(1).optional(),
  GOOGLE_CLOUD_PROJECT: z.string().optional(),
  GOOGLE_CLOUD_LOCATION: z.string().default("us-central1"),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_BRAIN_MODEL: z.string().default("gemini-3.5-flash"),
  ELEVENLABS_API_KEY: z.string().min(1).optional(),
  ELEVENLABS_AGENT_ID: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().default("21m00Tcm4TlvDq8ikWAM"),
  ELEVENLABS_TTS_MODEL: z.string().default("eleven_v3"),
  ELEVENLABS_STT_MODEL: z.string().default("scribe_v2"),
  ELEVENLABS_CONVAI_TOOL_SECRET: z.string().optional(),
  SARVAM_API_KEY: z.string().min(1).optional(),
  SARVAM_API_BASE_URL: z.string().url().default("https://api.sarvam.ai"),
  SARVAM_SAMVAAD_ORG_ID: z.string().optional(),
  SARVAM_SAMVAAD_WORKSPACE_ID: z.string().optional(),
  SARVAM_SAMVAAD_APP_ID: z.string().optional(),
  SARVAM_SAMVAAD_TOOL_SECRET: z.string().optional(),
  SARVAM_SAMVAAD_RUNTIME_BASE: z
    .string()
    .url()
    .default("https://apps.sarvam.ai/api/app-runtime/"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

/** Treat empty/whitespace-only env vars as unset so optional schemas don't reject "". */
function opt(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export const env = {
  ...clientSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: opt(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: opt(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    NEXT_PUBLIC_APP_URL: opt(process.env.NEXT_PUBLIC_APP_URL) ?? "http://localhost:3000",
  }),
  server: serverSchema.parse({
    WORLD_LABS_API_KEY: opt(process.env.WORLD_LABS_API_KEY),
    WORLD_LABS_API_BASE: opt(process.env.WORLD_LABS_API_BASE) ?? "https://api.worldlabs.ai",
    SPAITIAL_API_KEY: opt(process.env.SPAITIAL_API_KEY),
    OPENROUTER_API_KEY: opt(process.env.OPENROUTER_API_KEY),
    OPENROUTER_PRIMARY_MODEL: opt(process.env.OPENROUTER_PRIMARY_MODEL) ?? "google/gemini-3.5-flash",
    OPENROUTER_PLANNER_MODEL: opt(process.env.OPENROUTER_PLANNER_MODEL) ?? "google/gemini-3.5-flash",
    OPENROUTER_IMAGE_MODEL: opt(process.env.OPENROUTER_IMAGE_MODEL) ?? "google/gemini-3.1-flash-image-preview",
    OPENROUTER_VIDEO_MODEL: opt(process.env.OPENROUTER_VIDEO_MODEL) ?? "google/veo-3.1-lite",
    GOOGLE_VERTEX_API_KEY: opt(process.env.GOOGLE_VERTEX_API_KEY),
    GOOGLE_CLOUD_PROJECT: opt(process.env.GOOGLE_CLOUD_PROJECT),
    GOOGLE_CLOUD_LOCATION: opt(process.env.GOOGLE_CLOUD_LOCATION) ?? "us-central1",
    GEMINI_API_KEY: opt(process.env.GEMINI_API_KEY),
    GEMINI_BRAIN_MODEL: opt(process.env.GEMINI_BRAIN_MODEL) ?? "gemini-3.5-flash",
    ELEVENLABS_API_KEY: opt(process.env.ELEVENLABS_API_KEY),
    ELEVENLABS_AGENT_ID: opt(process.env.ELEVENLABS_AGENT_ID),
    ELEVENLABS_VOICE_ID: opt(process.env.ELEVENLABS_VOICE_ID) ?? "21m00Tcm4TlvDq8ikWAM",
    ELEVENLABS_TTS_MODEL: opt(process.env.ELEVENLABS_TTS_MODEL) ?? "eleven_v3",
    ELEVENLABS_STT_MODEL: opt(process.env.ELEVENLABS_STT_MODEL) ?? "scribe_v2",
    ELEVENLABS_CONVAI_TOOL_SECRET: opt(process.env.ELEVENLABS_CONVAI_TOOL_SECRET),
    SARVAM_API_KEY: opt(process.env.SARVAM_API_KEY),
    SARVAM_API_BASE_URL: opt(process.env.SARVAM_API_BASE_URL) ?? "https://api.sarvam.ai",
    SARVAM_SAMVAAD_ORG_ID: opt(process.env.SARVAM_SAMVAAD_ORG_ID),
    SARVAM_SAMVAAD_WORKSPACE_ID: opt(process.env.SARVAM_SAMVAAD_WORKSPACE_ID),
    SARVAM_SAMVAAD_APP_ID: opt(process.env.SARVAM_SAMVAAD_APP_ID),
    SARVAM_SAMVAAD_TOOL_SECRET: opt(process.env.SARVAM_SAMVAAD_TOOL_SECRET),
    SARVAM_SAMVAAD_RUNTIME_BASE:
      opt(process.env.SARVAM_SAMVAAD_RUNTIME_BASE) ?? "https://apps.sarvam.ai/api/app-runtime/",
    SUPABASE_SERVICE_ROLE_KEY: opt(process.env.SUPABASE_SERVICE_ROLE_KEY),
  }),
};

export function requireServerKey(key: keyof typeof env.server, label: string): string {
  const value = env.server[key];
  if (!value) throw new Error(`${label} is not configured. Set ${key} in environment.`);
  return value as string;
}
