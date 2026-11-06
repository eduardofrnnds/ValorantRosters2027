"use client";

import { readPublicSupabaseConfig } from "./config";
import { createPublicSupabaseClient } from "./public-client";

let client: ReturnType<typeof createPublicSupabaseClient> | undefined;

/** Available for future public interactivity; current catalog reads stay on the server. */
export function createBrowserPublicClient() {
  const config = readPublicSupabaseConfig();
  if (!config) return null;
  client ??= createPublicSupabaseClient(config);
  return client;
}
