import fs from "node:fs";

const token = process.env.VERCEL_TOKEN;
const projectId = process.env.VERCEL_PROJECT_ID ?? "prj_4XHVXKPWAbN8kKnBABSSMytXmCQ0";
const appUrl = process.env.VERCEL_APP_URL ?? "https://project-7f3wg.vercel.app";

if (!token) {
  console.error("VERCEL_TOKEN is required");
  process.exit(1);
}

const raw = fs.readFileSync(".env.local", "utf8");
const vars = {};

for (const line of raw.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq < 0) continue;
  const key = trimmed.slice(0, eq).trim();
  const value = trimmed.slice(eq + 1).trim();
  if (!value) continue;
  vars[key] = value;
}

vars.NEXT_PUBLIC_APP_URL = appUrl;

for (const [key, value] of Object.entries(vars)) {
  const type = key.startsWith("NEXT_PUBLIC_") ? "plain" : "encrypted";
  const res = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env?upsert=true`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      key,
      value,
      type,
      target: ["production", "preview", "development"],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Failed ${key}: ${res.status} ${body}`);
    process.exit(1);
  }

  console.log(`Synced ${key}`);
}

console.log(`Done. NEXT_PUBLIC_APP_URL=${appUrl}`);
