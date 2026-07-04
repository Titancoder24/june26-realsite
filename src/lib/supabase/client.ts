import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | undefined;

function readSupabasePublicEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "",
  };
}

export function isSupabaseBrowserConfigured(): boolean {
  const { url, anonKey } = readSupabasePublicEnv();
  return Boolean(url && anonKey);
}

/**
 * Browser Supabase client — singleton with Web Lock bypass.
 * Prevents signIn/getUser from hanging on mobile Safari & React 19
 * when navigator.locks gets orphaned.
 */
export function createClient() {
  if (browserClient) return browserClient;

  const { url, anonKey } = readSupabasePublicEnv();
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  browserClient = createBrowserClient(url, anonKey, {
    auth: {
      lock: async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>) => fn(),
    },
  });

  return browserClient;
}
