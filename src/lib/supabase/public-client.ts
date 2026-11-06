import { createClient } from "@supabase/supabase-js";
import type { PublicSupabaseConfig } from "./config";
import type { PublicDatabase } from "./database.types";

/** Anonymous reads only: never reuse an admin/user session for public rendering. */
export function createPublicSupabaseClient(config: PublicSupabaseConfig) {
  return createClient<PublicDatabase>(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}
