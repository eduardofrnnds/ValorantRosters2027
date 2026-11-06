import "server-only";
import { createServerPublicClient } from "@/lib/supabase/server";
import { readPublishedTeamRoster } from "./public-roster-reader";
import { localRosterEntries } from "./data/local-roster";
import type { RosterEntry } from "./roster-model";

export async function getPublishedTeamRoster(organizationId: string, seasonId: string): Promise<{ status: "ready"; entries: readonly RosterEntry[] } | { status: "unavailable" }> {
  try {
    const client = createServerPublicClient();
    return { status: "ready", entries: client ? await readPublishedTeamRoster(client, organizationId, seasonId, new Date().toISOString().slice(0, 10)) : localRosterEntries };
  } catch { return { status: "unavailable" }; }
}
