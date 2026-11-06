import "server-only";
import { readPublicSupabaseConfig } from "./config";
import { createPublicSupabaseClient } from "./public-client";

export function createServerPublicClient() {
  const config = readPublicSupabaseConfig();
  return config ? createPublicSupabaseClient(config) : null;
}
