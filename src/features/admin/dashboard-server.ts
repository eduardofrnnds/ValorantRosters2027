import "server-only";
import { cookies } from "next/headers";
import { readPublicSupabaseConfig } from "@/lib/supabase/config";
import { ADMIN_COOKIE, runAdminOperation, verifyAdminAccess } from "./auth-model";
import { requireAdmin } from "./server";
import { readAdminMetrics } from "./dashboard-reader";
import type { AdminMetrics, MetricKey } from "./dashboard-model";

export async function getAdminMetrics(keys: readonly MetricKey[]): Promise<AdminMetrics> {
  await requireAdmin();
  const unavailable = Object.fromEntries(keys.map((key) => [key, { status: "unavailable" as const }]));
  try {
    const config = readPublicSupabaseConfig();
    const token = (await cookies()).get(ADMIN_COOKIE)?.value;
    if (!config) return unavailable;
    const result = await runAdminOperation(config, token, ({ client }) => readAdminMetrics(client, keys));
    // Revocation during reads must not turn public-only results into admin totals.
    if ((await verifyAdminAccess(config, token)).status !== "authorized") return unavailable;
    return result;
  } catch { return unavailable; }
}
