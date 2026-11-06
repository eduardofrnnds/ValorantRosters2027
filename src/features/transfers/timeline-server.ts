import "server-only";
import { connection } from "next/server";
import { createServerPublicClient } from "@/lib/supabase/server";
import { readRosterTimeline } from "./timeline-reader";
import { timelineFiltersSchema, type TimelineFilters, type TimelineResult } from "./timeline-model";

export async function getRosterTimeline(input: Partial<TimelineFilters> = {}): Promise<TimelineResult> {
  await connection();
  try {
    const filters = timelineFiltersSchema.parse(input);
    const client = createServerPublicClient();
    return { status: "ready", data: client ? await readRosterTimeline(client, filters) : { total: 0, events: [] } };
  } catch { return { status: "unavailable" }; }
}
