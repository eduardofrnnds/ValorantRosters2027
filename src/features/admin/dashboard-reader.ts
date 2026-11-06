import type { createAdminAuthClient } from "./auth-model";
import type { AdminMetrics, MetricKey, MetricResult } from "./dashboard-model";

/** HEAD + exact counts avoid fetching records or relying on API page limits. */
export async function readAdminMetrics(
  client: ReturnType<typeof createAdminAuthClient>,
  keys: readonly MetricKey[],
): Promise<AdminMetrics> {
  const signal = AbortSignal.timeout(10_000);
  const tables = {
    organizations: "organizations", players: "players", changes: "roster_changes",
    drafts: "roster_drafts", memberships: "roster_memberships", transfers: "roster_changes",
  } as const;
  const entries = await Promise.all(keys.map(async (key): Promise<[MetricKey, MetricResult]> => {
    try {
      const options = { count: "exact", head: true } as const;
      const query = key === "drafts"
        ? client.from("roster_drafts").select("id", options).eq("status", "draft")
        : key === "transfers"
          ? client.from("roster_changes").select("id", options).eq("change_type", "transferred")
          : client.from(tables[key]).select("id", options);
      const { count, error } = await query.abortSignal(signal);
      if (error || count === null || !Number.isSafeInteger(count) || count < 0) return [key, { status: "unavailable" }];
      return [key, { status: "ready", count }];
    } catch { return [key, { status: "unavailable" }]; }
  }));
  return Object.fromEntries(entries);
}
