import type { Player } from "../../types/player";

/** Shared player identity, without private or unnecessary profile fields. */
export type PlayerCardData = Pick<Player, "id" | "slug" | "nickname" | "role">;

export const rosterSections = [
  { id: "titulares", status: "starter", title: "Titulares", emptyMessage: "Nenhum titular publicado para esta temporada." },
  { id: "reservas", status: "reserve", title: "Reservas", emptyMessage: "Nenhum reserva publicado para esta temporada." },
  { id: "inativos", status: "inactive", title: "Inativos", emptyMessage: "Nenhum jogador inativo publicado para esta temporada." },
  { id: "tecnicos", status: "coach", title: "Técnicos", emptyMessage: "Nenhum técnico publicado para esta temporada." },
] as const;

export type RosterStatus = (typeof rosterSections)[number]["status"];

/** Local view data only; this is not the future database membership schema. */
export interface RosterEntry {
  readonly organizationId: string;
  readonly seasonId: string;
  readonly status: RosterStatus;
  readonly publicationStatus: "draft" | "published";
  readonly player: PlayerCardData;
}

export function getPublishedRosterGroups(entries: readonly RosterEntry[], organizationId: string, seasonId: string) {
  const published = entries.filter((entry) => entry.publicationStatus === "published"
    && entry.organizationId === organizationId && entry.seasonId === seasonId);
  const alphabetical = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

  return rosterSections.map((section) => ({
    ...section,
    players: published.filter((entry) => entry.status === section.status)
      .map((entry) => entry.player)
      .sort((first, second) => alphabetical.compare(first.nickname, second.nickname) || first.id.localeCompare(second.id)),
  }));
}

export type RosterGroup = ReturnType<typeof getPublishedRosterGroups>[number];
