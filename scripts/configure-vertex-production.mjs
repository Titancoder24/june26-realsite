/**
 * One-time production config — run with env vars, never commit secrets.
 * Usage:
 *   VERTEX_API_KEY=... VERTEX_PROJECT_ID=... node scripts/configure-vertex-production.mjs
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  try {
    const raw = readFileSync(".env.local", "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (!m) continue;
      const key = m[1].trim();
      const val = m[2].trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // .env.local optional if vars already exported
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiKey = process.env.VERTEX_API_KEY;
const projectId = process.env.VERTEX_PROJECT_ID ?? "project-094610ee-1edd-4fff-a1f";

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!apiKey) {
  console.error("Missing VERTEX_API_KEY env var");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const vertexConfig = {
  api_key: apiKey,
  project_id: projectId,
  location: "us-central1",
  planner_model: "gemini-2.5-flash",
  video_model: "veo-3.1-lite-generate-preview",
};

const { error: e1 } = await admin.from("platform_settings").upsert({
  key: "walkthrough_ai_provider",
  value: "vertex",
  updated_at: new Date().toISOString(),
});

const { error: e2 } = await admin.from("platform_settings").upsert({
  key: "vertex_ai_config",
  value: vertexConfig,
  updated_at: new Date().toISOString(),
});

if (e1 || e2) {
  console.error("Upsert failed:", e1?.message ?? e2?.message);
  process.exit(1);
}

console.log("OK: Vertex provider=vertex, project_id=" + projectId);
