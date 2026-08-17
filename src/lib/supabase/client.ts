import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// TODO once the schema has settled: run
//   npx supabase gen types typescript --project-id <ref> --schema public
// and parametrize createBrowserClient<Database>(...) below. Left untyped for
// now rather than hand-maintaining a schema that would silently drift from
// supabase/migrations/0001_init.sql.
let browserClient: SupabaseClient | undefined;

// Browser-side client. Uses the public URL + publishable (anon) key — safe
// to ship, RLS does the actual authorization. Never import the secret/
// service-role key here. Cookie-based session storage (not localStorage) —
// carries over cleanly to the Capacitor WebView later and lets the SSR
// server client (./server.ts) read the same session.
export function getSupabaseBrowserClient(): SupabaseClient {
  if (typeof window === "undefined") {
    throw new Error("getSupabaseBrowserClient() called on the server — use getSupabaseServerClient() instead.");
  }
  if (!browserClient) {
    const url = import.meta.env["VITE_SUPABASE_URL"];
    const anonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"];
    if (!url || !anonKey) {
      throw new Error(
        "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill them in, or set VITE_API_MODE=mock to run on demo data.",
      );
    }
    browserClient = createBrowserClient(url, anonKey);
  }
  return browserClient;
}
