import type { SupabaseClient } from "@supabase/supabase-js";
import type { PublicDatabase } from "../../lib/supabase/database.types";
import { timelineFiltersSchema, timelineResultSchema } from "./timeline-model.ts";

export async function readRosterTimeline(client: SupabaseClient<PublicDatabase>, input: unknown) {
  const filters = timelineFiltersSchema.parse(input);
  const { data, error } = await client.rpc("read_roster_timeline", { filters }).abortSignal(AbortSignal.timeout(15_000));
  if (error) throw new Error("Histórico indisponível.");
  const result = timelineResultSchema.parse(data);
  const expected = Math.min(filters.page_size, Math.max(0, result.total - (filters.page - 1) * filters.page_size));
  if (result.events.length !== expected) throw new Error("Histórico incompleto.");
  return result;
}
