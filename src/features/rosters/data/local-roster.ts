import type { RosterEntry } from "../roster-model";

// No verified roster data has been supplied. Do not infer players from partner teams.
// This source is consumed on the server; only published view data reaches the UI.
export const localRosterEntries: readonly RosterEntry[] = [];
