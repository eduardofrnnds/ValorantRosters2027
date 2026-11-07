import type { Player, PlayerMembership } from "../../types/player";
import type { VctCatalog } from "../../types/vct";

export const playerRoleLabels = {
  duelist: "Duelista", initiator: "Iniciador", controller: "Controlador",
  sentinel: "Sentinela", flex: "Flex", coach: "Técnico",
} as const;

export const membershipStatusLabels = {
  starter: "Titular", reserve: "Reserva", inactive: "Inativo", coach: "Técnico",
} as const;

function assertDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value))
    || new Date(value).toISOString().slice(0, 10) !== value) {
    throw new Error(`Data de vínculo inválida: ${value}`);
  }
}

export function formatCareerDate(value: string) {
  assertDate(value);
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export function getPublishedPlayer(players: readonly Player[], slug: string) {
  return players.find((player) => player.slug === slug && player.publicationStatus === "published");
}

/** Resolve every career record by ID, across seasons; never infer a team from nickname. */
export function getPlayerProfile(
  players: readonly Player[], memberships: readonly PlayerMembership[],
  catalog: VctCatalog, slug: string, asOfDate: string,
) {
  const player = getPublishedPlayer(players, slug);
  if (!player) return undefined;
  assertDate(asOfDate);

  const career = memberships
    .filter((entry) => entry.playerId === player.id && entry.publicationStatus === "published")
    .map((entry) => {
      assertDate(entry.startDate);
      if (entry.endDate) {
        assertDate(entry.endDate);
        if (entry.endDate < entry.startDate) throw new Error("Fim do vínculo anterior ao início.");
      }
      const organization = catalog.organizations.find(({ id }) => id === entry.organizationId);
      const season = catalog.seasons.find(({ id }) => id === entry.seasonId);
      if (!organization || !season) throw new Error("Vínculo de jogador com referência ausente.");
      return { ...entry, organization, season };
    })
    .filter((entry) => entry.startDate <= asOfDate)
    .sort((a, b) => b.startDate.localeCompare(a.startDate) || a.id.localeCompare(b.id));

  return {
    player,
    observedTeam: player.rosterObservation ? catalog.organizations.find((organization) => organization.id === player.rosterObservation!.organizationId) : undefined,
    currentMemberships: career.filter((entry) => !entry.endDate || entry.endDate >= asOfDate),
    pastMemberships: career.filter((entry) => entry.endDate && entry.endDate < asOfDate),
  };
}

export type PlayerProfileData = NonNullable<ReturnType<typeof getPlayerProfile>>;
