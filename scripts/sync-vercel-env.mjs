/**
 * Sync .env.local variables to a Vercel project.
 * Usage: VERCEL_TOKEN=... VERCEL_PROJECT_ID=prj_... node scripts/sync-vercel-env.mjs
 */
import { readFileSync } from "fs";

const SKIP_KEYS = new Set([
  "VERCEL_OIDC_TOKEN",
  "VERCEL_TOKEN",
  "VERCEL_PROJECT_ID",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_PROJECT_REF",
]);

const token = process.env.VERCEL_TOKEN?.trim();
const projectId = process.env.VERCEL_PROJECT_ID?.trim();
const productionUrl = process.env.VERCEL_PRODUCTION_URL?.trim();

if (!token || !projectId) {
  console.error("Set VERCEL_TOKEN and VERCEL_PROJECT_ID");
  process.exit(1);
}

function loadEnvLocal() {
  const vars = {};
  try {
    const raw = readFileSync(".env.local", "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      vars[key] = value;
    }
  } catch (err) {
    console.error("Could not read .env.local:", err.message);
    process.exit(1);
  }
  return vars;
}

async function vercelFetch(path, options = {}) {
  const res = await fetch(`https://api.vercel.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error?.message || body.message || `${res.status} ${path}`);
  }
  return body;
}

async function main() {
  const local = loadEnvLocal();
  if (productionUrl) {
    local.NEXT_PUBLIC_APP_URL = productionUrl;
  }

  const existing = await vercelFetch(`/v9/projects/${projectId}/env`);
  const byKey = new Map((existing.envs ?? []).map((env) => [env.key, env]));
  const targets = ["production", "preview", "development"];

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const [key, value] of Object.entries(local)) {
    if (SKIP_KEYS.has(key) || !value) {
      skipped += 1;
      continue;
    }

    const current = byKey.get(key);
    if (!current) {
      await vercelFetch(`/v10/projects/${projectId}/env`, {
        method: "POST",
        body: JSON.stringify({
          key,
          value,
          type: key.startsWith("NEXT_PUBLIC_") ? "plain" : "encrypted",
          target: targets,
        }),
      });
      created += 1;
      console.log(`+ ${key}`);
      continue;
    }

    await vercelFetch(`/v9/projects/${projectId}/env/${current.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        value,
        type: key.startsWith("NEXT_PUBLIC_") ? "plain" : "encrypted",
        target: targets,
      }),
    });
    updated += 1;
    console.log(`~ ${key}`);
  }

  console.log(`Done. created=${created} updated=${updated} skipped=${skipped}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
