#!/usr/bin/env node
/**
 * Prevent `next build` while `next dev` is running — both write to `.next` and corrupt it.
 */
import { execSync } from "node:child_process";

const port = process.env.PORT ?? "3000";

function pidOnPort(p) {
  try {
    return execSync(`lsof -ti :${p}`, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

const pids = pidOnPort(port);
if (pids) {
  console.error(`
⚠️  Cannot run "npm run build" while the dev server is running on port ${port}.

Running build + dev at the same time corrupts the .next cache and causes
"Internal Server Error" (missing app-build-manifest.json) on every route.

Fix:
  1. Stop dev (Ctrl+C in the dev terminal), OR run: npm run dev:reset
  2. Then run build again.

Dev PIDs on :${port}: ${pids.replace(/\n/g, ", ")}
`);
  process.exit(1);
}
