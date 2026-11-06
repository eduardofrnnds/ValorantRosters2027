export type PublicSupabaseConfig = { url: string; key: string };

/** Only public credentials enter this module. Missing pair means local read-only mode. */
export function parsePublicSupabaseConfig(urlValue?: string, keyValue?: string): PublicSupabaseConfig | null {
  const url = urlValue?.trim();
  const key = keyValue?.trim();
  if (!url && !key) return null;
  if (!url || !key) throw new Error("Configuração pública do Supabase incompleta.");
  let endpoint: URL;
  try { endpoint = new URL(url); } catch { throw new Error("URL pública do Supabase inválida."); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname);
  if ((endpoint.protocol !== "https:" && !(local && endpoint.protocol === "http:"))
    || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || !/^\/?$/.test(endpoint.pathname)) {
    throw new Error("URL pública do Supabase inválida.");
  }
  // Legacy anon JWTs are supported, but privileged JWTs must never reach the browser.
  let isAnonJWT = false;
  if (key.split(".").length === 3) {
    try {
      const body = key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      isAnonJWT = JSON.parse(atob(body)).role === "anon";
    } catch { /* Invalid public configuration, never log the key. */ }
  }
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key) && !isAnonJWT) {
    throw new Error("Use somente uma chave publishable ou anon nas variáveis públicas.");
  }
  return { url: endpoint.origin, key };
}

export function readPublicSupabaseConfig() {
  return parsePublicSupabaseConfig(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
