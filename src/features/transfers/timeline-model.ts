import { z } from "zod";
import { playerRoles } from "../admin/player-model.ts";
import { rosterStatuses } from "../admin/roster-draft-model.ts";
import { publishDraftSchema } from "../admin/roster-publication-model.ts";

export const changeTypes = ["joined", "left", "transferred", "status_changed", "corrected"] as const;
export const changeLabels = { joined: "Entrada", left: "Saída", transferred: "Transferência", status_changed: "Status ou função", corrected: "Correção" } as const;
const slug = z.string().min(1).max(100).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
export const timelineFiltersSchema = z.object({
  organization_id: z.uuid().optional(), player_id: z.uuid().optional(),
  region: slug.optional(), team: slug.optional(), kind: z.enum(changeTypes).optional(),
  from: z.iso.date().optional(), to: z.iso.date().optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  page_size: z.number().int().min(1).max(50).default(20),
}).strict().refine((value) => !value.from || !value.to || value.from <= value.to, "A data inicial deve preceder a final.");
export type TimelineFilters = z.infer<typeof timelineFiltersSchema>;
const side = z.object({ membership_id: z.uuid(), organization_id: z.uuid(), name: z.string().min(1), slug,
  region: slug, season: z.number().int(), status: z.enum(rosterStatuses), role: z.enum(playerRoles).nullable() });
export const timelineResultSchema = z.object({ total: z.number().int().nonnegative(), events: z.array(z.object({
  id: z.uuid(), type: z.enum(changeTypes), date: z.iso.date(), summary: z.string().min(1), note: z.string().nullable(),
  source_url: publishDraftSchema.shape.source_url.nullable(), published_at: z.iso.datetime({ offset: true }),
  player: z.object({ id: z.uuid(), nickname: z.string().min(1), slug }), from: side.nullable(), to: side.nullable(),
})).max(50) }).refine((value) => value.events.length <= value.total && new Set(value.events.map((entry) => entry.id)).size === value.events.length);
export type TimelineData = z.infer<typeof timelineResultSchema>;
export type TimelineResult = { status: "ready"; data: TimelineData } | { status: "unavailable" };

export function parseTimelineQuery(query: Record<string, string | string[] | undefined>) {
  const fields = ["region", "team", "from", "to", "player_id", "page"] as const;
  const input: Record<string, unknown> = {};
  for (const field of fields) if (query[field] !== undefined && query[field] !== "") input[field] = query[field];
  if (query.kind !== "all") input.kind = query.kind || "transferred";
  return timelineFiltersSchema.safeParse(input);
}
export function timelineHref(filters: Partial<TimelineFilters>, page = 1) {
  const query = new URLSearchParams();
  for (const field of ["region", "team", "from", "to", "player_id"] as const) if (filters[field]) query.set(field, filters[field]);
  query.set("kind", filters.kind ?? "all");
  if (page > 1) query.set("page", String(page));
  return `/transfers?${query}`;
}
