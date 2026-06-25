import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export type DbHealthStatus = {
  connected: boolean;
  configured: boolean;
  latencyMs?: number;
  tables?: Record<string, boolean>;
  error?: string;
  projectUrl?: string;
};

const CORE_TABLES = [
  "organizations",
  "profiles",
  "projects",
  "properties",
  "experiences",
  "buyer_sessions",
  "leads",
  "campaign_links",
  "analytics_events",
  "heatmap_points",
] as const;

export async function checkDatabaseHealth(): Promise<DbHealthStatus> {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.server.SUPABASE_SERVICE_ROLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || url.includes("your-project") || key.includes("your-")) {
    return {
      connected: false,
      configured: false,
      error: "Supabase credentials are not configured. Set NEXT_PUBLIC_SUPABASE_URL and keys in .env.local",
      projectUrl: url,
    };
  }

  const start = Date.now();
  try {
    const client = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const tableChecks = await Promise.all(
      CORE_TABLES.map(async (table) => {
        const { error } = await client.from(table).select("id", { count: "exact", head: true }).limit(1);
        return [table, !error] as const;
      }),
    );

    const tables = Object.fromEntries(tableChecks);
    const allOk = tableChecks.every(([, ok]) => ok);
    const latencyMs = Date.now() - start;

    if (!allOk) {
      const failed = tableChecks.filter(([, ok]) => !ok).map(([t]) => t);
      return {
        connected: false,
        configured: true,
        latencyMs,
        tables,
        projectUrl: url,
        error: `Connected to Supabase but schema may be incomplete. Missing or inaccessible tables: ${failed.join(", ")}. Apply migrations 001–003.`,
      };
    }

    return { connected: true, configured: true, latencyMs, tables, projectUrl: url };
  } catch (err) {
    return {
      connected: false,
      configured: true,
      latencyMs: Date.now() - start,
      projectUrl: url,
      error: err instanceof Error ? err.message : "Database connection failed",
    };
  }
}
