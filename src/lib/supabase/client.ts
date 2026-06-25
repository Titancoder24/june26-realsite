import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | undefined;

/**
 * Browser Supabase client — singleton with Web Lock bypass.
 * Prevents signIn/getUser from hanging on mobile Safari & React 19
 * when navigator.locks gets orphaned.
 */
export function createClient() {
  if (browserClient) return browserClient;

  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        lock: async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>) => fn(),
      },
    },
  );

  return browserClient;
}
