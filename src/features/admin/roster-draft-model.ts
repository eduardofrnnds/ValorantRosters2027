import { z } from "zod";
import { playerRoles, type PlayerRow } from "./player-model.ts";
import { editorMessages } from "./organization-model.ts";

export const rosterStatuses = ["starter", "reserve", "inactive", "coach"] as const;
export const draftDate = z.iso.date();
const member = z.object({ player_id: z.uuid(), status: z.enum(rosterStatuses), role: z.enum(playerRoles).nullable() }).strict();
export const baseMember = member.extend({ id: z.uuid(), start_date: draftDate, end_date: draftDate.nullable(), updated_at: z.iso.datetime({ offset: true }) });
export const draftPayloadSchema = z.object({
  version: z.literal(1), effective_on: draftDate,
  base_members: z.array(baseMember).max(200), members: z.array(member).max(200),
}).strict().refine((value) => new Set(value.members.map((entry) => entry.player_id)).size === value.members.length, "Um jogador só pode aparecer uma vez no elenco proposto.");
export const saveDraftSchema = z.object({
  id: z.uuid(), team_season_id: z.uuid(), expected_updated_at: z.union([z.iso.datetime({ offset: true }), z.literal("")]),
  base_revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), payload: draftPayloadSchema,
}).strict();
export type DraftMember = z.infer<typeof member>;
export type BaseMember = z.infer<typeof baseMember>;
export type DraftPayload = z.infer<typeof draftPayloadSchema>;
export type SaveDraftInput = z.infer<typeof saveDraftSchema>;
export type MembershipRow = { id: string; player_id: string; team_season_id: string; status: typeof rosterStatuses[number]; role: PlayerRow["role"]; role_is_explicit: boolean; start_date: string; end_date: string | null; updated_at: string; publication_status: "draft" | "published" };
export type DraftRow = { id: string; team_season_id: string; created_by: string; status: "draft" | "published" | "archived"; base_revision: number; payload: unknown; updated_at: string; published_at: string | null; published_by: string | null; publication_source_url: string | null };

export function currentRoster(memberships: MembershipRow[], players: PlayerRow[], teamId: string, date: string): BaseMember[] {
  return memberships.filter((entry) => entry.team_season_id === teamId && entry.publication_status === "published" && entry.start_date <= date && (!entry.end_date || entry.end_date >= date))
    .sort((a, b) => a.id.localeCompare(b.id)).map((entry) => {
      const player = players.find((candidate) => candidate.id === entry.player_id);
      if (!player) throw new Error("Jogador de vínculo não encontrado.");
      return { id: entry.id, player_id: entry.player_id, status: entry.status, role: entry.role_is_explicit ? entry.role : player.role, start_date: entry.start_date, end_date: entry.end_date, updated_at: entry.updated_at };
    });
}
export function rosterDiff(base: BaseMember[], members: DraftMember[]) {
  const added = members.filter((entry) => !base.some((old) => old.player_id === entry.player_id));
  const removed = base.filter((entry) => !members.some((next) => next.player_id === entry.player_id));
  const changed = members.flatMap((entry) => {
    const old = base.find((candidate) => candidate.player_id === entry.player_id);
    return old && (old.status !== entry.status || old.role !== entry.role) ? [{ before: old, after: entry }] : [];
  });
  return { added, removed, changed };
}
export const draftMessages = {
  ...editorMessages,
  saved: "Rascunho salvo. O elenco público não foi alterado.",
  invalid: "Revise a data e os jogadores. Cada jogador pode aparecer uma vez; limite de 200 entradas por rascunho.",
  duplicate: "Esta equipe já tem um rascunho aberto, ou este formulário já foi salvo. Abra o rascunho existente.",
  conflict: "O rascunho ou a base publicada mudou. Recarregue; se a base mudou, arquive o rascunho antigo e crie outro.",
  reference: "Há conflito de titular em outra equipe, participação arquivada ou rascunho incompatível. Revise os avisos antes de salvar.",
};

export function starterConflicts(options: {
  members: DraftMember[]; teamId: string; seasonId: string; date: string;
  teams: { id: string; season_id: string }[]; memberships: MembershipRow[]; drafts: DraftRow[];
}) {
  const otherTeams = new Set(options.teams.filter((team) => team.season_id === options.seasonId && team.id !== options.teamId).map((team) => team.id));
  return options.members.filter((member) => member.status === "starter").flatMap((member) => {
    const published = options.memberships.filter((entry) => entry.player_id === member.player_id && otherTeams.has(entry.team_season_id) && entry.publication_status === "published" && entry.status === "starter" && entry.start_date <= options.date && (!entry.end_date || entry.end_date >= options.date));
    const drafts = options.drafts.filter((draft) => {
      if (draft.status !== "draft" || !otherTeams.has(draft.team_season_id)) return false;
      const parsed = draftPayloadSchema.safeParse(draft.payload);
      return parsed.success && parsed.data.members.some((entry) => entry.player_id === member.player_id && entry.status === "starter");
    });
    return [...published.map((entry) => ({ playerId: member.player_id, teamId: entry.team_season_id, source: "publicado" })), ...drafts.map((draft) => ({ playerId: member.player_id, teamId: draft.team_season_id, source: "rascunho" }))];
  });
}
